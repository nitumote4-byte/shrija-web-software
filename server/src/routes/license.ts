import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { nowIso, pool, withTransaction } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import {
  addDaysIso,
  assertMaster,
  ensureLicenseSchema,
  generateLicenseCode,
  getTenantLicense,
  normalizeLicenseKey,
  type LicensePlan,
} from '../license.js'

export const licenseRouter = Router()

const issueLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many licence requests' },
})

async function ready() {
  await ensureLicenseSchema()
}

/** Public ping — proves licence router is mounted (no auth) */
licenseRouter.get('/ping', (_req, res) => {
  res.json({
    ok: true,
    service: 'license',
    hasLicenseMaster: Boolean(process.env.LICENSE_MASTER_SECRET),
  })
})

/** Current centre licence status */
licenseRouter.get('/status', requireAuth, async (req, res) => {
  await ready()
  const status = await getTenantLicense(req.user!.tenantId)
  if (!status) {
    res.status(404).json({ error: 'Centre not found' })
    return
  }
  res.json({ license: status })
})

const activateSchema = z.object({
  licenseKey: z.string().trim().min(8),
})

/** Activate / renew licence for the logged-in centre (admin only) */
licenseRouter.post('/activate', requireAuth, issueLimiter, async (req, res) => {
  await ready()
  if (!req.user!.isAdmin) {
    res.status(403).json({ error: 'Only centre admin can activate a licence' })
    return
  }
  const parsed = activateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'licenceKey is required' })
    return
  }
  const code = normalizeLicenseKey(parsed.data.licenseKey)
  const tenantId = req.user!.tenantId

  try {
    const result = await withTransaction(async (client) => {
      const keyRes = await client.query(
        `SELECT code, plan, duration_days AS "durationDays", max_users AS "maxUsers",
                used_by_tenant_id AS "usedBy"
         FROM license_keys WHERE code = $1 FOR UPDATE`,
        [code],
      )
      const key = keyRes.rows[0] as
        | {
            code: string
            plan: string
            durationDays: number
            maxUsers: number
            usedBy: string | null
          }
        | undefined

      if (!key) {
        return { error: 'Invalid licence key', status: 404 as const }
      }
      if (key.usedBy && key.usedBy !== tenantId) {
        return { error: 'This licence key is already used by another centre', status: 409 as const }
      }

      const tenantRes = await client.query(
        `SELECT license_expires_at AS "expiresAt" FROM tenants WHERE id = $1 FOR UPDATE`,
        [tenantId],
      )
      const tenant = tenantRes.rows[0] as { expiresAt: string | null } | undefined
      if (!tenant) {
        return { error: 'Centre not found', status: 404 as const }
      }

      const now = new Date()
      const base =
        tenant.expiresAt && new Date(tenant.expiresAt).getTime() > now.getTime()
          ? new Date(tenant.expiresAt)
          : now
      const expiresAt = addDaysIso(base, key.durationDays)
      const activatedAt = nowIso()
      const plan = (key.plan || 'standard') as LicensePlan

      await client.query(
        `UPDATE tenants SET
           plan = $2,
           status = 'active',
           license_key = $3,
           license_expires_at = $4,
           license_activated_at = $5,
           max_users = $6
         WHERE id = $1`,
        [tenantId, plan, key.code, expiresAt, activatedAt, key.maxUsers],
      )
      await client.query(
        `UPDATE license_keys SET used_by_tenant_id = $2, used_at = $3 WHERE code = $1`,
        [key.code, tenantId, activatedAt],
      )

      return {
        license: {
          ok: true,
          plan,
          status: 'active',
          licenseKey: key.code,
          expiresAt,
          activatedAt,
          maxUsers: key.maxUsers,
          daysLeft: key.durationDays,
          code: 'OK' as const,
        },
      }
    })

    if ('error' in result && result.error) {
      res.status(result.status || 400).json({ error: result.error })
      return
    }
    res.json(result)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to activate licence' })
  }
})

const issueSchema = z.object({
  plan: z.enum(['trial', 'standard', 'pro']).optional().default('standard'),
  durationDays: z.number().int().min(1).max(3650).optional().default(365),
  maxUsers: z.number().int().min(1).max(500).optional().default(10),
  count: z.number().int().min(1).max(50).optional().default(1),
  note: z.string().trim().max(200).optional().default(''),
  masterSecret: z.string().min(1),
})

/** Issue unused licence keys (platform operator — master secret) */
licenseRouter.post('/issue', issueLimiter, async (req, res) => {
  await ready()
  const parsed = issueSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' })
    return
  }
  if (!assertMaster(parsed.data.masterSecret)) {
    res.status(403).json({ error: 'Invalid master secret' })
    return
  }

  const keys: string[] = []
  const createdAt = nowIso()
  for (let i = 0; i < parsed.data.count; i++) {
    const code = generateLicenseCode()
    await pool.query(
      `INSERT INTO license_keys (code, plan, duration_days, max_users, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        code,
        parsed.data.plan,
        parsed.data.durationDays,
        parsed.data.maxUsers,
        parsed.data.note || '',
        createdAt,
      ],
    )
    keys.push(code)
  }
  res.status(201).json({
    keys,
    plan: parsed.data.plan,
    durationDays: parsed.data.durationDays,
    maxUsers: parsed.data.maxUsers,
  })
})

const listSchema = z.object({
  masterSecret: z.string().min(1),
})

licenseRouter.post('/issued', async (req, res) => {
  await ready()
  const parsed = listSchema.safeParse(req.body)
  if (!parsed.success || !assertMaster(parsed.data.masterSecret)) {
    res.status(403).json({ error: 'Invalid master secret' })
    return
  }
  const { rows } = await pool.query(
    `SELECT code, plan, duration_days AS "durationDays", max_users AS "maxUsers",
            note, created_at AS "createdAt",
            used_by_tenant_id AS "usedByTenantId", used_at AS "usedAt"
     FROM license_keys
     ORDER BY created_at DESC
     LIMIT 200`,
  )
  res.json({ keys: rows })
})
