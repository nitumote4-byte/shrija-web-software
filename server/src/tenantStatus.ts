/**
 * Live tenant status for already-issued JWTs.
 * JWTs last 12h; suspension must still take effect on the next protected request.
 * Cache is short-lived and is invalidated immediately on suspend/reactivate.
 */
import { pool } from './db.js'

const STATUS_TTL_MS = 5_000

type CacheEntry = { status: string; expiresAt: number }

const statusCache = new Map<string, CacheEntry>()

async function loadTenantStatusFromDb(tenantId: string): Promise<string | null> {
  const { rows } = await pool.query(`SELECT status FROM tenants WHERE id = $1`, [tenantId])
  const row = rows[0] as { status?: string } | undefined
  return row?.status ? String(row.status) : null
}

export function invalidateTenantStatus(tenantId?: string) {
  if (tenantId) statusCache.delete(tenantId)
  else statusCache.clear()
}

/** Test helper — seeds status without PostgreSQL. */
export function seedTenantStatusCache(tenantId: string, status: string) {
  statusCache.set(tenantId, { status, expiresAt: Date.now() + STATUS_TTL_MS })
}

export async function getCachedTenantStatus(tenantId: string): Promise<string | null> {
  const hit = statusCache.get(tenantId)
  if (hit && hit.expiresAt > Date.now()) return hit.status

  const status = await loadTenantStatusFromDb(tenantId)
  if (status) {
    statusCache.set(tenantId, { status, expiresAt: Date.now() + STATUS_TTL_MS })
  } else {
    statusCache.delete(tenantId)
  }
  return status
}
