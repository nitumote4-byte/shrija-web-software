import { Router } from 'express'
import { z } from 'zod'
import { assertTenantId, emptyStorePayload, nowIso, pool } from '../db.js'
import {
  enforceTenantBody,
  requireAuth,
  requireActiveTenant,
  requireValidLicense,
  sessionCentre,
} from '../middleware/auth.js'
import { sanitizeXrfStorePayload } from '../xrfStandardSanitize.js'
import { filterFirmCentres, filterKvForSession, filterStoreForSession, isOscRestrictedKvKey, listFirmOutlets, mergeOscStoreWrite } from '../tenantIsolation.js'

export const dataRouter = Router()

dataRouter.use(requireAuth)
dataRouter.use(requireActiveTenant)
dataRouter.use(enforceTenantBody)
dataRouter.use(requireValidLicense)

function asJson(value: unknown): unknown {
  if (value == null) return null
  if (typeof value === 'object') return value
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

dataRouter.get('/store', async (req, res) => {
  const tenantId = req.user!.tenantId
  assertTenantId(tenantId)
  const centre = sessionCentre(req.user!)

  const { rows } = await pool.query(`SELECT payload FROM store_docs WHERE tenant_id = $1`, [
    tenantId,
  ])
  const row = rows[0] as { payload: unknown } | undefined

  if (!row) {
    const empty = emptyStorePayload()
    await pool.query(
      `INSERT INTO store_docs (tenant_id, payload, updated_at) VALUES ($1, $2::jsonb, $3)`,
      [tenantId, JSON.stringify(empty), nowIso()],
    )
    res.json({ data: filterStoreForSession(empty, centre) })
    return
  }

  res.json({ data: filterStoreForSession(asJson(row.payload), centre) })
})

dataRouter.put('/store', async (req, res) => {
  const tenantId = req.user!.tenantId
  assertTenantId(tenantId)
  const centre = sessionCentre(req.user!)

  if (!req.body?.data || typeof req.body.data !== 'object') {
    res.status(400).json({ error: 'body.data object required' })
    return
  }

  const incoming = req.body.data as Record<string, unknown>
  sanitizeXrfStorePayload(incoming)

  let payload = incoming
  if (centre.centreKind === 'osc') {
    const existing = await pool.query(`SELECT payload FROM store_docs WHERE tenant_id = $1`, [
      tenantId,
    ])
    const current = asJson(existing.rows[0]?.payload) || emptyStorePayload()
    payload = mergeOscStoreWrite(current, incoming, centre.centreId)
    sanitizeXrfStorePayload(payload)
  }

  const updatedAt = nowIso()
  await pool.query(
    `INSERT INTO store_docs (tenant_id, payload, updated_at) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (tenant_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
    [tenantId, JSON.stringify(payload), updatedAt],
  )

  // Normalize requests into job_docs for reporting / future queries
  const requests = Array.isArray((payload as { requests?: unknown }).requests)
    ? ((payload as { requests: Record<string, unknown>[] }).requests)
    : []
  for (const r of requests.slice(0, 5000)) {
    const requestNo = String(r.requestNo || '').trim()
    if (!requestNo) continue
    await pool.query(
      `INSERT INTO job_docs (tenant_id, request_no, status, party_name, payload, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (tenant_id, request_no) DO UPDATE SET
         status = EXCLUDED.status,
         party_name = EXCLUDED.party_name,
         payload = EXCLUDED.payload,
         updated_at = EXCLUDED.updated_at`,
      [
        tenantId,
        requestNo,
        String(r.status || 'Pending'),
        String(r.partyName || ''),
        JSON.stringify(r),
        updatedAt,
      ],
    )
  }

  res.json({ ok: true, updatedAt })
})

dataRouter.get('/backup', async (req, res) => {
  const tenantId = req.user!.tenantId
  assertTenantId(tenantId)
  const centre = sessionCentre(req.user!)
  const storeRow = await pool.query(`SELECT payload FROM store_docs WHERE tenant_id = $1`, [tenantId])
  const firmRow = await pool.query(
    `SELECT firm_name AS "firmName", email, address, gst_no AS "gstNo",
            bank_name AS "bankName", account_no AS "accountNo", ifsc, city, state, centres
     FROM firm_profiles WHERE tenant_id = $1`,
    [tenantId],
  )
  const kvRows = await pool.query(`SELECT key, value FROM kv_docs WHERE tenant_id = $1`, [tenantId])
  const kv: Record<string, unknown> = {}
  for (const row of kvRows.rows as { key: string; value: unknown }[]) {
    kv[row.key] = asJson(row.value)
  }
  const firm = (firmRow.rows[0] as Record<string, unknown> | undefined) || null
  if (firm) {
    firm.centres = filterFirmCentres(asJson(firm.centres), centre)
  }
  res.json({
    version: 1,
    exportedAt: nowIso(),
    store: filterStoreForSession(asJson(storeRow.rows[0]?.payload) || emptyStorePayload(), centre),
    firm,
    kv: filterKvForSession(kv, centre.centreKind),
  })
})

dataRouter.get('/kv', async (req, res) => {
  const tenantId = req.user!.tenantId
  const centre = sessionCentre(req.user!)
  const { rows } = await pool.query(`SELECT key, value FROM kv_docs WHERE tenant_id = $1`, [
    tenantId,
  ])

  const docs: Record<string, unknown> = {}
  for (const row of rows as { key: string; value: unknown }[]) {
    docs[row.key] = asJson(row.value)
  }
  res.json({ docs: filterKvForSession(docs, centre.centreKind) })
})

dataRouter.get('/kv/:key', async (req, res) => {
  const tenantId = req.user!.tenantId
  const centre = sessionCentre(req.user!)
  const key = String(req.params.key)
  if (isOscRestrictedKvKey(key, centre.centreKind)) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  const { rows } = await pool.query(
    `SELECT value FROM kv_docs WHERE tenant_id = $1 AND key = $2`,
    [tenantId, key],
  )
  const row = rows[0] as { value: unknown } | undefined

  if (!row) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  res.json({ key, value: asJson(row.value) })
})

const putKvSchema = z.object({
  value: z.unknown(),
})

dataRouter.put('/kv/:key', async (req, res) => {
  const tenantId = req.user!.tenantId
  const centre = sessionCentre(req.user!)
  const key = String(req.params.key)
  if (isOscRestrictedKvKey(key, centre.centreKind)) {
    res.status(403).json({ error: 'Not allowed for this centre' })
    return
  }
  const parsed = putKvSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'value required' })
    return
  }

  const jsonValue =
    typeof parsed.data.value === 'string'
      ? JSON.stringify(parsed.data.value)
      : JSON.stringify(parsed.data.value)

  await pool.query(
    `INSERT INTO kv_docs (tenant_id, key, value, updated_at) VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [tenantId, key, jsonValue, nowIso()],
  )

  res.json({ ok: true })
})

dataRouter.delete('/kv/:key', async (req, res) => {
  const tenantId = req.user!.tenantId
  const centre = sessionCentre(req.user!)
  const key = String(req.params.key)
  if (isOscRestrictedKvKey(key, centre.centreKind)) {
    res.status(403).json({ error: 'Not allowed for this centre' })
    return
  }
  await pool.query(`DELETE FROM kv_docs WHERE tenant_id = $1 AND key = $2`, [tenantId, key])
  res.json({ ok: true })
})

dataRouter.get('/firm-profile', async (req, res) => {
  const tenantId = req.user!.tenantId
  const centre = sessionCentre(req.user!)
  const { rows } = await pool.query(
    `SELECT firm_name AS "firmName", email, address, gst_no AS "gstNo",
            bank_name AS "bankName", account_no AS "accountNo", ifsc, city, state,
            centres
     FROM firm_profiles WHERE tenant_id = $1`,
    [tenantId],
  )
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) {
    res.json({
      profile: {
        firmName: req.user!.tenantName,
        centres: filterFirmCentres([], centre),
      },
    })
    return
  }
  let centres = row.centres
  if (typeof centres === 'string') {
    try {
      centres = JSON.parse(centres)
    } catch {
      centres = []
    }
  }
  const list = listFirmOutlets(centres, {
    name: String(row.firmName || req.user!.tenantName),
    address: String(row.address || ''),
    city: row.city != null ? String(row.city) : undefined,
    state: row.state != null ? String(row.state) : undefined,
  })
  res.json({ profile: { ...row, centres: filterFirmCentres(list, centre) } })
})

dataRouter.put('/firm-profile', async (req, res) => {
  const tenantId = req.user!.tenantId
  const centre = sessionCentre(req.user!)
  if (centre.centreKind === 'osc') {
    res.status(403).json({ error: 'Off-site users cannot update firm-wide centre details' })
    return
  }
  const p = req.body || {}
  const firmName = String(p.firmName || '').trim() || req.user!.tenantName
  const updatedAt = nowIso()

  const mainCentre = {
    id: 'main',
    kind: 'main',
    name: firmName,
    address: String(p.address || ''),
    city: String(p.city || ''),
    state: String(p.state || ''),
  }
  const incoming = Array.isArray(p.centres) ? p.centres : []
  const oscCentres = listFirmOutlets(incoming, { name: firmName, address: String(p.address || '') })
    .filter((c) => c.kind === 'osc')
    .map((c) => ({
      id: String(c.id),
      kind: 'osc',
      name: String(c.name || 'Off-Site Centre').trim() || 'Off-Site Centre',
      address: String(c.address || ''),
      city: String(c.city || ''),
      state: String(c.state || ''),
    }))
  const centres = [mainCentre, ...oscCentres]

  await pool.query(
    `INSERT INTO firm_profiles
     (tenant_id, firm_name, email, address, gst_no, bank_name, account_no, ifsc, city, state, centres, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
     ON CONFLICT (tenant_id) DO UPDATE SET
       firm_name = EXCLUDED.firm_name,
       email = EXCLUDED.email,
       address = EXCLUDED.address,
       gst_no = EXCLUDED.gst_no,
       bank_name = EXCLUDED.bank_name,
       account_no = EXCLUDED.account_no,
       ifsc = EXCLUDED.ifsc,
       city = EXCLUDED.city,
       state = EXCLUDED.state,
       centres = EXCLUDED.centres,
       updated_at = EXCLUDED.updated_at`,
    [
      tenantId,
      firmName,
      String(p.email || ''),
      String(p.address || ''),
      String(p.gstNo || ''),
      String(p.bankName || ''),
      String(p.accountNo || ''),
      String(p.ifsc || ''),
      String(p.city || ''),
      String(p.state || ''),
      JSON.stringify(centres),
      updatedAt,
    ],
  )

  await pool.query(`UPDATE tenants SET firm_name = $1, gstin = $2 WHERE id = $3`, [
    firmName,
    String(p.gstNo || ''),
    tenantId,
  ])

  res.json({ ok: true, profile: { ...p, firmName, centres } })
})
