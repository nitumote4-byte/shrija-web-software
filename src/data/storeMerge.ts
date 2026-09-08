/**
 * Client-side union used when a store PUT hits STALE_STORE (409).
 * Local rows win on the same id so in-progress OSC/Main work is not dropped.
 */
export const CENTRE_SCOPED_STORE_KEYS = [
  'parties',
  'requests',
  'roughSheets',
  'pendingRough',
  'invoices',
  'monthlyInvoices',
  'funds',
  'expenses',
  'purchaseParties',
  'touches',
  'xray',
  'xrfStandardChecks',
  'fireAssays',
  'stock',
] as const

type StoreShape = Record<string, unknown>

function rowId(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const id = (item as { id?: unknown }).id
  return typeof id === 'string' && id.trim() ? id.trim() : ''
}

export function unionCentreScopedStore(remote: StoreShape, local: StoreShape): StoreShape {
  const out: StoreShape = { ...remote, ...local }
  for (const key of CENTRE_SCOPED_STORE_KEYS) {
    const remoteArr = Array.isArray(remote[key]) ? (remote[key] as unknown[]) : []
    const localArr = Array.isArray(local[key]) ? (local[key] as unknown[]) : []
    const byId = new Map<string, unknown>()
    const extras: unknown[] = []
    for (const item of remoteArr) {
      const id = rowId(item)
      if (id) byId.set(id, item)
      else if (item && typeof item === 'object') extras.push(item)
    }
    for (const item of localArr) {
      const id = rowId(item)
      if (id) byId.set(id, item)
      else if (item && typeof item === 'object') extras.push(item)
    }
    out[key] = [...byId.values(), ...extras]
  }
  return out
}
