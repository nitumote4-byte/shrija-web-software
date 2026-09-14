/**
 * Client-side financial tombstone 409 union / pending selftests.
 * Run: npx --yes tsx ./scripts/financial-tombstones.selftest.ts
 */
import assert from 'node:assert/strict'
import { unionCentreScopedStore } from '../src/data/storeMerge.ts'
import {
  FUND_TOMBSTONES_KEY,
  EXPENSE_TOMBSTONES_KEY,
  MONTHLY_INVOICE_TOMBSTONES_KEY,
  makeFinancialTombstone,
  applyFinancialTombstones,
  unionFinancialTombstones,
} from '../src/data/financialTombstones.ts'
import {
  applyPendingFinancialTombstonesToStore,
  clearAllPendingFinancialTombstones,
  clearConfirmedPendingFinancialTombstones,
  pendingFinancialTombstonesStorageKey,
  readPendingFinancialTombstones,
  rememberPendingFinancialTombstone,
  setPendingFinancialTombstoneStorageForTests,
} from '../src/data/pendingFinancialTombstones.ts'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
  }
}

function tomb(id: string, centreId = 'main', centreKind: 'main' | 'osc' = 'main') {
  return { id, centreId, centreKind, deletedAt: '2026-09-12T12:00:00.000Z' }
}

const scope = { tenantId: 'tn-1', centreId: 'main', centreKind: 'main' as const }

// --- TEST 3 / 20: 409 union preserves fund tombstone ---
{
  const remote = {
    funds: [],
    deletedFunds: [tomb('f-1')],
    expenses: [],
    monthlyInvoices: [],
    invoices: [],
    deletedInvoices: [],
  }
  const local = {
    funds: [{ id: 'f-1', amount: 500, source: 'Rajesh Jewellers' }],
    deletedFunds: [],
    expenses: [],
    monthlyInvoices: [],
    invoices: [],
    deletedInvoices: [],
  }
  const reconciled = unionCentreScopedStore(remote, local)
  assert.equal(
    (reconciled.funds as { id: string }[]).some((f) => f.id === 'f-1'),
    false,
    'TEST 3: 409 union cannot resurrect tombstoned fund',
  )
  assert.equal(
    (reconciled.deletedFunds as { id: string }[]).some((t) => t.id === 'f-1'),
    true,
    'TEST 20: tombstone survives 409 union',
  )
}

// --- Pending local financial tombstones ---
{
  const storage = memoryStorage()
  setPendingFinancialTombstoneStorageForTests(storage)
  clearAllPendingFinancialTombstones(scope)

  const t = makeFinancialTombstone({ id: 'f-pend', centreId: 'main' }, scope)
  assert.equal(rememberPendingFinancialTombstone(scope, 'funds', t), true)
  assert.equal(readPendingFinancialTombstones(scope).some((r) => r.id === 'f-pend'), true)

  const hydrated = applyPendingFinancialTombstonesToStore(
    {
      funds: [{ id: 'f-pend', amount: 1 }],
      deletedFunds: [],
      expenses: [],
      monthlyInvoices: [],
    },
    scope,
  )
  assert.equal(
    (hydrated.store.funds as { id: string }[]).some((f) => f.id === 'f-pend'),
    false,
    'pending fund tombstone applied on hydrate',
  )
  assert.ok(
    (hydrated.store.deletedFunds as { id: string }[]).some((x) => x.id === 'f-pend'),
  )

  clearConfirmedPendingFinancialTombstones(scope, {
    deletedFunds: [t],
    deletedExpenses: [],
    deletedMonthlyInvoices: [],
  })
  assert.equal(readPendingFinancialTombstones(scope).length, 0)

  // Centre isolation
  rememberPendingFinancialTombstone(scope, 'funds', tomb('f-osc', 'osc-b', 'osc'))
  assert.equal(
    readPendingFinancialTombstones(scope).some((r) => r.id === 'f-osc'),
    false,
    'main scope rejects osc pending tombstone',
  )

  setPendingFinancialTombstoneStorageForTests(null)
}

// --- Expense / monthly in 409 union ---
{
  const remote = {
    expenses: [],
    deletedExpenses: [tomb('e-1')],
    monthlyInvoices: [],
    deletedMonthlyInvoices: [tomb('m-1')],
    funds: [],
    deletedFunds: [],
    invoices: [],
  }
  const local = {
    expenses: [{ id: 'e-1', amount: 10 }],
    deletedExpenses: [],
    monthlyInvoices: [{ id: 'm-1', amount: 20 }],
    deletedMonthlyInvoices: [],
    funds: [],
    deletedFunds: [],
    invoices: [],
  }
  const reconciled = unionCentreScopedStore(remote, local)
  assert.equal((reconciled.expenses as { id: string }[]).some((e) => e.id === 'e-1'), false)
  assert.equal(
    (reconciled.monthlyInvoices as { id: string }[]).some((m) => m.id === 'm-1'),
    false,
  )
}

// --- apply helpers + centre-aware same-id collision ---
{
  const rows = applyFinancialTombstones(
    [{ id: 'x' }, { id: 'y' }],
    unionFinancialTombstones([], [tomb('x')]),
  )
  assert.deepEqual(
    rows.map((r) => (r as { id: string }).id),
    ['y'],
  )

  const collided = applyFinancialTombstones(
    [
      { id: 'X', centreId: 'main', centreKind: 'main' },
      { id: 'X', centreId: 'osc-a', centreKind: 'osc' },
    ],
    [tomb('X', 'main', 'main')],
  )
  assert.equal(collided.length, 1)
  assert.equal((collided[0] as { centreKind: string }).centreKind, 'osc')

  assert.equal(FUND_TOMBSTONES_KEY, 'deletedFunds')
  assert.equal(EXPENSE_TOMBSTONES_KEY, 'deletedExpenses')
  assert.equal(MONTHLY_INVOICE_TOMBSTONES_KEY, 'deletedMonthlyInvoices')
  assert.ok(pendingFinancialTombstonesStorageKey(scope).includes('tn-1'))
}

console.log('financial-tombstones.selftest.ts: ok')
