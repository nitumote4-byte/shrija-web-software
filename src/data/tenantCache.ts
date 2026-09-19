/**
 * In-memory tenant cache hydrated from the API.
 * Pages keep sync read/write; mutations flush to the server with JWT tenant_id.
 */
import { api, ApiRequestError, getToken, readStoredSession } from '../api/client'
import { fetchLetterhead, resetLetterheadCache } from './letterhead'
import { INVOICE_TOMBSTONES_KEY, tombstoneIds } from './invoiceTombstones'
import {
  applyPendingInvoiceTombstonesToStore,
  clearAllPendingInvoiceTombstones,
  clearPendingInvoiceTombstones,
  type PendingTombstoneScope,
} from './pendingInvoiceTombstones'
import {
  applyPendingFinancialTombstonesToStore,
  clearAllPendingFinancialTombstones,
  clearConfirmedPendingFinancialTombstones,
  type PendingFinancialTombstoneScope,
} from './pendingFinancialTombstones'
import { unionCentreScopedStore } from './storeMerge'
import {
  applyPendingKvToDocs,
  clearPendingKvKeys,
  rememberPendingKvRemove,
  rememberPendingKvSet,
  type PendingKvScope,
} from './pendingKv'

type StoreShape = Record<string, unknown>

type StoreWriteResult = { ok: true; rev: number; updatedAt?: string }

export const STORE_PERSIST_EVENT = 'shrija:store-persist'
export const KV_PERSIST_EVENT = 'shrija:kv-persist'

let storeCache: StoreShape | null = null
const kvCache = new Map<string, string>()
let firmCache: Record<string, unknown> | null = null
let hydrated = false
let hydratePromise: Promise<void> | null = null
/** Bumps on every store mutation — used to invalidate scoped UI caches. */
let storeVersion = 0
/** Server store_docs.rev from last successful GET/PUT. */
let storeRev = 0
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushInFlight: Promise<{ ok: boolean; message?: string }> | null = null
let flushQueued = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let kvFlushTimer: ReturnType<typeof setTimeout> | null = null
let kvFlushInFlight: Promise<{ ok: boolean; message?: string }> | null = null
let kvFlushQueued = false
let kvRetryTimer: ReturnType<typeof setTimeout> | null = null
const FLUSH_DEBOUNCE_MS = 450
const FLUSH_RETRY_MS = 2000
const STALE_RETRY_LIMIT = 5
const KV_FLUSH_DEBOUNCE_MS = 350

export function getStoreVersion() {
  return storeVersion
}

export function getStoreRev() {
  return storeRev
}

/** Bumps when a Fire Assay sheet is published so Request List / QM / Billing re-read archive values. */
let fireAssayArchiveVersion = 0

export function getFireAssayArchiveVersion() {
  return fireAssayArchiveVersion
}

export function bumpFireAssayArchiveVersion() {
  fireAssayArchiveVersion += 1
}

function emitPersist(ok: boolean, message?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(STORE_PERSIST_EVENT, { detail: { ok, message } }))
}

function currentStoreScope(): (PendingTombstoneScope & PendingFinancialTombstoneScope) | null {
  const session = readStoredSession()
  if (!session?.tenantId) return null
  const centreId = session.centreId || 'main'
  const centreKind = session.centreKind === 'osc' ? 'osc' : 'main'
  return { tenantId: session.tenantId, centreId, centreKind }
}

function currentKvScope(): PendingKvScope | null {
  const session = readStoredSession()
  if (!session?.tenantId) return null
  return { tenantId: session.tenantId }
}

function emitKvPersist(ok: boolean, message?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(KV_PERSIST_EVENT, { detail: { ok, message } }))
}

function clearPendingForSuccessfulSnapshot(snapshot: StoreShape, replaceAll: boolean) {
  const scope = currentStoreScope()
  if (!scope) return
  if (replaceAll) {
    clearAllPendingInvoiceTombstones(scope)
    clearAllPendingFinancialTombstones(scope)
    return
  }
  clearPendingInvoiceTombstones(scope, tombstoneIds(snapshot[INVOICE_TOMBSTONES_KEY]))
  clearConfirmedPendingFinancialTombstones(scope, snapshot)
}

export function resetTenantCache() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  if (kvFlushTimer) {
    clearTimeout(kvFlushTimer)
    kvFlushTimer = null
  }
  if (kvRetryTimer) {
    clearTimeout(kvRetryTimer)
    kvRetryTimer = null
  }
  flushQueued = false
  kvFlushQueued = false
  storeCache = null
  storeRev = 0
  kvCache.clear()
  firmCache = null
  resetLetterheadCache()
  hydrated = false
  hydratePromise = null
  storeVersion += 1
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
      api<{ data: StoreShape; rev?: number }>('/api/data/store'),
      api<{ docs: Record<string, unknown> }>('/api/data/kv'),
      api<{ profile: Record<string, unknown> }>('/api/data/firm-profile'),
      fetchLetterhead(true).catch(() => null),
    ])
    let data = storeRes.data
    const scope = currentStoreScope()
    let outstandingPending = false
    if (scope) {
      const recoveredInvoices = applyPendingInvoiceTombstonesToStore(data, scope)
      data = recoveredInvoices.store
      const serverTombIds = tombstoneIds(storeRes.data[INVOICE_TOMBSTONES_KEY])
      const confirmed = recoveredInvoices.applied
        .filter((row) => serverTombIds.has(row.id))
        .map((row) => row.id)
      if (confirmed.length) clearPendingInvoiceTombstones(scope, confirmed)
      outstandingPending = recoveredInvoices.applied.some((row) => !serverTombIds.has(row.id))

      const recoveredFinancial = applyPendingFinancialTombstonesToStore(data, scope)
      data = recoveredFinancial.store
      clearConfirmedPendingFinancialTombstones(scope, storeRes.data)
      if (
        recoveredFinancial.applied.some((row) => !confirmedFinancialOnServer(storeRes.data, row))
      ) {
        outstandingPending = true
      }
    }
    storeCache = data
    storeRev = Number.isFinite(Number(storeRes.rev)) ? Number(storeRes.rev) : 0
    storeVersion += 1
    const serverKv: Record<string, string> = {}
    for (const [key, value] of Object.entries(kvRes.docs || {})) {
      serverKv[key] = typeof value === 'string' ? value : JSON.stringify(value)
    }
    const kvScope = currentKvScope()
    const mergedKv = kvScope
      ? applyPendingKvToDocs(serverKv, kvScope)
      : { docs: serverKv, dirtyKeys: [] as string[] }
    kvCache.clear()
    for (const [key, value] of Object.entries(mergedKv.docs)) {
      kvCache.set(key, value)
    }
    firmCache = firmRes.profile || null
    hydrated = true
    if (outstandingPending) void flushStore()
    if (mergedKv.dirtyKeys.length) void flushPendingKv()
  })()

  try {
    await hydratePromise
  } catch (e) {
    hydratePromise = null
    throw e
  }
  return
}

function confirmedFinancialOnServer(
  server: StoreShape,
  row: { entity: string; id: string },
): boolean {
  const key =
    row.entity === 'funds'
      ? 'deletedFunds'
      : row.entity === 'expenses'
        ? 'deletedExpenses'
        : 'deletedMonthlyInvoices'
  const list = Array.isArray(server[key]) ? (server[key] as { id?: string }[]) : []
  return list.some((t) => t.id === row.id)
}

export function getStoreCache<T extends StoreShape>(): T | null {
  return storeCache as T | null
}

export function setStoreCache(data: StoreShape) {
  storeCache = data
  storeVersion += 1
  if (flushInFlight) {
    flushQueued = true
    return
  }
  scheduleFlush()
}

function scheduleFlush() {
  if (!getToken()) return
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushStore()
  }, FLUSH_DEBOUNCE_MS)
}

function scheduleRetry() {
  if (retryTimer || !getToken() || !storeCache) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    void flushStore()
  }, FLUSH_RETRY_MS)
}

type FlushOpts = { replaceAll?: boolean }

type FlushResult = { ok: boolean; message?: string }

/** Flush pending store writes immediately (logout / backup / unload). */
export async function flushStoreNow(opts: FlushOpts = {}): Promise<FlushResult> {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (kvFlushTimer) {
    clearTimeout(kvFlushTimer)
    kvFlushTimer = null
  }
  const storeResult = await flushStore(opts)
  const kvResult = await flushPendingKv()
  if (!storeResult.ok) return storeResult
  if (!kvResult.ok) return kvResult
  return { ok: true }
}

function scheduleKvFlush() {
  if (!getToken()) return
  if (kvFlushTimer) clearTimeout(kvFlushTimer)
  kvFlushTimer = setTimeout(() => {
    kvFlushTimer = null
    void flushPendingKv()
  }, KV_FLUSH_DEBOUNCE_MS)
}

function scheduleKvRetry() {
  if (kvRetryTimer || !getToken()) return
  kvRetryTimer = setTimeout(() => {
    kvRetryTimer = null
    void flushPendingKv()
  }, FLUSH_RETRY_MS)
}

/** Push durable pending KV docs to the server (CG weights, Fire Assay archive, …). */
export async function flushPendingKv(): Promise<FlushResult> {
  if (kvFlushInFlight) {
    kvFlushQueued = true
    const inFlight = await kvFlushInFlight
    if (kvFlushInFlight) return kvFlushInFlight
    return inFlight
  }

  const run = (async (): Promise<FlushResult> => {
    const scope = currentKvScope()
    const token = getToken()
    if (!scope || !token) return { ok: true }

    const pending = applyPendingKvToDocs(
      Object.fromEntries(kvCache.entries()),
      scope,
    )
    // Re-apply so cache matches merged pending before PUT.
    for (const key of pending.dirtyKeys) {
      const value = pending.docs[key]
      if (value == null) kvCache.delete(key)
      else kvCache.set(key, value)
    }

    if (!pending.dirtyKeys.length) return { ok: true }

    const confirmed: string[] = []
    let lastError = ''
    for (const key of pending.dirtyKeys) {
      try {
        if (!(key in pending.docs)) {
          await api(`/api/data/kv/${encodeURIComponent(key)}`, { method: 'DELETE' })
        } else {
          const raw = pending.docs[key]
          await api(`/api/data/kv/${encodeURIComponent(key)}`, {
            method: 'PUT',
            json: { value: tryParse(raw) },
          })
        }
        confirmed.push(key)
      } catch (e) {
        console.error('Failed to persist kv', key, e)
        lastError = e instanceof Error ? e.message : 'Failed to save lab data'
      }
    }

    if (confirmed.length) clearPendingKvKeys(scope, confirmed)

    if (confirmed.length === pending.dirtyKeys.length) {
      emitKvPersist(true)
      return { ok: true }
    }
    emitKvPersist(false, lastError || 'Failed to save lab data')
    scheduleKvRetry()
    return { ok: false, message: lastError || 'Failed to save lab data' }
  })()

  kvFlushInFlight = run
  try {
    return await run
  } finally {
    kvFlushInFlight = null
    if (kvFlushQueued) {
      kvFlushQueued = false
      void flushPendingKv()
    }
  }
}

async function flushStore(opts: FlushOpts = {}): Promise<FlushResult> {
  if (flushInFlight) {
    if (opts.replaceAll) {
      await flushInFlight
      return flushStore(opts)
    }
    flushQueued = true
    const inFlight = await flushInFlight
    if (flushInFlight) return flushInFlight
    return inFlight
  }
  const run = (async (): Promise<FlushResult> => {
    let attempts = 0
    while (attempts < STALE_RETRY_LIMIT) {
      attempts += 1
      const snapshot = storeCache
      const token = getToken()
      if (!snapshot || !token) return { ok: true }
      const startedRev = storeRev
      try {
        const res = await api<StoreWriteResult>('/api/data/store', {
          method: 'PUT',
          json: {
            data: snapshot,
            baseRev: startedRev,
            ...(opts.replaceAll ? { replaceAll: true } : {}),
          },
        })
        storeRev = Number.isFinite(Number(res.rev)) ? Number(res.rev) : startedRev + 1
        emitPersist(true)
        clearPendingForSuccessfulSnapshot(snapshot, Boolean(opts.replaceAll))
        if (storeCache !== snapshot) continue
        return { ok: true }
      } catch (e) {
        if (e instanceof ApiRequestError && e.status === 409 && e.code === 'STALE_STORE') {
          const body = e.body as { data?: StoreShape; rev?: number } | null
          if (typeof body?.rev === 'number' && Number.isFinite(body.rev)) {
            storeRev = body.rev
          }
          if (!opts.replaceAll) {
            const remote = body?.data
            if (remote && typeof remote === 'object') {
              const local = storeCache || snapshot
              storeCache = unionCentreScopedStore(remote, local)
              storeVersion += 1
            }
          }
          continue
        }
        console.error('Failed to persist store', e)
        const message = e instanceof Error ? e.message : 'Failed to save data'
        emitPersist(false, message)
        scheduleRetry()
        return { ok: false, message }
      }
    }
    const message = 'Could not save — another centre updated data. Retrying.'
    emitPersist(false, message)
    scheduleRetry()
    return { ok: false, message }
  })()

  flushInFlight = run
  try {
    return await run
  } finally {
    flushInFlight = null
    if (flushQueued) {
      flushQueued = false
      void flushStore()
    }
  }
}

if (typeof window !== 'undefined') {
  const flushIfPending = () => {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
      void flushStore()
    } else if (flushQueued || flushInFlight) {
      void flushStore()
    }
    if (kvFlushTimer) {
      clearTimeout(kvFlushTimer)
      kvFlushTimer = null
      void flushPendingKv()
    } else if (kvFlushQueued || kvFlushInFlight) {
      void flushPendingKv()
    }
  }
  window.addEventListener('pagehide', flushIfPending)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushIfPending()
  })
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
  const scope = currentKvScope()
  if (scope) rememberPendingKvSet(scope, k, value)
  scheduleKvFlush()
}

export function tenantRemove(key: string) {
  const k = normalizeKvKey(key)
  kvCache.delete(k)
  const scope = currentKvScope()
  if (scope) rememberPendingKvRemove(scope, k)
  scheduleKvFlush()
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
