/**
 * Client-side union used when a store PUT hits STALE_STORE (409).
 * Local rows win on the same id so in-progress OSC/Main work is not dropped.
 * Invoice tombstones win over remote-only rows so OSC deletes are not resurrected.
 */
import {
  INVOICE_TOMBSTONES_KEY,
  applyInvoiceTombstones,
  unionInvoiceTombstones,
} from './invoiceTombstones'

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
  'otherServices',
  'otherServiceReceipts',
  'otherServiceAudit',
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
  const tombstones = unionInvoiceTombstones(remote[INVOICE_TOMBSTONES_KEY], local[INVOICE_TOMBSTONES_KEY])
  out[INVOICE_TOMBSTONES_KEY] = tombstones
  if (Array.isArray(out.invoices)) {
    const before = out.invoices as unknown[]
    const after = applyInvoiceTombstones(before, tombstones)
    if (after.length !== before.length) {
      console.info('[invoice-tombstone] resurrection-prevented', {
        centreId: 'stale-store-union',
        reason: 'STALE_STORE',
        invoiceId: before
          .map((item) =>
            item && typeof item === 'object' ? String((item as { id?: unknown }).id || '') : '',
          )
          .filter((id) => id && !after.some((row) => (row as { id?: string }).id === id))
          .join(','),
      })
    }
    out.invoices = after
  }
  return out
}
