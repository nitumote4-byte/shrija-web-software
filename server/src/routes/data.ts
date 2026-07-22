import { Router } from 'express'
import { z } from 'zod'
import { assertTenantId, emptyStorePayload, nowIso, pool } from '../db.js'
import { enforceTenantBody, requireAuth, requireValidLicense } from '../middleware/auth.js'

export const dataRouter = Router()

dataRouter.use(requireAuth)
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
    res.json({ data: empty })
    return
  }

  res.json({ data: asJson(row.payload) })
})

dataRouter.put('/store', async (req, res) => {
  const tenantId = req.user!.tenantId
  assertTenantId(tenantId)

  if (!req.body?.data || typeof req.body.data !== 'object') {
    res.status(400).json({ error: 'body.data object required' })
    return
  }

  const updatedAt = nowIso()
  await pool.query(
    `INSERT INTO store_docs (tenant_id, payload, updated_at) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (tenant_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
    [tenantId, JSON.stringify(req.body.data), updatedAt],
  )

  // Normalize requests into job_docs for reporting / future queries
  const requests = Array.isArray((req.body.data as { requests?: unknown }).requests)
    ? ((req.body.data as { requests: Record<string, unknown>[] }).requests)
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
  const storeRow = await pool.query(`SELECT payload FROM store_docs WHERE tenant_id = $1`, [tenantId])
  const firmRow = await pool.query(
    `SELECT firm_name AS "firmName", email, address, gst_no AS "gstNo",
            bank_name AS "bankName", account_no AS "accountNo", ifsc, city, state
     FROM firm_profiles WHERE tenant_id = $1`,
    [tenantId],
  )
  const kvRows = await pool.query(`SELECT key, value FROM kv_docs WHERE tenant_id = $1`, [tenantId])
  const kv: Record<string, unknown> = {}
  for (const row of kvRows.rows as { key: string; value: unknown }[]) {
    kv[row.key] = asJson(row.value)
  }
  res.json({
    version: 1,
    exportedAt: nowIso(),
    store: asJson(storeRow.rows[0]?.payload) || emptyStorePayload(),
    firm: firmRow.rows[0] || null,
    kv,
  })
})

dataRouter.get('/kv', async (req, res) => {
  const tenantId = req.user!.tenantId
  const { rows } = await pool.query(`SELECT key, value FROM kv_docs WHERE tenant_id = $1`, [
    tenantId,
  ])

  const docs: Record<string, unknown> = {}
  for (const row of rows as { key: string; value: unknown }[]) {
    docs[row.key] = asJson(row.value)
  }
  res.json({ docs })
})

dataRouter.get('/kv/:key', async (req, res) => {
  const tenantId = req.user!.tenantId
  const key = String(req.params.key)
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
  const key = String(req.params.key)
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
  const key = String(req.params.key)
  await pool.query(`DELETE FROM kv_docs WHERE tenant_id = $1 AND key = $2`, [tenantId, key])
  res.json({ ok: true })
})

dataRouter.get('/firm-profile', async (req, res) => {
  const tenantId = req.user!.tenantId
  const { rows } = await pool.query(
    `SELECT firm_name AS "firmName", email, address, gst_no AS "gstNo",
            bank_name AS "bankName", account_no AS "accountNo", ifsc, city, state
     FROM firm_profiles WHERE tenant_id = $1`,
    [tenantId],
  )
  res.json({ profile: rows[0] || { firmName: req.user!.tenantName } })
})

dataRouter.put('/firm-profile', async (req, res) => {
  const tenantId = req.user!.tenantId
  const p = req.body || {}
  const firmName = String(p.firmName || '').trim() || req.user!.tenantName
  const updatedAt = nowIso()

  await pool.query(
    `INSERT INTO firm_profiles
     (tenant_id, firm_name, email, address, gst_no, bank_name, account_no, ifsc, city, state, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      updatedAt,
    ],
  )

  await pool.query(`UPDATE tenants SET firm_name = $1, gstin = $2 WHERE id = $3`, [
    firmName,
    String(p.gstNo || ''),
    tenantId,
  ])

  res.json({ ok: true, profile: { ...p, firmName } })
})
