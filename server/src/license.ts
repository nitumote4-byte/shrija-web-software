import crypto from 'crypto'
import { pool } from './db.js'

function masterSecret() {
  return (
    process.env.LICENSE_MASTER_SECRET ||
    process.env.JWT_SECRET ||
    'shrija-dev-license-master'
  )
}

export type LicensePlan = 'trial' | 'standard' | 'pro'

export type TenantLicenseRow = {
  id: string
  firmName: string
  plan: string
  status: string
  licenseKey: string | null
  licenseExpiresAt: string | null
  licenseActivatedAt: string | null
  maxUsers: number | null
}

export type LicenseStatus = {
  ok: boolean
  plan: string
  status: string
  licenseKey: string | null
  expiresAt: string | null
  activatedAt: string | null
  maxUsers: number
  daysLeft: number | null
  reason?: string
  code?: 'OK' | 'EXPIRED' | 'SUSPENDED' | 'MISSING'
}

export function generateLicenseCode(): string {
  const raw = crypto.randomBytes(10).toString('hex').toUpperCase()
  // SHRIJA-XXXX-XXXX-XXXX-XXXX
  const parts = [
    raw.slice(0, 4),
    raw.slice(4, 8),
    raw.slice(8, 12),
    raw.slice(12, 16),
    raw.slice(16, 20),
  ]
  return `SHRIJA-${parts.join('-')}`
}

export function normalizeLicenseKey(key: string) {
  return key.trim().toUpperCase().replace(/\s+/g, '')
}

export async function ensureLicenseSchema() {
  await pool.query(`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS license_key TEXT,
      ADD COLUMN IF NOT EXISTS license_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS license_activated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS max_users INTEGER NOT NULL DEFAULT 10
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS license_keys (
      code TEXT PRIMARY KEY,
      plan TEXT NOT NULL DEFAULT 'standard',
      duration_days INTEGER NOT NULL DEFAULT 365,
      max_users INTEGER NOT NULL DEFAULT 10,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      used_by_tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
      used_at TIMESTAMPTZ
    )
  `)
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_license_keys_unused ON license_keys(used_by_tenant_id) WHERE used_by_tenant_id IS NULL`,
  )
}

export function daysLeftFrom(expiresAt: string | Date | null): number | null {
  if (!expiresAt) return null
  const end = new Date(expiresAt).getTime()
  if (Number.isNaN(end)) return null
  return Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000))
}

export function evaluateLicense(row: {
  plan: string
  status: string
  licenseExpiresAt: string | null
}): LicenseStatus {
  if (row.status !== 'active') {
    return {
      ok: false,
      plan: row.plan,
      status: row.status,
      licenseKey: null,
      expiresAt: row.licenseExpiresAt,
      activatedAt: null,
      maxUsers: 10,
      daysLeft: daysLeftFrom(row.licenseExpiresAt),
      reason: 'This centre is suspended',
      code: 'SUSPENDED',
    }
  }

  // Legacy / grandfathered: no expiry set → treat as valid
  if (!row.licenseExpiresAt) {
    return {
      ok: true,
      plan: row.plan || 'standard',
      status: row.status,
      licenseKey: null,
      expiresAt: null,
      activatedAt: null,
      maxUsers: 10,
      daysLeft: null,
      code: 'OK',
    }
  }

  const left = daysLeftFrom(row.licenseExpiresAt)
  if (left !== null && left < 0) {
    return {
      ok: false,
      plan: row.plan,
      status: row.status,
      licenseKey: null,
      expiresAt: row.licenseExpiresAt,
      activatedAt: null,
      maxUsers: 10,
      daysLeft: left,
      reason: 'Licence expired. Activate a new licence key to continue.',
      code: 'EXPIRED',
    }
  }

  return {
    ok: true,
    plan: row.plan,
    status: row.status,
    licenseKey: null,
    expiresAt: row.licenseExpiresAt,
    activatedAt: null,
    maxUsers: 10,
    daysLeft: left,
    code: 'OK',
  }
}

export async function getTenantLicense(tenantId: string): Promise<LicenseStatus | null> {
  const { rows } = await pool.query(
    `SELECT plan, status,
            license_key AS "licenseKey",
            license_expires_at AS "licenseExpiresAt",
            license_activated_at AS "licenseActivatedAt",
            max_users AS "maxUsers"
     FROM tenants WHERE id = $1`,
    [tenantId],
  )
  const row = rows[0] as
    | {
        plan: string
        status: string
        licenseKey: string | null
        licenseExpiresAt: string | null
        licenseActivatedAt: string | null
        maxUsers: number
      }
    | undefined
  if (!row) return null
  const base = evaluateLicense({
    plan: row.plan,
    status: row.status,
    licenseExpiresAt: row.licenseExpiresAt,
  })
  return {
    ...base,
    licenseKey: row.licenseKey,
    activatedAt: row.licenseActivatedAt,
    maxUsers: row.maxUsers ?? 10,
  }
}

export function assertMaster(secret: string | undefined): boolean {
  if (!secret) return false
  const expected = masterSecret()
  const a = crypto.createHash('sha256').update(secret).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

export function trialExpiryIso(days = 14): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

export function addDaysIso(from: Date, days: number): string {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}
