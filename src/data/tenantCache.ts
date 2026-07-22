/**
 * In-memory tenant cache hydrated from the API.
 * Pages keep sync read/write; mutations flush to the server with JWT tenant_id.
 */
import { api, getToken } from '../api/client'

type StoreShape = Record<string, unknown>

let storeCache: StoreShape | null = null
const kvCache = new Map<string, string>()
let firmCache: Record<string, unknown> | null = null
let hydrated = false
let hydratePromise: Promise<void> | null = null

export function resetTenantCache() {
  storeCache = null
  kvCache.clear()
  firmCache = null
  hydrated = false
  hydratePromise = null
}

export function isTenantHydrated() {
  return hydrated
}

export async function hydrateTenantData() {
  if (!getToken()) {
    resetTenantCache()
    return
  }
  if (hydratePromise) return hydratePromise

  hydratePromise = (async () => {
    const [storeRes, kvRes, firmRes] = await Promise.all([
      api<{ data: StoreShape }>('/api/data/store'),
      api<{ docs: Record<string, unknown> }>('/api/data/kv'),
      api<{ profile: Record<string, unknown> }>('/api/data/firm-profile'),
    ])
    storeCache = storeRes.data
    kvCache.clear()
    for (const [key, value] of Object.entries(kvRes.docs || {})) {
      kvCache.set(key, typeof value === 'string' ? value : JSON.stringify(value))
    }
    firmCache = firmRes.profile || null
    hydrated = true
  })()

  try {
    await hydratePromise
  } catch (e) {
    hydratePromise = null
    throw e
  }
  return
}

export function getStoreCache<T extends StoreShape>(): T | null {
  return storeCache as T | null
}

export function setStoreCache(data: StoreShape) {
  storeCache = data
  void flushStore()
}

async function flushStore() {
  if (!storeCache || !getToken()) return
  try {
    await api('/api/data/store', { method: 'PUT', json: { data: storeCache } })
  } catch (e) {
    console.error('Failed to persist store', e)
  }
}

/** Logical key like shrija-staff → stored as staff on server */
export function normalizeKvKey(key: string) {
  return key.startsWith('shrija-') ? key.slice('shrija-'.length) : key
}

export function tenantGet(key: string): string | null {
  return kvCache.get(normalizeKvKey(key)) ?? null
}

export function tenantSet(key: string, value: string) {
  const k = normalizeKvKey(key)
  kvCache.set(k, value)
  void api(`/api/data/kv/${encodeURIComponent(k)}`, {
    method: 'PUT',
    json: { value: tryParse(value) },
  }).catch((e) => console.error('Failed to persist kv', k, e))
}

export function tenantRemove(key: string) {
  const k = normalizeKvKey(key)
  kvCache.delete(k)
  void api(`/api/data/kv/${encodeURIComponent(k)}`, { method: 'DELETE' }).catch(() => {})
}

function tryParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export function getFirmCache() {
  return firmCache
}

export function setFirmCache(profile: Record<string, unknown>) {
  firmCache = profile
  void api('/api/data/firm-profile', { method: 'PUT', json: profile }).catch((e) =>
    console.error('Failed to persist firm profile', e),
  )
}
