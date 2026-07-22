import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import {
  assertTenantId,
  emptyStorePayload,
  nowIso,
  pool,
  uid,
  withTransaction,
} from '../db.js'
import { requireAuth, signToken, type AuthUser } from '../middleware/auth.js'

export const authRouter = Router()

/** Brute-force protection for auth endpoints */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
})

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'centre'
  )
}

/** Public: centres available for login picker */
authRouter.get('/tenants', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, slug, firm_name AS "firmName", gstin, plan, status, created_at AS "createdAt"
     FROM tenants
     WHERE status = 'active'
     ORDER BY lower(firm_name)`,
  )
  res.json({ tenants: rows })
})

const registerSchema = z.object({
  firmName: z.string().trim().min(1),
  gstin: z.string().trim().optional().default(''),
  adminUsername: z.string().trim().min(1),
  adminPassword: z.string().min(4),
  adminRole: z.string().optional().default('quality_manager'),
})

/** Register a new centre + admin user (empty isolated dataset) */
authRouter.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' })
    return
  }
  const { firmName, gstin, adminUsername, adminPassword, adminRole } = parsed.data
  const slug = slugify(firmName)

  const clash = await pool.query(
    `SELECT id FROM tenants WHERE slug = $1 OR lower(firm_name) = lower($2) LIMIT 1`,
    [slug, firmName],
  )
  if (clash.rows[0]) {
    res.status(409).json({ error: 'A centre with this name already exists' })
    return
  }

  const tenantId = uid('tn')
  const userId = uid('usr')
  const labId = uid('usr')
  const createdAt = nowIso()
  const hash = bcrypt.hashSync(adminPassword, 10)
  const labHash = bcrypt.hashSync('smg123', 10)
  const role = adminRole || 'quality_manager'

  try {
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO tenants (id, slug, firm_name, gstin, plan, status, created_at)
         VALUES ($1, $2, $3, $4, 'trial', 'active', $5)`,
        [tenantId, slug, firmName, gstin || '', createdAt],
      )
      await client.query(
        `INSERT INTO users (id, tenant_id, username, role, password_hash, is_admin, created_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
        [userId, tenantId, adminUsername, role, hash, createdAt],
      )
      await client.query(
        `INSERT INTO users (id, tenant_id, username, role, password_hash, is_admin, created_at)
         VALUES ($1, $2, 'SMG', 'assay_lab', $3, FALSE, $4)`,
        [labId, tenantId, labHash, createdAt],
      )
      await client.query(
        `INSERT INTO firm_profiles
         (tenant_id, firm_name, email, address, gst_no, bank_name, account_no, ifsc, city, state, updated_at)
         VALUES ($1, $2, '', '', $3, '', '', '', '', '', $4)`,
        [tenantId, firmName, gstin || '', createdAt],
      )
      await client.query(
        `INSERT INTO store_docs (tenant_id, payload, updated_at) VALUES ($1, $2::jsonb, $3)`,
        [tenantId, JSON.stringify(emptyStorePayload()), createdAt],
      )
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to create centre' })
    return
  }

  const authUser: AuthUser = {
    userId,
    tenantId,
    username: adminUsername,
    role,
    isAdmin: true,
    tenantName: firmName,
  }
  const token = signToken(authUser)
  res.status(201).json({
    token,
    session: {
      username: authUser.username,
      role: authUser.role,
      isAdmin: authUser.isAdmin,
      loggedInAt: createdAt,
      tenantId: authUser.tenantId,
      tenantName: authUser.tenantName,
    },
    tenant: {
      id: tenantId,
      slug,
      firmName,
      gstin: gstin || '',
      plan: 'trial',
      status: 'active',
      createdAt,
    },
  })
})

const loginSchema = z.object({
  tenantId: z.string().min(1),
  username: z.string().trim().min(1),
  password: z.string().min(1),
  asAdmin: z.boolean().optional().default(false),
})

authRouter.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'tenantId, username and password are required' })
    return
  }
  const { tenantId, username, password, asAdmin } = parsed.data

  const tenantRes = await pool.query(
    `SELECT id, firm_name AS "firmName", status FROM tenants WHERE id = $1`,
    [tenantId],
  )
  const tenant = tenantRes.rows[0] as { id: string; firmName: string; status: string } | undefined

  if (!tenant) {
    res.status(404).json({ error: 'Centre not found' })
    return
  }
  if (tenant.status !== 'active') {
    res.status(403).json({ error: 'This centre is suspended' })
    return
  }

  const userRes = await pool.query(
    `SELECT id, username, role, password_hash AS "passwordHash", is_admin AS "isAdmin"
     FROM users
     WHERE tenant_id = $1 AND lower(username) = lower($2)`,
    [tenantId, username],
  )
  const user = userRes.rows[0] as
    | { id: string; username: string; role: string; passwordHash: string; isAdmin: boolean }
    | undefined

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid username or password for this centre' })
    return
  }

  if (asAdmin && !(user.isAdmin || user.role === 'quality_manager' || user.role === 'admin')) {
    res.status(403).json({ error: 'Admin access denied for this user' })
    return
  }

  const authUser: AuthUser = {
    userId: user.id,
    tenantId: tenant.id,
    username: user.username,
    role: asAdmin ? 'admin' : user.role,
    isAdmin: Boolean(user.isAdmin) || asAdmin || user.role === 'quality_manager',
    tenantName: tenant.firmName,
  }
  const token = signToken(authUser)
  res.json({
    token,
    session: {
      username: authUser.username,
      role: authUser.role,
      isAdmin: authUser.isAdmin,
      loggedInAt: nowIso(),
      tenantId: authUser.tenantId,
      tenantName: authUser.tenantName,
    },
  })
})

authRouter.get('/me', requireAuth, (req, res) => {
  assertTenantId(req.user?.tenantId)
  res.json({
    session: {
      username: req.user!.username,
      role: req.user!.role,
      isAdmin: req.user!.isAdmin,
      loggedInAt: nowIso(),
      tenantId: req.user!.tenantId,
      tenantName: req.user!.tenantName,
    },
  })
})

authRouter.get('/users', requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId
  const { rows } = await pool.query(
    `SELECT id, username, role, is_admin AS "isAdmin", created_at AS "createdAt"
     FROM users WHERE tenant_id = $1 ORDER BY lower(username)`,
    [tenantId],
  )
  res.json({ users: rows })
})

const upsertUsersSchema = z.object({
  users: z.array(
    z.object({
      username: z.string().trim().min(1),
      role: z.string().min(1),
      password: z.string().min(1),
    }),
  ),
})

authRouter.put('/users', requireAuth, async (req, res) => {
  const tenantId = req.user!.tenantId
  const parsed = upsertUsersSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid users payload' })
    return
  }

  const existing = await pool.query(
    `SELECT username, password_hash AS "passwordHash" FROM users WHERE tenant_id = $1`,
    [tenantId],
  )
  const byName = new Map(
    (existing.rows as { username: string; passwordHash: string }[]).map((u) => [
      u.username.toLowerCase(),
      u.passwordHash,
    ]),
  )

  const createdAt = nowIso()
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM users WHERE tenant_id = $1`, [tenantId])
    for (const u of parsed.data.users) {
      const isAdmin = u.role === 'admin' || u.role === 'quality_manager'
      let hash: string
      if (u.password === '******') {
        hash = byName.get(u.username.toLowerCase()) || bcrypt.hashSync('admin123', 10)
      } else {
        hash = bcrypt.hashSync(u.password, 10)
      }
      await client.query(
        `INSERT INTO users (id, tenant_id, username, role, password_hash, is_admin, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uid('usr'), tenantId, u.username, u.role, hash, isAdmin, createdAt],
      )
    }
  })
  res.json({ ok: true })
})
