import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db.js'
import { assertMaster, daysLeftFrom } from '../license.js'

export const adminRouter = Router()

const masterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin requests' },
})

const masterBodySchema = z.object({
  masterSecret: z.string().min(1),
})

const tenantIdSchema = z.string().trim().min(1).max(120)

function requireMaster(body: unknown): { ok: true } | { ok: false; status: number; error: string } {
  const parsed = masterBodySchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false, status: 400, error: 'masterSecret is required' }
  }
  if (!assertMaster(parsed.data.masterSecret)) {
    return { ok: false, status: 403, error: 'Invalid master secret' }
  }
  return { ok: true }
}

/** List all registered centres (including suspended) — master secret only */
adminRouter.post('/tenants', masterLimiter, async (req, res) => {
  const auth = requireMaster(req.body)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const { rows } = await pool.query(
    `SELECT id, slug, firm_name AS "firmName", gstin, plan, status,
            license_key AS "licenseKey",
            license_expires_at AS "licenseExpiresAt",
            license_activated_at AS "licenseActivatedAt",
            max_users AS "maxUsers",
            created_at AS "createdAt"
     FROM tenants
     ORDER BY lower(firm_name)`,
  )

  res.json({
    tenants: rows.map((row) => ({
      ...row,
      daysLeft: daysLeftFrom(row.licenseExpiresAt as string | null),
    })),
  })
})

/** Suspend one centre — sets tenants.status = 'suspended' only */
adminRouter.post('/tenants/:tenantId/suspend', masterLimiter, async (req, res) => {
  const auth = requireMaster(req.body)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const idParsed = tenantIdSchema.safeParse(req.params.tenantId)
  if (!idParsed.success) {
    res.status(400).json({ error: 'Invalid tenant ID' })
    return
  }
  const tenantId = idParsed.data

  const existing = await pool.query(
    `SELECT id, firm_name AS "firmName", status FROM tenants WHERE id = $1`,
    [tenantId],
  )
  const tenant = existing.rows[0] as
    | { id: string; firmName: string; status: string }
    | undefined

  if (!tenant) {
    res.status(404).json({ error: 'Centre not found' })
    return
  }

  if (tenant.status === 'suspended') {
    res.json({
      ok: true,
      tenant: { id: tenant.id, firmName: tenant.firmName, status: 'suspended' },
      message: 'Centre was already suspended',
    })
    return
  }

  await pool.query(`UPDATE tenants SET status = 'suspended' WHERE id = $1`, [tenantId])

  res.json({
    ok: true,
    tenant: { id: tenant.id, firmName: tenant.firmName, status: 'suspended' },
    message: 'Centre access suspended',
  })
})

/** Reactivate one centre — sets tenants.status = 'active' only */
adminRouter.post('/tenants/:tenantId/activate', masterLimiter, async (req, res) => {
  const auth = requireMaster(req.body)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const idParsed = tenantIdSchema.safeParse(req.params.tenantId)
  if (!idParsed.success) {
    res.status(400).json({ error: 'Invalid tenant ID' })
    return
  }
  const tenantId = idParsed.data

  const existing = await pool.query(
    `SELECT id, firm_name AS "firmName", status FROM tenants WHERE id = $1`,
    [tenantId],
  )
  const tenant = existing.rows[0] as
    | { id: string; firmName: string; status: string }
    | undefined

  if (!tenant) {
    res.status(404).json({ error: 'Centre not found' })
    return
  }

  if (tenant.status === 'active') {
    res.json({
      ok: true,
      tenant: { id: tenant.id, firmName: tenant.firmName, status: 'active' },
      message: 'Centre was already active',
    })
    return
  }

  await pool.query(`UPDATE tenants SET status = 'active' WHERE id = $1`, [tenantId])

  res.json({
    ok: true,
    tenant: { id: tenant.id, firmName: tenant.firmName, status: 'active' },
    message: 'Centre access restored',
  })
})
