/**
 * Off-Site invoice delete must persist across refresh, STALE_STORE, and Main writes.
 * Run: npx tsx ./scripts/osc-invoice-delete.selftest.ts
 */
import assert from 'node:assert/strict'
import { unionCentreScopedStore } from '../src/data/storeMerge.ts'
import { canDeleteInvoiceForCentre } from '../src/data/invoiceTombstones.ts'
import {
  filterStoreForSession,
  mergeMainStoreWrite,
  mergeOscStoreWrite,
} from '../server/src/tenantIsolation.ts'

const deletedAt = '2026-09-12T12:00:00.000Z'

function tombstone(
  id: string,
  centreId = 'osc-a',
): { id: string; centreId: string; centreKind: 'osc'; deletedAt: string; requestNo?: string } {
  return { id, centreId, centreKind: 'osc', deletedAt, requestNo: 'HM-1' }
}

function ids(rows: unknown): string[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => (row && typeof row === 'object' ? String((row as { id?: unknown }).id || '') : ''))
    .filter(Boolean)
}

function assertAbsent(rows: unknown, id: string, label: string) {
  assert.equal(ids(rows).includes(id), false, label)
}

function assertPresent(rows: unknown, id: string, label: string) {
  assert.equal(ids(rows).includes(id), true, label)
}

const oscInvoiceA = {
  id: 'i-a',
  requestNo: 'HM-1',
  centreId: 'osc-a',
  centreKind: 'osc' as const,
  amount: 100,
}
const oscInvoiceB = {
  id: 'i-b',
  requestNo: 'HM-B',
  centreId: 'osc-b',
  centreKind: 'osc' as const,
  amount: 50,
}
const oscRequestA = { id: 'r-a', requestNo: 'HM-1', centreId: 'osc-a', centreKind: 'osc' as const }

// --- TEST 1: Basic OSC delete survives persist + GET/hydrate ---
{
  const existing = {
    requests: [oscRequestA],
    invoices: [oscInvoiceA],
    parties: [{ id: 'p-a', name: 'A', centreId: 'osc-a', centreKind: 'osc' }],
  }
  const incoming = {
    requests: [oscRequestA],
    invoices: [],
    parties: [{ id: 'p-a', name: 'A', centreId: 'osc-a', centreKind: 'osc' }],
    deletedInvoices: [tombstone('i-a')],
  }
  const persisted = mergeOscStoreWrite(existing, incoming, 'osc-a')
  assertAbsent(persisted.invoices, 'i-a', 'TEST 1: OSC merge removes invoice')
  assertPresent(persisted.deletedInvoices, 'i-a', 'TEST 1: tombstone persisted on server')

  const hydrated = filterStoreForSession(persisted, { centreId: 'osc-a', centreKind: 'osc' })
  assertAbsent(hydrated.invoices, 'i-a', 'TEST 1: GET/hydrate does not return deleted invoice')
}

// --- TEST 2: STALE_STORE union must not restore a tombstoned invoice ---
{
  const remote = {
    invoices: [oscInvoiceA],
    deletedInvoices: [],
    parties: [{ id: 'p-a', centreId: 'osc-a' }],
  }
  const local = {
    invoices: [],
    deletedInvoices: [tombstone('i-a')],
    parties: [{ id: 'p-a', centreId: 'osc-a' }],
  }
  const reconciled = unionCentreScopedStore(remote, local)
  assertAbsent(reconciled.invoices, 'i-a', 'TEST 2: 409 union does not resurrect tombstoned invoice')
  assertPresent(reconciled.deletedInvoices, 'i-a', 'TEST 2: local tombstone kept during 409')
}

// --- TEST 3: Main write after OSC delete must not resurrect ---
{
  const afterOscDelete = mergeOscStoreWrite(
    {
      invoices: [oscInvoiceA],
      parties: [{ id: 'p-main', centreId: 'main' }],
    },
    {
      invoices: [],
      parties: [],
      deletedInvoices: [tombstone('i-a')],
    },
    'osc-a',
  )
  const mainUnrelated = {
    invoices: [oscInvoiceA],
    parties: [{ id: 'p-main', name: 'Main', centreId: 'main' }],
  }
  const afterMain = mergeMainStoreWrite(afterOscDelete, mainUnrelated)
  assertAbsent(afterMain.invoices, 'i-a', 'TEST 3: Main stale cache does not resurrect OSC delete')
  assertPresent(afterMain.deletedInvoices, 'i-a', 'TEST 3: OSC tombstone survives Main write')
}

// --- TEST 4: Main write without tombstone still preserves OSC invoice ---
{
  const existing = {
    invoices: [oscInvoiceA],
    parties: [{ id: 'p-main', centreId: 'main' }, { id: 'p-a', centreId: 'osc-a', centreKind: 'osc' }],
  }
  const incoming = {
    invoices: [],
    parties: [{ id: 'p-main', centreId: 'main' }],
  }
  const merged = mergeMainStoreWrite(existing, incoming)
  assertPresent(merged.invoices, 'i-a', 'TEST 4: Main omit without tombstone keeps OSC invoice')
}

// --- TEST 5: New OSC invoice after a prior delete is saved ---
{
  const existing = {
    invoices: [],
    deletedInvoices: [tombstone('i-a')],
    parties: [{ id: 'p-a', centreId: 'osc-a', centreKind: 'osc' }],
  }
  const incoming = {
    invoices: [{ id: 'i-new', requestNo: 'HM-2', centreId: 'osc-a', centreKind: 'osc', amount: 20 }],
    deletedInvoices: [tombstone('i-a')],
    parties: [{ id: 'p-a', centreId: 'osc-a', centreKind: 'osc' }],
  }
  const merged = mergeOscStoreWrite(existing, incoming, 'osc-a')
  assertPresent(merged.invoices, 'i-new', 'TEST 5: new OSC invoice is saved')
  assertAbsent(merged.invoices, 'i-a', 'TEST 5: old tombstoned invoice stays gone')
}

// --- TEST 6: OSC invoice update survives merge ---
{
  const existing = {
    invoices: [oscInvoiceA],
    parties: [{ id: 'p-a', centreId: 'osc-a', centreKind: 'osc' }],
  }
  const incoming = {
    invoices: [{ ...oscInvoiceA, amount: 250 }],
    parties: [{ id: 'p-a', centreId: 'osc-a', centreKind: 'osc' }],
  }
  const merged = mergeOscStoreWrite(existing, incoming, 'osc-a')
  const row = (merged.invoices as { id: string; amount: number }[]).find((i) => i.id === 'i-a')
  assert.equal(row?.amount, 250, 'TEST 6: updated OSC invoice remains')
}

// --- TEST 7: Centre A tombstone does not delete Centre B invoice ---
{
  const existing = {
    invoices: [oscInvoiceA, oscInvoiceB],
    parties: [
      { id: 'p-a', centreId: 'osc-a', centreKind: 'osc' },
      { id: 'p-b', centreId: 'osc-b', centreKind: 'osc' },
    ],
  }
  const incoming = {
    invoices: [],
    deletedInvoices: [tombstone('i-a')],
    parties: [{ id: 'p-a', centreId: 'osc-a', centreKind: 'osc' }],
  }
  const merged = mergeOscStoreWrite(existing, incoming, 'osc-a')
  assertAbsent(merged.invoices, 'i-a', 'TEST 7: centre A invoice deleted')
  assertPresent(merged.invoices, 'i-b', 'TEST 7: centre B invoice untouched')
}

// --- TEST 8: Unauthorized delete / forged tombstone is rejected ---
{
  assert.equal(
    canDeleteInvoiceForCentre(oscInvoiceB, { centreId: 'osc-a', centreKind: 'osc' }),
    false,
    'TEST 8: OSC A cannot delete OSC B invoice',
  )
  assert.equal(
    canDeleteInvoiceForCentre(oscInvoiceA, { centreId: 'osc-a', centreKind: 'osc' }),
    true,
    'TEST 8: OSC A can delete its own invoice',
  )
  assert.equal(
    canDeleteInvoiceForCentre(oscInvoiceA, { centreId: 'main', centreKind: 'main' }),
    false,
    'TEST 8: Main cannot delete OSC invoice',
  )

  const existing = {
    invoices: [oscInvoiceB],
    parties: [{ id: 'p-b', centreId: 'osc-b', centreKind: 'osc' }],
  }
  const forged = {
    invoices: [],
    deletedInvoices: [tombstone('i-b', 'osc-a')],
    parties: [],
  }
  const merged = mergeOscStoreWrite(existing, forged, 'osc-a')
  assertPresent(merged.invoices, 'i-b', 'TEST 8: forged OSC A tombstone does not delete OSC B invoice')
}

// --- TEST 9: Stale OSC tab write after another tab deleted ---
{
  const afterTabB = {
    invoices: [],
    deletedInvoices: [tombstone('i-a')],
    parties: [{ id: 'p-a', centreId: 'osc-a', centreKind: 'osc' }],
  }
  const staleTabA = {
    invoices: [oscInvoiceA],
    deletedInvoices: [],
    parties: [{ id: 'p-a', centreId: 'osc-a', centreKind: 'osc' }],
  }
  const merged = mergeOscStoreWrite(afterTabB, staleTabA, 'osc-a')
  assertAbsent(merged.invoices, 'i-a', 'TEST 9: stale OSC tab cannot resurrect deleted invoice')
  assertPresent(merged.deletedInvoices, 'i-a', 'TEST 9: tombstone wins over stale incoming invoice')
}

// GET never returns a still-present invoice that has a tombstone (server-authoritative)
{
  const leaked = {
    requests: [oscRequestA],
    invoices: [oscInvoiceA],
    deletedInvoices: [tombstone('i-a')],
  }
  const scoped = filterStoreForSession(leaked, { centreId: 'osc-a', centreKind: 'osc' })
  assertAbsent(scoped.invoices, 'i-a', 'GET strips tombstoned invoices even if array still contains them')
}

// Old stores without deletedInvoices do not crash
{
  const merged = mergeMainStoreWrite(
    { invoices: [oscInvoiceA] },
    { invoices: [], parties: [{ id: 'p-main', centreId: 'main' }] },
  )
  assertPresent(merged.invoices, 'i-a', 'legacy store without tombstone key keeps OSC invoice')
}

console.log('osc-invoice-delete.selftest.ts: ok')
