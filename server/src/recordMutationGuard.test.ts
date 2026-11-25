import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyNotifiedHallmarkingRate } from './hallmarkingRates.js'
import {
  enforceLockedRecordMutations,
  RECORD_LOCK_MESSAGE,
  RECORD_LOCK_VIOLATION,
} from './recordMutationGuard.js'

const invoice = {
  id: 'inv1',
  invoiceNo: 'B-1',
  partyName: 'Jeweller',
  amount: 100,
  lines: [{ purity: '916', rate: 45, pcs: 2, amount: 90 }],
  status: 'Unpaid',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const fund = {
  id: 'f1',
  amount: 50,
  mode: 'Cash',
  partyName: 'Jeweller',
  voucherNo: '1',
}

function guard(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
  isAdmin = false,
) {
  return enforceLockedRecordMutations({
    currentStore: current,
    nextStore: structuredClone(next),
    isAdmin,
  })
}

describe('locked record mutations', () => {
  it('lets a non-admin add a bill and a payment', () => {
    const result = guard(
      { invoices: [invoice], funds: [fund] },
      {
        invoices: [invoice, { ...invoice, id: 'inv2', invoiceNo: 'B-2', status: 'Unpaid' }],
        funds: [fund, { ...fund, id: 'f2', amount: 20, voucherNo: '2' }],
      },
    )
    assert.equal(result.ok, true)
  })

  it('lets a new payment update only invoice status', () => {
    const result = guard(
      { invoices: [invoice], funds: [] },
      {
        invoices: [{ ...invoice, status: 'Partial', updatedAt: '2026-02-01T00:00:00.000Z' }],
        funds: [{ ...fund, id: 'f-new', amount: 40 }],
      },
    )
    assert.equal(result.ok, true)
  })

  it('rejects a non-admin edit of a saved bill rate', () => {
    const result = guard(
      { invoices: [invoice] },
      {
        invoices: [
          {
            ...invoice,
            lines: [{ purity: '916', rate: 10, pcs: 2, amount: 20 }],
            amount: 20,
          },
        ],
      },
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.status, 403)
      assert.equal(result.code, RECORD_LOCK_VIOLATION)
      assert.equal(result.error, RECORD_LOCK_MESSAGE)
    }
  })

  it('rejects a non-admin delete of a payment, expense, or party', () => {
    assert.equal(guard({ funds: [fund] }, { funds: [] }).ok, false)
    assert.equal(
      guard({ expenses: [{ id: 'e1', amount: 10, grossAmount: 10 }] }, { expenses: [] }).ok,
      false,
    )
    assert.equal(
      guard({ parties: [{ id: 'p1', name: 'A', gstin: '22' }] }, { parties: [{ id: 'p1', name: 'B', gstin: '22' }] })
        .ok,
      false,
    )
  })

  it('rejects a new delete tombstone from a non-admin', () => {
    const result = guard(
      { funds: [fund], deletedFunds: [] },
      { funds: [fund], deletedFunds: [{ id: 'f1', centreId: 'main', centreKind: 'main', deletedAt: '2026-02-01' }] },
    )
    assert.equal(result.ok, false)
  })

  it('lets an admin change a saved bill', () => {
    const result = guard(
      { invoices: [invoice] },
      { invoices: [{ ...invoice, lines: [{ purity: '916', rate: 1, pcs: 1, amount: 1 }] }] },
      true,
    )
    assert.equal(result.ok, true)
  })

  it('rewrites a non-admin category rate to the notified schedule and still blocks a name change', () => {
    const current = {
      categories: [{ id: 'c1', name: '22K', purity: '916', metal: 'Gold', rate: 1 }],
    }
    const rateOnly = guard(current, {
      categories: [{ id: 'c1', name: '22K', purity: '916', metal: 'Gold', rate: 999 }],
    })
    assert.equal(rateOnly.ok, true)
    const renamed = guard(current, {
      categories: [{ id: 'c1', name: 'Changed', purity: '916', metal: 'Gold', rate: 45 }],
    })
    assert.equal(renamed.ok, false)
    const next = {
      categories: [{ id: 'c1', name: '22K', purity: '916', metal: 'Gold', rate: 999 }],
    }
    const rewritten = enforceLockedRecordMutations({
      currentStore: current,
      nextStore: next,
      isAdmin: false,
    })
    assert.equal(rewritten.ok, true)
    assert.equal(
      (next.categories[0] as { rate: number }).rate,
      applyNotifiedHallmarkingRate({ metal: 'Gold', rate: 999 }).rate,
    )
  })

  it('lets a non-admin add a party and blocks a new service rate type', () => {
    assert.equal(
      guard({ parties: [{ id: 'p1', name: 'A' }] }, { parties: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }] })
        .ok,
      true,
    )
    const types = guard(
      { otherServiceTypes: [] },
      {
        otherServiceTypes: [
          {
            id: 'ost-custom',
            name: 'Special',
            kind: 'manual',
            slipPrefix: 'MS',
            builtIn: false,
            active: true,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        ],
      },
    )
    assert.equal(types.ok, false)
  })
})
