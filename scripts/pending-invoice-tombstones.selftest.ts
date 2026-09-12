/**
 * Durable pending invoice tombstones — survive F5 before PUT completes.
 * Run: npx --yes tsx ./scripts/pending-invoice-tombstones.selftest.ts
 */
import assert from 'node:assert/strict'
import { unionCentreScopedStore } from '../src/data/storeMerge.ts'
import {
  applyPendingInvoiceTombstonesToStore,
  clearAllPendingInvoiceTombstones,
  clearPendingInvoiceTombstones,
  pendingInvoiceTombstonesStorageKey,
  pendingTombstoneMatchesScope,
  readPendingInvoiceTombstones,
  rememberPendingInvoiceTombstone,
  setPendingInvoiceTombstoneStorageForTests,
  type PendingTombstoneScope,
  type PendingTombstoneStorage,
} from '../src/data/pendingInvoiceTombstones.ts'
import { INVOICE_TOMBSTONES_KEY, tombstoneIds } from '../src/data/invoiceTombstones.ts'
import {
  filterStoreForSession,
  mergeMainStoreWrite,
  mergeOscStoreWrite,
} from '../server/src/tenantIsolation.ts'

class MemoryStorage implements PendingTombstoneStorage {
  readonly map = new Map<string, string>()
  throwOnSet = false
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  setItem(key: string, value: string) {
    if (this.throwOnSet) throw new Error('quota')
    this.map.set(key, value)
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
}

const deletedAt = '2026-09-12T12:00:00.000Z'

function scope(overrides: Partial<PendingTombstoneScope> = {}): PendingTombstoneScope {
  return {
    tenantId: 'tn-a',
    centreId: 'osc-a',
    centreKind: 'osc',
    ...overrides,
  }
}

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

const storage = new MemoryStorage()
setPendingInvoiceTombstoneStorageForTests(storage)

function resetStorage() {
  storage.map.clear()
  storage.throwOnSet = false
}

// --- TEST 1: Delete + reload before server persistence ---
{
  resetStorage()
  const actor = scope()
  const written = rememberPendingInvoiceTombstone(actor, tombstone('i-a'))
  assert.equal(written, true, 'TEST 1: pending tombstone written')

  const serverGet = {
    invoices: [oscInvoiceA],
    deletedInvoices: [],
    parties: [{ id: 'p-a', centreId: 'osc-a', centreKind: 'osc' }],
  }
  const recovered = applyPendingInvoiceTombstonesToStore(serverGet, actor)
  assertAbsent(recovered.store.invoices, 'i-a', 'TEST 1: reload hides invoice from pending tombstone')
  assertPresent(recovered.store.deletedInvoices, 'i-a', 'TEST 1: pending tombstone recovered into store')
  assert.equal(readPendingInvoiceTombstones(actor).some((row) => row.id === 'i-a'), true, 'TEST 1: pending remains until PUT succeeds')

  const persisted = mergeOscStoreWrite(serverGet, recovered.store, 'osc-a')
  assertAbsent(persisted.invoices, 'i-a', 'TEST 1: recovered flush persists tombstone on server')
  assertPresent(persisted.deletedInvoices, 'i-a', 'TEST 1: server tombstone exists')

  clearPendingInvoiceTombstones(actor, tombstoneIds(persisted[INVOICE_TOMBSTONES_KEY]))
  assert.equal(readPendingInvoiceTombstones(actor).length, 0, 'TEST 1: pending cleared after confirmed persist')

  const freshGet = filterStoreForSession(persisted, { centreId: 'osc-a', centreKind: 'osc' })
  assertAbsent(freshGet.invoices, 'i-a', 'TEST 1: fresh GET does not return deleted invoice')

  const staleMainWrite = mergeMainStoreWrite(persisted, {
    invoices: [oscInvoiceA],
    parties: [{ id: 'p-main', centreId: 'main' }],
  })
  assertAbsent(staleMainWrite.invoices, 'i-a', 'TEST 1: stale Main write does not resurrect recovered delete')
}

// --- TEST 2: Successful delete clears pending; reload does not retry ---
{
  resetStorage()
  const actor = scope()
  rememberPendingInvoiceTombstone(actor, tombstone('i-a'))
  const snapshot = {
    invoices: [],
    deletedInvoices: [tombstone('i-a')],
  }
  clearPendingInvoiceTombstones(actor, tombstoneIds(snapshot.deletedInvoices))
  assert.equal(readPendingInvoiceTombstones(actor).length, 0, 'TEST 2: pending removed after PUT success')

  const serverGet = {
    invoices: [],
    deletedInvoices: [tombstone('i-a')],
  }
  const recovered = applyPendingInvoiceTombstonesToStore(serverGet, actor)
  assert.equal(recovered.applied.length, 0, 'TEST 2: reload has nothing outstanding to flush')
}

// --- TEST 3: Multiple pending deletes survive abort + reload ---
{
  resetStorage()
  const actor = scope()
  rememberPendingInvoiceTombstone(actor, tombstone('i-a'))
  rememberPendingInvoiceTombstone(actor, { ...tombstone('i-c'), requestNo: 'HM-C' })
  const pending = readPendingInvoiceTombstones(actor).map((row) => row.id).sort()
  assert.deepEqual(pending, ['i-a', 'i-c'], 'TEST 3: both pending tombstones stored')

  const serverGet = {
    invoices: [oscInvoiceA, { ...oscInvoiceA, id: 'i-c', requestNo: 'HM-C' }],
    deletedInvoices: [],
  }
  const recovered = applyPendingInvoiceTombstonesToStore(serverGet, actor)
  assertAbsent(recovered.store.invoices, 'i-a', 'TEST 3: A hidden after reload')
  assertAbsent(recovered.store.invoices, 'i-c', 'TEST 3: C hidden after reload')

  const persisted = mergeOscStoreWrite(serverGet, recovered.store, 'osc-a')
  assertAbsent(persisted.invoices, 'i-a', 'TEST 3: A persisted deleted')
  assertAbsent(persisted.invoices, 'i-c', 'TEST 3: C persisted deleted')
  clearPendingInvoiceTombstones(actor, tombstoneIds(persisted.deletedInvoices))
  assert.equal(readPendingInvoiceTombstones(actor).length, 0, 'TEST 3: both pending cleared after persist')
}

// --- TEST 4: Tenant isolation ---
{
  resetStorage()
  const tenantA = scope({ tenantId: 'tn-a', centreId: 'osc-a' })
  const tenantB = scope({ tenantId: 'tn-b', centreId: 'osc-b' })
  rememberPendingInvoiceTombstone(tenantA, tombstone('i-a'))
  const recoveredB = applyPendingInvoiceTombstonesToStore(
    { invoices: [oscInvoiceA], deletedInvoices: [] },
    tenantB,
  )
  assertPresent(recoveredB.store.invoices, 'i-a', 'TEST 4: Tenant B hydrate does not apply Tenant A pending')
  assert.equal(recoveredB.applied.length, 0, 'TEST 4: Tenant B sees no pending from Tenant A')
  assert.equal(readPendingInvoiceTombstones(tenantA).some((row) => row.id === 'i-a'), true, 'TEST 4: Tenant A pending still stored')
  assert.notEqual(
    pendingInvoiceTombstonesStorageKey(tenantA),
    pendingInvoiceTombstonesStorageKey(tenantB),
    'TEST 4: storage keys are tenant/centre distinct',
  )
}

// --- TEST 5: Centre isolation — forged local tombstone is not applied, server still rejects ---
{
  resetStorage()
  const centreA = scope({ centreId: 'osc-a', centreKind: 'osc' })
  rememberPendingInvoiceTombstone(centreA, tombstone('i-b', 'osc-b'))
  assert.equal(readPendingInvoiceTombstones(centreA).length, 0, 'TEST 5: forged other-centre tombstone is not stored for Centre A')

  storage.setItem(
    pendingInvoiceTombstonesStorageKey(centreA),
    JSON.stringify({
      version: 1,
      tenantId: 'tn-a',
      centreId: 'osc-a',
      tombstones: [tombstone('i-b', 'osc-b')],
    }),
  )
  const recovered = applyPendingInvoiceTombstonesToStore(
    { invoices: [oscInvoiceB], deletedInvoices: [] },
    centreA,
  )
  assertPresent(recovered.store.invoices, 'i-b', 'TEST 5: Centre A pending cannot hide Centre B invoice')
  assert.equal(recovered.applied.length, 0, 'TEST 5: mismatched centre tombstone ignored on hydrate')

  const forgedPut = {
    invoices: [],
    deletedInvoices: [tombstone('i-b', 'osc-a')],
    parties: [],
  }
  const merged = mergeOscStoreWrite(
    {
      invoices: [oscInvoiceB],
      parties: [{ id: 'p-b', centreId: 'osc-b', centreKind: 'osc' }],
    },
    forgedPut,
    'osc-a',
  )
  assertPresent(merged.invoices, 'i-b', 'TEST 5: server rejects forged Centre A tombstone for Centre B invoice')
}

// --- TEST 6: STALE_STORE union keeps pending tombstone ---
{
  resetStorage()
  const actor = scope()
  rememberPendingInvoiceTombstone(actor, tombstone('i-a'))
  const remote = {
    invoices: [oscInvoiceA],
    deletedInvoices: [],
    parties: [{ id: 'p-a', centreId: 'osc-a' }],
  }
  const local = applyPendingInvoiceTombstonesToStore(remote, actor).store
  const reconciled = unionCentreScopedStore(remote, local)
  assertAbsent(reconciled.invoices, 'i-a', 'TEST 6: 409 union does not resurrect pending-deleted invoice')
  assertPresent(reconciled.deletedInvoices, 'i-a', 'TEST 6: pending tombstone retained through 409')
  assert.equal(readPendingInvoiceTombstones(actor).some((row) => row.id === 'i-a'), true, 'TEST 6: pending not cleared on 409')

  const retried = mergeOscStoreWrite(remote, reconciled, 'osc-a')
  assertAbsent(retried.invoices, 'i-a', 'TEST 6: retry persist keeps A deleted')
  clearPendingInvoiceTombstones(actor, tombstoneIds(retried.deletedInvoices))
  assert.equal(readPendingInvoiceTombstones(actor).length, 0, 'TEST 6: pending cleared only after retry success')
}

// --- TEST 7: Existing legitimate OSC row without tombstone is kept on Main write ---
{
  const existing = {
    invoices: [oscInvoiceB],
    parties: [{ id: 'p-main', centreId: 'main' }, { id: 'p-b', centreId: 'osc-b', centreKind: 'osc' }],
  }
  const incoming = {
    invoices: [],
    parties: [{ id: 'p-main', centreId: 'main' }],
  }
  const merged = mergeMainStoreWrite(existing, incoming)
  assertPresent(merged.invoices, 'i-b', 'TEST 7: Main omit without tombstone keeps OSC invoice B')
}

// --- TEST 8: Logout / account switch does not apply or wipe the other tenant ---
{
  resetStorage()
  const tenantA = scope({ tenantId: 'tn-a', centreId: 'osc-a' })
  const tenantB = scope({ tenantId: 'tn-b', centreId: 'osc-b', centreKind: 'osc' })
  rememberPendingInvoiceTombstone(tenantA, tombstone('i-a'))
  clearAllPendingInvoiceTombstones(tenantB)
  assert.equal(readPendingInvoiceTombstones(tenantA).some((row) => row.id === 'i-a'), true, 'TEST 8: logging into B does not delete A pending')
  const afterSwitch = applyPendingInvoiceTombstonesToStore(
    { invoices: [oscInvoiceA], deletedInvoices: [] },
    tenantB,
  )
  assertPresent(afterSwitch.store.invoices, 'i-a', 'TEST 8: Tenant B session does not hide Tenant A invoice')
  const backToA = applyPendingInvoiceTombstonesToStore(
    { invoices: [oscInvoiceA], deletedInvoices: [] },
    tenantA,
  )
  assertAbsent(backToA.store.invoices, 'i-a', 'TEST 8: Tenant A pending still recovers after switch back')
}

// Malformed / foreign record is ignored
{
  resetStorage()
  const actor = scope()
  storage.setItem(pendingInvoiceTombstonesStorageKey(actor), '{not-json')
  assert.equal(readPendingInvoiceTombstones(actor).length, 0, 'malformed JSON is ignored')
  storage.setItem(
    pendingInvoiceTombstonesStorageKey(actor),
    JSON.stringify({ version: 1, tenantId: 'tn-other', centreId: 'osc-a', tombstones: [tombstone('i-a')] }),
  )
  assert.equal(readPendingInvoiceTombstones(actor).length, 0, 'foreign tenantId inside record is ignored')
}

// Storage failure does not throw
{
  resetStorage()
  storage.throwOnSet = true
  const ok = rememberPendingInvoiceTombstone(scope(), tombstone('i-a'))
  assert.equal(ok, false, 'quota/storage failure returns false')
  assert.equal(readPendingInvoiceTombstones(scope()).length, 0, 'failed write leaves no pending record')
}

assert.equal(
  pendingTombstoneMatchesScope(tombstone('i-a'), scope()),
  true,
  'matching OSC tombstone is in scope',
)
assert.equal(
  pendingTombstoneMatchesScope(tombstone('i-a', 'osc-b'), scope()),
  false,
  'other OSC centre tombstone is out of scope',
)

setPendingInvoiceTombstoneStorageForTests(null)
console.log('pending-invoice-tombstones.selftest.ts: ok')
