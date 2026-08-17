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

function audit(action: string, tenantId: string, firmName: string, detail?: string) {
  console.info(
    `[admin] ${action} tenant=${tenantId} firm=${JSON.stringify(firmName)}${detail ? ` ${detail}` : ''} at=${new Date().toISOString()}`,
  )
}

/** List all registered centres (including suspended) — master secret only */
adminRouter.post('/tenants', masterLimiter, async (req, res) => {
  const auth = requireMaster(req.body)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const { rows } = await pool.query(
    `SELECT t.id, t.slug, t.firm_name AS "firmName", t.gstin, t.plan, t.status,
            t.license_key AS "licenseKey",
            t.license_expires_at AS "licenseExpiresAt",
            t.license_activated_at AS "licenseActivatedAt",
            t.max_users AS "maxUsers",
            t.created_at AS "createdAt",
            admin.username AS "adminUsername",
            COALESCE(fp.email, '') AS "adminEmail"
     FROM tenants t
     LEFT JOIN LATERAL (
       SELECT username
       FROM users
       WHERE tenant_id = t.id AND is_admin = TRUE
       ORDER BY created_at ASC
       LIMIT 1
     ) admin ON TRUE
     LEFT JOIN firm_profiles fp ON fp.tenant_id = t.id
     ORDER BY lower(t.firm_name)`,
  )

  audit('list_centres', '-', 'all', `count=${rows.length}`)

  res.json({
    tenants: rows.map((row) => ({
      ...row,
      daysLeft: daysLeftFrom(row.licenseExpiresAt as string | null),
    })),
  })
})

async function loadTenantBrief(tenantId: string) {
  const existing = await pool.query(
    `SELECT id, firm_name AS "firmName", status FROM tenants WHERE id = $1`,
    [tenantId],
  )
  return existing.rows[0] as { id: string; firmName: string; status: string } | undefined
}

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

  const tenant = await loadTenantBrief(tenantId)
  if (!tenant) {
    res.status(404).json({ error: 'Centre not found' })
    return
  }

  if (tenant.status === 'suspended') {
    audit('suspend_noop', tenant.id, tenant.firmName, 'already_suspended')
    res.json({
      ok: true,
      tenant: { id: tenant.id, firmName: tenant.firmName, status: 'suspended' },
      message: 'Centre was already suspended',
    })
    return
  }

  await pool.query(`UPDATE tenants SET status = 'suspended' WHERE id = $1`, [tenantId])
  audit('suspend', tenant.id, tenant.firmName)

  res.json({
    ok: true,
    tenant: { id: tenant.id, firmName: tenant.firmName, status: 'suspended' },
    message: 'Centre access suspended',
  })
})

async function reactivateTenant(req: import('express').Request, res: import('express').Response) {
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

  const tenant = await loadTenantBrief(tenantId)
  if (!tenant) {
    res.status(404).json({ error: 'Centre not found' })
    return
  }

  if (tenant.status === 'active') {
    audit('reactivate_noop', tenant.id, tenant.firmName, 'already_active')
    res.json({
      ok: true,
      tenant: { id: tenant.id, firmName: tenant.firmName, status: 'active' },
      message: 'Centre was already active',
    })
    return
  }

  await pool.query(`UPDATE tenants SET status = 'active' WHERE id = $1`, [tenantId])
  audit('reactivate', tenant.id, tenant.firmName)

  res.json({
    ok: true,
    tenant: { id: tenant.id, firmName: tenant.firmName, status: 'active' },
    message: 'Centre access restored',
  })
}

/** Reactivate one centre — sets tenants.status = 'active' only */
adminRouter.post('/tenants/:tenantId/activate', masterLimiter, reactivateTenant)
/** Alias preferred by operators */
adminRouter.post('/tenants/:tenantId/reactivate', masterLimiter, reactivateTenant)
