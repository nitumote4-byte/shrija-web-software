import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
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
import {
  requireAuth,
  requireActiveTenant,
  requireCentreAdmin,
  requireLiveUser,
  signToken,
  type AuthUser,
  enforceTenantBody,
} from '../middleware/auth.js'
import { assertMaster, evaluateLicense, getTenantLicense, trialExpiryIso } from '../license.js'
import { isMailConfigured, resetBaseUrl, sendPasswordResetEmail, PASSWORD_RESET_TTL_MINUTES } from '../mail.js'
import { MIN_PASSWORD_LENGTH, passwordPolicyError, strongPasswordSchema } from '../passwordPolicy.js'
import {
  GENERIC_LOGIN_ERROR,
  listFirmOutlets,
  mergeAssignedOscOutlets,
  ownTenantPublicView,
  resolveCentreFromList,
  selectPasswordMatch,
} from '../tenantIsolation.js'

export const authRouter = Router()

/** Brute-force protection for auth endpoints */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
})

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
})

const GENERIC_FORGOT_MESSAGE =
  'If the account exists, password reset instructions have been sent.'
const GENERIC_RESET_ERROR = 'Invalid or expired password reset link.'

function hashResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function newResetToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function isUsableEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Dummy hash so a missing username still pays bcrypt cost (enumeration resistance). */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('shrija-timing-dummy', 10)

async function usernameTakenByOtherTenant(username: string, tenantId?: string) {
  const { rows } = tenantId
    ? await pool.query(
        `SELECT 1 FROM users WHERE lower(username) = lower($1) AND tenant_id <> $2 LIMIT 1`,
        [username, tenantId],
      )
    : await pool.query(`SELECT 1 FROM users WHERE lower(username) = lower($1) LIMIT 1`, [username])
  return Boolean(rows[0])
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'centre'
  )
}

async function loadTenantOutlets(tenantId: string, firmName: string) {
  const { rows } = await pool.query(
    `SELECT firm_name AS "firmName", address, centres FROM firm_profiles WHERE tenant_id = $1`,
    [tenantId],
  )
  const row = rows[0] as
    | { firmName: string; address: string; centres: unknown }
    | undefined
  return listFirmOutlets(row?.centres, {
    name: row?.firmName || firmName,
    address: row?.address || '',
  })
}

async function resolveUserCentre(
  tenantId: string,
  firmName: string,
  centreId?: string | null,
): Promise<{ centreId: string; centreKind: 'main' | 'osc'; centreName: string }> {
  const list = await loadTenantOutlets(tenantId, firmName)
  return resolveCentreFromList(list, centreId, firmName)
}

/**
 * Authenticated: the caller's own centre only.
 * Unauthenticated callers receive 401 — never a global centre list.
 */
authRouter.get('/tenants', requireAuth, requireActiveTenant, enforceTenantBody, async (req, res) => {
  const tenantId = req.user!.tenantId
  assertTenantId(tenantId)
  const { rows } = await pool.query(
    `SELECT id, slug, firm_name AS "firmName", plan, status
     FROM tenants WHERE id = $1`,
    [tenantId],
  )
  const row = rows[0] as
    | { id: string; slug: string; firmName: string; plan: string; status: string }
    | undefined
  if (!row) {
    res.json({
      tenants: [
        ownTenantPublicView({
          id: tenantId,
          firmName: req.user!.tenantName,
        }),
      ],
    })
    return
  }
  res.json({ tenants: [ownTenantPublicView(row)] })
})

const registerSchema = z.object({
  masterSecret: z.string().min(1),
  firmName: z.string().trim().min(1),
  gstin: z.string().trim().optional().default(''),
  adminUsername: z.string().trim().min(1),
  adminPassword: z.string().min(MIN_PASSWORD_LENGTH).max(200),
  adminRole: z.string().optional().default('quality_manager'),
})

/** Register a new centre + admin user (empty isolated dataset). Platform operator only. */
authRouter.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' })
    return
  }
  if (!assertMaster(parsed.data.masterSecret)) {
    res.status(403).json({ error: 'Invalid master secret' })
    return
  }
  const { firmName, gstin, adminUsername, adminPassword, adminRole } = parsed.data
  const passwordErr = passwordPolicyError(adminPassword, adminUsername)
  if (passwordErr) {
    res.status(400).json({ error: passwordErr })
    return
  }
  const slug = slugify(firmName)

  const clash = await pool.query(
    `SELECT id FROM tenants WHERE slug = $1 OR lower(firm_name) = lower($2) LIMIT 1`,
    [slug, firmName],
  )
  if (clash.rows[0]) {
    res.status(409).json({ error: 'A centre with this name already exists' })
    return
  }
  if (await usernameTakenByOtherTenant(adminUsername)) {
    res.status(409).json({
      error: 'This admin username is already used by another centre. Choose a different username.',
    })
    return
  }

  const tenantId = uid('tn')
  const userId = uid('usr')
  const createdAt = nowIso()
  const trialEnds = trialExpiryIso(14)
  const hash = bcrypt.hashSync(adminPassword, 10)
  const role = adminRole || 'quality_manager'

  try {
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO tenants (id, slug, firm_name, gstin, plan, status, created_at, license_expires_at, max_users)
         VALUES ($1, $2, $3, $4, 'trial', 'active', $5, $6, 5)`,
        [tenantId, slug, firmName, gstin || '', createdAt, trialEnds],
      )
      await client.query(
        `INSERT INTO users (id, tenant_id, username, role, password_hash, is_admin, created_at, must_change_password)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6, FALSE)`,
        [userId, tenantId, adminUsername, role, hash, createdAt],
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
      licenseExpiresAt: trialEnds,
    },
  })
})

const loginSchema = z
  .object({
    username: z.string().trim().min(1),
    password: z.string().min(1),
  })
  .strip()

type LoginUserRow = {
  id: string
  username: string
  role: string
  passwordHash: string
  isAdmin: boolean
  centreId: string
  tenantId: string
  firmName: string
  status: string
  plan: string
  licenseExpiresAt: string | null
  mustChangePassword: boolean
}

authRouter.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Username and password are required' })
    return
  }
  const { username, password } = parsed.data

  const userRes = await pool.query(
    `SELECT u.id, u.username, u.role, u.password_hash AS "passwordHash",
            u.is_admin AS "isAdmin",
            COALESCE(u.centre_id, 'main') AS "centreId",
            COALESCE(u.must_change_password, FALSE) AS "mustChangePassword",
            t.id AS "tenantId", t.firm_name AS "firmName", t.status, t.plan,
            t.license_expires_at AS "licenseExpiresAt"
     FROM users u
     INNER JOIN tenants t ON t.id = u.tenant_id
     WHERE lower(u.username) = lower($1)`,
    [username],
  )
  const candidates = userRes.rows as LoginUserRow[]
  if (candidates.length === 0) {
    bcrypt.compareSync(password, DUMMY_PASSWORD_HASH)
  }
  const user = selectPasswordMatch(candidates, password, (plain, hash) =>
    bcrypt.compareSync(plain, hash),
  )

  if (!user) {
    res.status(401).json({ error: GENERIC_LOGIN_ERROR })
    return
  }

  if (user.status !== 'active') {
    res.status(403).json({ error: 'This centre is suspended', code: 'SUSPENDED' })
    return
  }

  const license = evaluateLicense({
    plan: user.plan,
    status: user.status,
    licenseExpiresAt: user.licenseExpiresAt,
  })
  // Expired centres can still log in to activate a new key (blocked from data APIs)

  const centre = await resolveUserCentre(user.tenantId, user.firmName, user.centreId)

  const authUser: AuthUser = {
    userId: user.id,
    tenantId: user.tenantId,
    username: user.username,
    role: user.role,
    isAdmin: Boolean(user.isAdmin) || user.role === 'quality_manager' || user.role === 'admin',
    tenantName: user.firmName,
    centreId: centre.centreId,
    centreKind: centre.centreKind,
    centreName: centre.centreName,
    mustChangePassword: Boolean(user.mustChangePassword),
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
      centreId: authUser.centreId,
      centreKind: authUser.centreKind,
      centreName: authUser.centreName,
      mustChangePassword: Boolean(authUser.mustChangePassword),
    },
    license,
  })
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(200),
})

/** Logged-in user may change only their own password (JWT user + tenant). */
authRouter.post(
  '/change-password',
  authLimiter,
  requireAuth,
  requireActiveTenant,
  enforceTenantBody,
  requireLiveUser,
  async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: `Current password and a new password (min ${MIN_PASSWORD_LENGTH} characters) are required`,
    })
    return
  }

  const tenantId = req.user!.tenantId
  const userId = req.user!.userId
  const { currentPassword, newPassword } = parsed.data
  const policyErr = passwordPolicyError(newPassword, req.user!.username)
  if (policyErr) {
    res.status(400).json({ error: policyErr })
    return
  }
  if (newPassword === currentPassword) {
    res.status(400).json({ error: 'New password must be different from the current password' })
    return
  }

  const { rows } = await pool.query(
    `SELECT id, password_hash AS "passwordHash"
     FROM users
     WHERE id = $1 AND tenant_id = $2`,
    [userId, tenantId],
  )
  const user = rows[0] as { id: string; passwordHash: string } | undefined
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    res.status(401).json({ error: 'Current password is incorrect' })
    return
  }

  const hash = bcrypt.hashSync(newPassword, 10)
  await pool.query(
    `UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2 AND tenant_id = $3`,
    [hash, userId, tenantId],
  )

  res.json({ ok: true, message: 'Password updated' })
})

const verifyPasswordSchema = z.object({
  password: z.string().min(1),
})

/** Confirm the signed-in user's own login password. Does not store or return the password. */
authRouter.post(
  '/verify-password',
  authLimiter,
  requireAuth,
  requireActiveTenant,
  enforceTenantBody,
  requireLiveUser,
  async (req, res) => {
  const parsed = verifyPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Password is required' })
    return
  }

  const tenantId = req.user!.tenantId
  const userId = req.user!.userId

  const { rows } = await pool.query(
    `SELECT id, password_hash AS "passwordHash"
     FROM users
     WHERE id = $1 AND tenant_id = $2`,
    [userId, tenantId],
  )
  const user = rows[0] as { id: string; passwordHash: string } | undefined
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (!bcrypt.compareSync(parsed.data.password, user.passwordHash)) {
    res.status(401).json({ error: 'Incorrect password' })
    return
  }

  res.json({ ok: true })
})

const forgotPasswordSchema = z.object({
  username: z.string().trim().min(1),
})

/** Unauthenticated recovery — always the same success body (no account enumeration). */
authRouter.post('/forgot-password', forgotLimiter, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Username is required' })
    return
  }

  if (!isMailConfigured()) {
    console.error(
      'Password reset requested but email is not configured. Set MAIL_HOST, MAIL_FROM, and FRONTEND_URL (or CORS_ORIGIN).',
    )
    res.status(503).json({
      error: 'Password reset by email is not available. Contact your centre administrator.',
    })
    return
  }

  const { username } = parsed.data

  try {
    const { rows } = await pool.query(
      `SELECT u.id AS "userId", u.username, t.id AS "tenantId", t.firm_name AS "firmName",
              t.status, COALESCE(fp.email, '') AS email
       FROM users u
       INNER JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN firm_profiles fp ON fp.tenant_id = t.id
       WHERE lower(u.username) = lower($1)`,
      [username],
    )
    const matches = rows as Array<{
      userId: string
      username: string
      tenantId: string
      firmName: string
      status: string
      email: string
    }>
    // Ambiguous usernames (legacy duplicates) do not receive mail — still generic success.
    const row = matches.length === 1 ? matches[0] : undefined
    const email = String(row?.email || '').trim()
    const canSend = Boolean(row && row.status === 'active' && isUsableEmail(email))

    if (row && canSend) {
      const token = newResetToken()
      const tokenHash = hashResetToken(token)
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000)

      await withTransaction(async (client) => {
        await client.query(
          `UPDATE password_reset_tokens
           SET used_at = NOW()
           WHERE tenant_id = $1 AND user_id = $2 AND used_at IS NULL`,
          [row.tenantId, row.userId],
        )
        await client.query(
          `INSERT INTO password_reset_tokens (id, tenant_id, user_id, token_hash, expires_at, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [uid('prt'), row.tenantId, row.userId, tokenHash, expiresAt.toISOString()],
        )
      })

      const resetUrl = `${resetBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`
      try {
        await sendPasswordResetEmail({
          to: email,
          resetUrl,
          username: row.username,
          centreName: row.firmName,
        })
      } catch {
        console.error('Password reset email failed')
      }
    }
  } catch {
    console.error('Password reset request failed')
  }

  res.json({ message: GENERIC_FORGOT_MESSAGE })
})

const resetPasswordSchema = z.object({
  token: z.string().min(16).max(400),
  password: strongPasswordSchema(),
})

authRouter.post('/reset-password', authLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    const onlyPassword = parsed.error.issues.every((issue) => issue.path[0] === 'password')
    if (onlyPassword) {
      res.status(400).json({
        error:
          parsed.error.issues[0]?.message ||
          `A new password (min ${MIN_PASSWORD_LENGTH} characters) is required`,
      })
      return
    }
    res.status(400).json({ error: GENERIC_RESET_ERROR })
    return
  }

  const { token, password } = parsed.data
  const tokenHash = hashResetToken(token)

  try {
    await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, tenant_id AS "tenantId", user_id AS "userId",
                expires_at AS "expiresAt", used_at AS "usedAt"
         FROM password_reset_tokens
         WHERE token_hash = $1
         FOR UPDATE`,
        [tokenHash],
      )
      const tok = rows[0] as
        | {
            id: string
            tenantId: string
            userId: string
            expiresAt: Date | string
            usedAt: Date | string | null
          }
        | undefined

      if (!tok || tok.usedAt || new Date(tok.expiresAt).getTime() <= Date.now()) {
        throw Object.assign(new Error('INVALID_RESET'), { status: 400 })
      }

      const tenantRes = await client.query(`SELECT status FROM tenants WHERE id = $1`, [tok.tenantId])
      const tenant = tenantRes.rows[0] as { status: string } | undefined
      if (!tenant || tenant.status !== 'active') {
        throw Object.assign(new Error('INVALID_RESET'), { status: 400 })
      }

      const userRes = await client.query(
        `SELECT id FROM users WHERE id = $1 AND tenant_id = $2`,
        [tok.userId, tok.tenantId],
      )
      if (!userRes.rows[0]) {
        throw Object.assign(new Error('INVALID_RESET'), { status: 400 })
      }

      const passwordHash = bcrypt.hashSync(password, 10)
      await client.query(
        `UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2 AND tenant_id = $3`,
        [passwordHash, tok.userId, tok.tenantId],
      )
      await client.query(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE tenant_id = $1 AND user_id = $2 AND used_at IS NULL`,
        [tok.tenantId, tok.userId],
      )
    })
  } catch (e) {
    if ((e as { message?: string })?.message !== 'INVALID_RESET') {
      console.error('Password reset failed')
    }
    res.status(400).json({ error: GENERIC_RESET_ERROR })
    return
  }

  res.json({ ok: true, message: 'Password has been reset. You can now sign in.' })
})

authRouter.get('/me', requireAuth, enforceTenantBody, requireLiveUser, async (req, res) => {
  assertTenantId(req.user?.tenantId)
  const license = await getTenantLicense(req.user!.tenantId)
  res.json({
    session: {
      username: req.user!.username,
      role: req.user!.role,
      isAdmin: req.user!.isAdmin,
      loggedInAt: nowIso(),
      tenantId: req.user!.tenantId,
      tenantName: req.user!.tenantName,
      centreId: req.user!.centreId || 'main',
      centreKind: req.user!.centreKind || 'main',
      centreName: req.user!.centreName || req.user!.tenantName,
      mustChangePassword: Boolean(req.user!.mustChangePassword),
    },
    license,
  })
})

authRouter.get(
  '/users',
  requireAuth,
  requireActiveTenant,
  enforceTenantBody,
  requireLiveUser,
  requireCentreAdmin,
  async (req, res) => {
  const tenantId = req.user!.tenantId
  const { rows } = await pool.query(
    `SELECT id, username, role, is_admin AS "isAdmin",
            COALESCE(centre_id, 'main') AS "centreId",
            created_at AS "createdAt"
     FROM users WHERE tenant_id = $1 ORDER BY lower(username)`,
    [tenantId],
  )
  const outlets = mergeAssignedOscOutlets(
    await loadTenantOutlets(tenantId, req.user!.tenantName),
    (rows as { centreId?: string }[]).map((u) => u.centreId),
  )
  res.json({ users: rows, centres: outlets })
})

const upsertUsersSchema = z.object({
  users: z.array(
    z.object({
      username: z.string().trim().min(1),
      role: z.string().min(1),
      password: z.string().min(1),
      centreId: z.string().trim().optional().default('main'),
    }),
  ),
})

type ExistingUserRow = {
  id: string
  username: string
  passwordHash: string
  centreId: string
  mustChangePassword: boolean
}

authRouter.put(
  '/users',
  requireAuth,
  requireActiveTenant,
  enforceTenantBody,
  requireLiveUser,
  requireCentreAdmin,
  async (req, res) => {
  const tenantId = req.user!.tenantId
  const parsed = upsertUsersSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid users payload' })
    return
  }

  const lic = await getTenantLicense(tenantId)
  const maxUsers = lic?.maxUsers ?? 10
  if (parsed.data.users.length > maxUsers) {
    res.status(403).json({
      error: `Licence allows max ${maxUsers} users (trying to save ${parsed.data.users.length})`,
      code: 'USER_LIMIT',
    })
    return
  }

  const existing = await pool.query(
    `SELECT id, username, password_hash AS "passwordHash",
            COALESCE(centre_id, 'main') AS "centreId",
            COALESCE(must_change_password, FALSE) AS "mustChangePassword"
     FROM users WHERE tenant_id = $1`,
    [tenantId],
  )
  const existingRows = existing.rows as ExistingUserRow[]
  const byName = new Map(existingRows.map((u) => [u.username.toLowerCase(), u]))

  const incomingNames = new Set(parsed.data.users.map((u) => u.username.toLowerCase()))
  const selfRow = existingRows.find((u) => u.id === req.user!.userId)
  if (selfRow && !incomingNames.has(selfRow.username.toLowerCase())) {
    res.status(400).json({ error: 'You cannot remove your own login while signed in' })
    return
  }

  for (const u of parsed.data.users) {
    const alreadyOurs = byName.has(u.username.toLowerCase())
    if (!alreadyOurs && (await usernameTakenByOtherTenant(u.username, tenantId))) {
      res.status(409).json({
        error: `Username "${u.username}" is already used by another centre. Choose a different username.`,
      })
      return
    }
  }

  const outlets = mergeAssignedOscOutlets(
    await loadTenantOutlets(tenantId, req.user!.tenantName),
    existingRows.map((u) => u.centreId),
  )
  const allowed = new Set(outlets.map((c) => c.id))
  allowed.add('main')
  for (const row of existingRows) {
    const id = String(row.centreId || '').trim()
    if (id) allowed.add(id)
  }

  for (const u of parsed.data.users) {
    const centreId = (u.centreId || 'main').trim() || 'main'
    if (!allowed.has(centreId)) {
      res.status(400).json({ error: `Unknown centre / outlet "${centreId}" for this tenant` })
      return
    }
    const found = outlets.find((c) => c.id === centreId)
    if (found?.kind === 'osc' && /^(assay_lab|in_lab|inlab)$/i.test(u.role)) {
      res.status(400).json({ error: 'Off-Site users cannot be In Lab — lab stays at Main Centre' })
      return
    }
  }

  const nextRows: Array<{
    id: string
    username: string
    role: string
    hash: string
    isAdmin: boolean
    centreId: string
    mustChange: boolean
    createdAt: string
  }> = []

  const createdAt = nowIso()
  for (const u of parsed.data.users) {
    const prev = byName.get(u.username.toLowerCase())
    const isAdmin = u.role === 'admin' || u.role === 'quality_manager'
    let hash: string
    let mustChange: boolean
    if (u.password === '******') {
      if (!prev?.passwordHash) {
        res.status(400).json({
          error: `Set a password for "${u.username}" (placeholder cannot be used for a new or renamed user)`,
        })
        return
      }
      hash = prev.passwordHash
      mustChange = Boolean(prev.mustChangePassword)
    } else {
      const policyErr = passwordPolicyError(u.password, u.username)
      if (policyErr) {
        res.status(400).json({ error: policyErr })
        return
      }
      hash = bcrypt.hashSync(u.password, 10)
      mustChange = prev?.id !== req.user!.userId
    }
    nextRows.push({
      id: prev?.id || uid('usr'),
      username: u.username,
      role: u.role,
      hash,
      isAdmin,
      centreId: (u.centreId || 'main').trim() || 'main',
      mustChange,
      createdAt,
    })
  }

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM users WHERE tenant_id = $1`, [tenantId])
    for (const u of nextRows) {
      await client.query(
        `INSERT INTO users (id, tenant_id, username, role, password_hash, is_admin, centre_id, created_at, must_change_password)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [u.id, tenantId, u.username, u.role, u.hash, u.isAdmin, u.centreId, u.createdAt, u.mustChange],
      )
    }
  })
  res.json({ ok: true })
})
