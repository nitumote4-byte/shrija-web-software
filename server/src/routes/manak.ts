import { Router } from 'express'
import { z } from 'zod'
import { decryptSecret, encryptSecret } from '../crypto.js'
import { assertTenantId, nowIso, pool } from '../db.js'
import { enforceTenantBody, requireAuth } from '../middleware/auth.js'
import {
  completePortalFetch,
  demoRequests,
  fetchViaBridge,
  startPortalSession,
} from '../manak/client.js'
import type { ManakCredentialsStored } from '../manak/types.js'

export const manakRouter = Router()

manakRouter.use(requireAuth)
manakRouter.use(enforceTenantBody)

const KV_KEY = 'manak_credentials'

async function loadCreds(tenantId: string): Promise<ManakCredentialsStored | null> {
  const { rows } = await pool.query(
    `SELECT value FROM kv_docs WHERE tenant_id = $1 AND key = $2`,
    [tenantId, KV_KEY],
  )
  const row = rows[0] as { value: unknown } | undefined
  if (!row?.value) return null
  const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
  return value as ManakCredentialsStored
}

async function saveCreds(tenantId: string, creds: ManakCredentialsStored) {
  await pool.query(
    `INSERT INTO kv_docs (tenant_id, key, value, updated_at) VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [tenantId, KV_KEY, JSON.stringify(creds), nowIso()],
  )
}

manakRouter.get('/credentials', async (req, res) => {
  const tenantId = req.user!.tenantId
  assertTenantId(tenantId)
  const creds = await loadCreds(tenantId)
  res.json({
    username: creds?.username || '',
    baseUrl: creds?.baseUrl || 'https://huid.manakonline.in',
    bridgeUrl: creds?.bridgeUrl || '',
    hasPassword: Boolean(creds?.passwordEnc),
  })
})

const putSchema = z.object({
  username: z.string().min(1).max(120),
  password: z.string().max(200).optional(),
  baseUrl: z.string().max(300).optional(),
  bridgeUrl: z.string().max(500).optional(),
  clearPassword: z.boolean().optional(),
})

manakRouter.put('/credentials', async (req, res) => {
  const tenantId = req.user!.tenantId
  assertTenantId(tenantId)
  const parsed = putSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'username required' })
    return
  }

  const existing = await loadCreds(tenantId)
  let passwordEnc = existing?.passwordEnc || ''
  if (parsed.data.clearPassword) passwordEnc = ''
  if (parsed.data.password && parsed.data.password.length > 0) {
    passwordEnc = encryptSecret(parsed.data.password)
  }
  if (!passwordEnc) {
    res.status(400).json({ error: 'password required (first time)' })
    return
  }

  const creds: ManakCredentialsStored = {
    username: parsed.data.username.trim(),
    passwordEnc,
    baseUrl: (parsed.data.baseUrl || 'https://huid.manakonline.in').trim().replace(/\/$/, ''),
    bridgeUrl: (parsed.data.bridgeUrl || '').trim(),
    updatedAt: nowIso(),
  }
  await saveCreds(tenantId, creds)
  res.json({
    ok: true,
    username: creds.username,
    baseUrl: creds.baseUrl,
    bridgeUrl: creds.bridgeUrl,
    hasPassword: true,
  })
})

const fetchSchema = z.object({
  night: z.string().default('Night'),
  captchaText: z.string().optional(),
  sessionId: z.string().optional(),
  demo: z.boolean().optional(),
})

/**
 * Fetch flow:
 * 1) If demo=true → sample rows (testing only)
 * 2) If bridgeUrl set → POST bridge (Gold Shark PHP compatible)
 * 3) If sessionId + captcha → complete portal login & scrape tables
 * 4) Else start portal session (may return captcha image)
 */
manakRouter.post('/fetch', async (req, res) => {
  const tenantId = req.user!.tenantId
  assertTenantId(tenantId)
  const parsed = fetchSchema.safeParse(req.body || {})
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid fetch body' })
    return
  }

  const { night, captchaText, sessionId, demo } = parsed.data

  if (demo || process.env.MANAK_DEMO === '1') {
    res.json(demoRequests(night))
    return
  }

  const creds = await loadCreds(tenantId)
  if (!creds?.username || !creds.passwordEnc) {
    res.status(400).json({
      error: 'Save Manak Online username & password first (Auto Request → Manak settings).',
    })
    return
  }

  let password: string
  try {
    password = decryptSecret(creds.passwordEnc)
  } catch {
    res.status(500).json({ error: 'Could not decrypt stored Manak password. Re-save credentials.' })
    return
  }

  try {
    if (creds.bridgeUrl) {
      const result = await fetchViaBridge({
        bridgeUrl: creds.bridgeUrl,
        username: creds.username,
        password,
        night,
      })
      res.json(result)
      return
    }

    if (sessionId) {
      const result = await completePortalFetch({
        tenantId,
        sessionId,
        captchaText,
      })
      res.json(result)
      return
    }

    const started = await startPortalSession({
      tenantId,
      username: creds.username,
      password,
      baseUrl: creds.baseUrl,
    })
    res.json(started)
  } catch (e) {
    const status = (e as { status?: number })?.status || 502
    const message = e instanceof Error ? e.message : 'Manak fetch failed'
    res.status(status).json({ error: message })
  }
})
