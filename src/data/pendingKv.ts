/**
 * Browser-local durable intent for tenant KV writes (CG weights, Fire Assay archive, etc.).
 *
 * tenantSet is otherwise fire-and-forget. An F5 or deploy-window 502 can drop an
 * in-flight PUT while the UI still showed the saved data. Pending records are
 * tenant-scoped and re-applied on hydrate, then retried until the server accepts them.
 */
export const PENDING_KV_VERSION = 1 as const
export const PENDING_KV_KEY_PREFIX = 'shrija-pending-kv:v1' as const

export type PendingKvScope = {
  tenantId: string
}

export type PendingKvEntry =
  | { op: 'set'; value: string; updatedAt: string }
  | { op: 'remove'; updatedAt: string }

export type PendingKvRecord = {
  version: typeof PENDING_KV_VERSION
  tenantId: string
  docs: Record<string, PendingKvEntry>
}

export type PendingKvStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

let storageOverride: PendingKvStorage | null = null

export function pendingKvStorageKey(scope: PendingKvScope): string {
  return `${PENDING_KV_KEY_PREFIX}:${scope.tenantId}`
}

/** Test-only. Pass null to restore localStorage. */
export function setPendingKvStorageForTests(storage: PendingKvStorage | null) {
  storageOverride = storage
}

function getStorage(): PendingKvStorage | null {
  if (storageOverride) return storageOverride
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function warnStorageUnavailable() {
  console.warn('[pending-kv] storage-unavailable')
}

function readRecord(scope: PendingKvScope): Record<string, PendingKvEntry> {
  const storage = getStorage()
  if (!storage || !scope.tenantId) return {}
  let raw: string | null = null
  try {
    raw = storage.getItem(pendingKvStorageKey(scope))
  } catch {
    warnStorageUnavailable()
    return {}
  }
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as PendingKvRecord
    if (parsed?.version !== PENDING_KV_VERSION) return {}
    if (parsed.tenantId !== scope.tenantId) return {}
    if (!parsed.docs || typeof parsed.docs !== 'object') return {}
    const out: Record<string, PendingKvEntry> = {}
    for (const [key, entry] of Object.entries(parsed.docs)) {
      if (!key || !entry || typeof entry !== 'object') continue
      if (entry.op === 'remove' && typeof entry.updatedAt === 'string') {
        out[key] = { op: 'remove', updatedAt: entry.updatedAt }
      } else if (entry.op === 'set' && typeof entry.value === 'string' && typeof entry.updatedAt === 'string') {
        out[key] = { op: 'set', value: entry.value, updatedAt: entry.updatedAt }
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeRecord(scope: PendingKvScope, docs: Record<string, PendingKvEntry>): boolean {
  const storage = getStorage()
  if (!storage || !scope.tenantId) {
    warnStorageUnavailable()
    return false
  }
  const key = pendingKvStorageKey(scope)
  try {
    if (Object.keys(docs).length === 0) {
      storage.removeItem(key)
      return true
    }
    const record: PendingKvRecord = {
      version: PENDING_KV_VERSION,
      tenantId: scope.tenantId,
      docs,
    }
    storage.setItem(key, JSON.stringify(record))
    return true
  } catch {
    warnStorageUnavailable()
    return false
  }
}

export function readPendingKv(scope: PendingKvScope): Record<string, PendingKvEntry> {
  if (!scope.tenantId) return {}
  return readRecord(scope)
}

export function rememberPendingKvSet(scope: PendingKvScope, key: string, value: string): boolean {
  if (!scope.tenantId || !key) return false
  const docs = readRecord(scope)
  docs[key] = { op: 'set', value, updatedAt: new Date().toISOString() }
  return writeRecord(scope, docs)
}

export function rememberPendingKvRemove(scope: PendingKvScope, key: string): boolean {
  if (!scope.tenantId || !key) return false
  const docs = readRecord(scope)
  docs[key] = { op: 'remove', updatedAt: new Date().toISOString() }
  return writeRecord(scope, docs)
}

export function clearPendingKvKeys(scope: PendingKvScope, keys: Iterable<string>): boolean {
  if (!scope.tenantId) return false
  const remove = new Set([...keys].filter(Boolean))
  if (remove.size === 0) return true
  const docs = readRecord(scope)
  let changed = false
  for (const key of remove) {
    if (key in docs) {
      delete docs[key]
      changed = true
    }
  }
  return changed ? writeRecord(scope, docs) : true
}

export function clearAllPendingKv(scope: PendingKvScope): boolean {
  if (!scope.tenantId) return false
  return writeRecord(scope, {})
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Merge Fire Assay archive maps so pending sheet keys win without dropping server-only sheets. */
export function mergeFireAssayArchiveJson(serverRaw: string | null, pendingRaw: string): string {
  const server = tryParseJson(serverRaw || '')
  const pending = tryParseJson(pendingRaw)
  const serverObj =
    server && typeof server === 'object' && !Array.isArray(server)
      ? (server as Record<string, unknown>)
      : {}
  const pendingObj =
    pending && typeof pending === 'object' && !Array.isArray(pending)
      ? (pending as Record<string, unknown>)
      : {}
  return JSON.stringify({ ...serverObj, ...pendingObj })
}

/** Union CG weight rows by id; pending/local rows win on the same id. */
export function mergeCgWeightsJson(serverRaw: string | null, pendingRaw: string): string {
  const server = tryParseJson(serverRaw || '')
  const pending = tryParseJson(pendingRaw)
  const serverRows = Array.isArray(server) ? server : []
  const pendingRows = Array.isArray(pending) ? pending : []
  const byId = new Map<string, unknown>()
  for (const row of serverRows) {
    if (!row || typeof row !== 'object') continue
    const id = String((row as { id?: unknown }).id ?? '')
    if (id) byId.set(id, row)
  }
  for (const row of pendingRows) {
    if (!row || typeof row !== 'object') continue
    const id = String((row as { id?: unknown }).id ?? '')
    if (id) byId.set(id, row)
  }
  // Preserve pending order when present (newest-first UI), else server order + extras.
  if (pendingRows.length) {
    const seen = new Set<string>()
    const out: unknown[] = []
    for (const row of pendingRows) {
      if (!row || typeof row !== 'object') continue
      const id = String((row as { id?: unknown }).id ?? '')
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(byId.get(id) ?? row)
    }
    for (const [id, row] of byId) {
      if (seen.has(id)) continue
      out.push(row)
    }
    return JSON.stringify(out)
  }
  return JSON.stringify([...byId.values()])
}

export function mergePendingKvValue(
  key: string,
  serverRaw: string | null,
  pending: PendingKvEntry,
): string | null {
  if (pending.op === 'remove') return null
  if (key === 'fire-assay-sheets-archive') {
    return mergeFireAssayArchiveJson(serverRaw, pending.value)
  }
  if (key === 'qm-cg-weights') {
    return mergeCgWeightsJson(serverRaw, pending.value)
  }
  return pending.value
}

/**
 * Apply durable pending KV on top of server hydrate docs.
 * Returns the merged docs map (string values) and which keys still need a server flush.
 */
export function applyPendingKvToDocs(
  docs: Record<string, string>,
  scope: PendingKvScope,
): { docs: Record<string, string>; dirtyKeys: string[] } {
  const pending = readPendingKv(scope)
  if (!Object.keys(pending).length) return { docs, dirtyKeys: [] }

  const next = { ...docs }
  const dirtyKeys: string[] = []
  for (const [key, entry] of Object.entries(pending)) {
    dirtyKeys.push(key)
    const merged = mergePendingKvValue(key, next[key] ?? null, entry)
    if (merged == null) delete next[key]
    else next[key] = merged
  }
  return { docs: next, dirtyKeys }
}
