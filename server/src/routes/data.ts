import { Router } from 'express'
import { z } from 'zod'
import { assertTenantId, emptyStorePayload, nowIso, pool, withTransaction } from '../db.js'
import {
  enforceTenantBody,
  requireAuth,
  requireActiveTenant,
  requireValidLicense,
  requireLiveUser,
  requireFreshPassword,
  sessionCentre,
} from '../middleware/auth.js'
import { sanitizeXrfStorePayload } from '../xrfStandardSanitize.js'
import { filterFirmCentres, filterKvForSession, filterStoreForSession, isOscRestrictedKvKey, listFirmOutlets, mergeStoreWrite } from '../tenantIsolation.js'
import {
  filterKvForRole,
  isAdminOnlyKvKey,
  isAdminUser,
  pickStoreForRole,
  redactFirmProfileForRole,
  requireAdminRole,
  requireKnownRole,
} from '../rbac.js'
import { letterheadRouter } from './letterhead.js'

export const dataRouter = Router()

dataRouter.use(requireAuth)
dataRouter.use(requireActiveTenant)
dataRouter.use(enforceTenantBody)
dataRouter.use(requireValidLicense)
dataRouter.use(requireLiveUser)
dataRouter.use(requireFreshPassword)
dataRouter.use(requireKnownRole)
dataRouter.use(letterheadRouter)

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

function asRev(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0
}

function toIso(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  const s = String(value || '').trim()
  return s || nowIso()
}

type StoreDocRow = { payload: unknown; rev: unknown; updated_at: unknown }

dataRouter.get('/store', async (req, res) => {
  const tenantId = req.user!.tenantId
  assertTenantId(tenantId)
  const centre = sessionCentre(req.user!)

  const { rows } = await pool.query(
    `SELECT payload, rev, updated_at FROM store_docs WHERE tenant_id = $1`,
    [tenantId],
  )
  const row = rows[0] as StoreDocRow | undefined

  if (!row) {
    const empty = emptyStorePayload()
    const updatedAt = nowIso()
    await pool.query(
      `INSERT INTO store_docs (tenant_id, payload, updated_at, rev) VALUES ($1, $2::jsonb, $3, 0)`,
      [tenantId, JSON.stringify(empty), updatedAt],
    )
    res.json({ data: pickStoreForRole(filterStoreForSession(empty, centre), req.user!.role), rev: 0, updatedAt })
    return
  }

  res.json({
    data: pickStoreForRole(filterStoreForSession(asJson(row.payload), centre), req.user!.role),
    rev: asRev(row.rev),
    updatedAt: toIso(row.updated_at),
  })
})

dataRouter.put('/store', async (req, res) => {
  const tenantId = req.user!.tenantId
  assertTenantId(tenantId)
  const centre = sessionCentre(req.user!)

  if (!req.body?.data || typeof req.body.data !== 'object') {
    res.status(400).json({ error: 'body.data object required' })
    return
  }

  const incoming = pickStoreForRole(req.body.data as Record<string, unknown>, req.user!.role)
  sanitizeXrfStorePayload(incoming)
  const baseRevRaw = req.body.baseRev
  const hasBaseRev = baseRevRaw !== undefined && baseRevRaw !== null && baseRevRaw !== ''
  const baseRev = hasBaseRev ? asRev(baseRevRaw) : null
  if (req.body.replaceAll === true) {
    if (!isAdminUser(req.user!) || centre.centreKind !== 'main') {
      res.status(403).json({ error: 'Only a centre administrator can replace the full store' })
      return
    }
  }
  const replaceAll = req.body.replaceAll === true && centre.centreKind === 'main' && isAdminUser(req.user!)

  const updatedAt = nowIso()
  const written = await withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT payload, rev, updated_at FROM store_docs WHERE tenant_id = $1 FOR UPDATE`,
      [tenantId],
    )
    const row = existing.rows[0] as StoreDocRow | undefined
    const currentRev = row ? asRev(row.rev) : 0
    const currentPayload = row ? asJson(row.payload) || emptyStorePayload() : emptyStorePayload()

    if (row && baseRev != null && baseRev !== currentRev) {
      return {
        stale: true as const,
        rev: currentRev,
        updatedAt: toIso(row.updated_at),
        payload: currentPayload,
      }
    }

    let payload: Record<string, unknown> = incoming
    if (!replaceAll) {
      payload = mergeStoreWrite(currentPayload, incoming, centre)
      sanitizeXrfStorePayload(payload)
    }

    const nextRev = row ? currentRev + 1 : 1
    await client.query(
      `INSERT INTO store_docs (tenant_id, payload, updated_at, rev) VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (tenant_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at, rev = EXCLUDED.rev`,
      [tenantId, JSON.stringify(payload), updatedAt, nextRev],
    )
    return { stale: false as const, rev: nextRev, updatedAt, payload }
  })

  if (written.stale) {
    res.status(409).json({
      error: 'Store was updated elsewhere',
      code: 'STALE_STORE',
      rev: written.rev,
      updatedAt: written.updatedAt,
      data: pickStoreForRole(filterStoreForSession(written.payload, centre), req.user!.role),
    })
    return
  }

  const payload = written.payload

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
        written.updatedAt,
      ],
    )
  }

  res.json({ ok: true, updatedAt: written.updatedAt, rev: written.rev })
})

dataRouter.get('/backup', requireAdminRole, async (req, res) => {
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
    tenantId,
    exportedAt: nowIso(),
    store: filterStoreForSession(asJson(storeRow.rows[0]?.payload) || emptyStorePayload(), centre),
    firm,
    kv: filterKvForRole(filterKvForSession(kv, centre.centreKind), req.user!),
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
  res.json({ docs: filterKvForRole(filterKvForSession(docs, centre.centreKind), req.user!) })
})

dataRouter.get('/kv/:key', async (req, res) => {
  const tenantId = req.user!.tenantId
  const centre = sessionCentre(req.user!)
  const key = String(req.params.key)
  if (isOscRestrictedKvKey(key, centre.centreKind) || (isAdminOnlyKvKey(key) && !isAdminUser(req.user!))) {
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
  if (isAdminOnlyKvKey(key) && !isAdminUser(req.user!)) {
    res.status(403).json({ error: 'Admin access required' })
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
  if (isAdminOnlyKvKey(key) && !isAdminUser(req.user!)) {
    res.status(403).json({ error: 'Admin access required' })
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
  res.json({ profile: redactFirmProfileForRole({ ...row, centres: filterFirmCentres(list, centre) }, req.user!) })
})

dataRouter.put('/firm-profile', requireAdminRole, async (req, res) => {
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
