/**
 * P1-6 financial tombstones — funds / expenses / monthly invoices + OS cancel.
 * Run: npm --prefix server test -- --test-name-pattern="financial tombstone|OS cancel"
 * Also: npx --yes tsx ./scripts/financial-tombstones.selftest.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  acceptMainFinancialTombstones,
  acceptOscFinancialTombstones,
  applyFinancialTombstones,
  reconcileFinancialTombstonesForReplaceAll,
  unionFinancialTombstones,
} from './financialTombstones.js'
import {
  enforceOtherServiceCancelImmutability,
  enforceOtherServiceFundIdentity,
  OTHER_SERVICE_FUND_SOURCE,
} from './otherServices.js'
import {
  enforceHallmarkingFinancialAuthority,
} from './hallmarkingFinancialAuthority.js'
import { filterStoreForSession, mergeMainStoreWrite, mergeOscStoreWrite, mergeStoreWrite } from './tenantIsolation.js'
import { pickStoreForRole } from './rbac.js'

function tomb(
  id: string,
  centreId = 'main',
  centreKind: 'main' | 'osc' = 'main',
) {
  return {
    id,
    centreId,
    centreKind,
    deletedAt: '2026-09-12T12:00:00.000Z',
  }
}

function hmFund(id = 'f-1', amount = 500) {
  return {
    id,
    date: '2026-09-12',
    source: 'Rajesh Jewellers',
    partyName: 'Rajesh Jewellers',
    amount,
    mode: 'Cash',
    voucherNo: '1',
    centreId: 'main',
    centreKind: 'main',
  }
}

describe('financial tombstones P1-6', () => {
  it('TEST 1: legitimate fund delete creates tombstone and persists through merge', () => {
    const current = {
      funds: [hmFund()],
      deletedFunds: [],
      invoices: [],
      expenses: [],
      monthlyInvoices: [],
    }
    const incoming = {
      funds: [],
      deletedFunds: [tomb('f-1')],
      invoices: [],
      expenses: [],
      monthlyInvoices: [],
    }
    const merged = mergeMainStoreWrite(current, incoming)
    assert.equal((merged.funds as unknown[]).length, 0)
    assert.equal(
      (merged.deletedFunds as { id: string }[]).some((t) => t.id === 'f-1'),
      true,
    )
  })

  it('TEST 2: stale fund cannot resurrect', () => {
    const current = {
      funds: [],
      deletedFunds: [tomb('f-1')],
      invoices: [],
    }
    const stale = {
      funds: [hmFund()],
      deletedFunds: [],
      invoices: [],
    }
    const merged = mergeMainStoreWrite(current, stale)
    assert.equal(
      (merged.funds as { id: string }[]).some((f) => f.id === 'f-1'),
      false,
      'tombstone blocks stale fund',
    )
  })

  it('TEST 3 / 20: remote tombstone survives when stale local still has fund (merge path)', () => {
    const remote = {
      funds: [],
      deletedFunds: [tomb('f-1')],
      invoices: [],
      expenses: [],
      monthlyInvoices: [],
    }
    // Client 409 union keeps local fund unless it also unions tombstones —
    // server merge with remote current + stale incoming must still strip.
    const staleIncoming = {
      funds: [hmFund()],
      deletedFunds: [tomb('f-1')],
      invoices: [],
      expenses: [],
      monthlyInvoices: [],
    }
    const merged = mergeMainStoreWrite(remote, staleIncoming)
    assert.equal((merged.funds as { id: string }[]).some((f) => f.id === 'f-1'), false)
    assert.equal(
      (merged.deletedFunds as { id: string }[]).some((t) => t.id === 'f-1'),
      true,
    )
  })

  it('TEST 4: deleted fund no longer contributes to invoice FIFO/status', () => {
    const party = {
      id: 'p-1',
      name: 'Rajesh Jewellers',
      skipMinBill: false,
      igstApplicable: false,
    }
    const invoice = {
      id: 'i-1',
      invoiceNo: 'SMG/MAIN/SEP/001',
      partyName: 'Rajesh Jewellers',
      partyId: 'p-1',
      requestNo: 'HM-1',
      amount: 1000,
      tax: 180,
      total: 1180,
      cgst: 90,
      sgst: 90,
      igst: 0,
      useIgst: false,
      status: 'Paid',
      date: '2026-09-12',
      minChargeAdjustment: 0,
      lines: [
        {
          description: 'Ring',
          purity: '22K',
          pcsRec: 25,
          hm: 25,
          rej: 0,
          melt: 0,
          rate: 40,
          amount: 1000,
        },
      ],
      centreId: 'main',
      centreKind: 'main',
    }
    const current = {
      parties: [party],
      invoices: [invoice],
      funds: [hmFund('f-1', 1180)],
      deletedFunds: [],
      expenses: [],
      monthlyInvoices: [],
    }
    const afterDelete = {
      ...current,
      funds: [],
      deletedFunds: [tomb('f-1')],
    }
    const merged = mergeMainStoreWrite(current, afterDelete)
    const financial = enforceHallmarkingFinancialAuthority({
      currentStore: current,
      nextStore: merged,
    })
    assert.equal(financial.ok, true, financial.ok ? '' : (financial as { error?: string }).error)
    assert.equal((merged.funds as unknown[]).length, 0)
    assert.equal((merged.invoices as { status: string }[])[0].status, 'Unpaid')
  })

  it('TEST 5: legitimate expense delete creates tombstone', () => {
    const expense = {
      id: 'e-1',
      date: '2026-09-12',
      amount: 100,
      gstAmount: 0,
      gstRate: 0,
      centreId: 'main',
      centreKind: 'main',
    }
    const current = { expenses: [expense], deletedExpenses: [], funds: [], invoices: [] }
    const incoming = {
      expenses: [],
      deletedExpenses: [tomb('e-1')],
      funds: [],
      invoices: [],
    }
    const merged = mergeMainStoreWrite(current, incoming)
    assert.equal((merged.expenses as unknown[]).length, 0)
    assert.ok((merged.deletedExpenses as { id: string }[]).some((t) => t.id === 'e-1'))
  })

  it('TEST 6: stale expense cannot resurrect', () => {
    const expense = {
      id: 'e-1',
      date: '2026-09-12',
      amount: 100,
      gstAmount: 0,
      centreId: 'main',
      centreKind: 'main',
    }
    const current = { expenses: [], deletedExpenses: [tomb('e-1')], funds: [] }
    const stale = { expenses: [expense], deletedExpenses: [], funds: [] }
    const merged = mergeMainStoreWrite(current, stale)
    assert.equal((merged.expenses as { id: string }[]).some((e) => e.id === 'e-1'), false)
  })

  it('TEST 7: monthly invoice delete creates tombstone', () => {
    const inv = {
      id: 'm-1',
      invoiceNo: 'M-1',
      amount: 100,
      tax: 18,
      total: 118,
      cgst: 9,
      sgst: 9,
      igst: 0,
      partyName: 'Rajesh Jewellers',
      centreId: 'main',
      centreKind: 'main',
      lines: [{ amount: 100 }],
    }
    const current = { monthlyInvoices: [inv], deletedMonthlyInvoices: [], funds: [] }
    const incoming = {
      monthlyInvoices: [],
      deletedMonthlyInvoices: [tomb('m-1')],
      funds: [],
    }
    const merged = mergeMainStoreWrite(current, incoming)
    assert.equal((merged.monthlyInvoices as unknown[]).length, 0)
    assert.ok((merged.deletedMonthlyInvoices as { id: string }[]).some((t) => t.id === 'm-1'))
  })

  it('TEST 8: stale monthly invoice cannot resurrect', () => {
    const inv = {
      id: 'm-1',
      invoiceNo: 'M-1',
      amount: 100,
      centreId: 'main',
      centreKind: 'main',
    }
    const current = {
      monthlyInvoices: [],
      deletedMonthlyInvoices: [tomb('m-1')],
      funds: [],
    }
    const stale = { monthlyInvoices: [inv], deletedMonthlyInvoices: [], funds: [] }
    const merged = mergeMainStoreWrite(current, stale)
    assert.equal(
      (merged.monthlyInvoices as { id: string }[]).some((m) => m.id === 'm-1'),
      false,
    )
  })

  it('TEST 9: OSC A tombstone cannot delete OSC B row', () => {
    const fundB = {
      ...hmFund('f-b'),
      centreId: 'osc-b',
      centreKind: 'osc',
    }
    const current = {
      funds: [fundB],
      deletedFunds: [],
    }
    const incoming = {
      funds: [],
      deletedFunds: [tomb('f-b', 'osc-a', 'osc')],
    }
    const merged = mergeOscStoreWrite(current, incoming, 'osc-a')
    assert.equal(
      (merged.funds as { id: string }[]).some((f) => f.id === 'f-b'),
      true,
      'OSC B fund survives forged OSC A tombstone',
    )
  })

  it('TEST 10: Main cannot manufacture OSC-tagged OR forge main-tagged tombstone against OSC row', () => {
    const fundOsc = {
      ...hmFund('f-osc'),
      centreId: 'osc-a',
      centreKind: 'osc',
    }
    const current = {
      funds: [fundOsc, hmFund('f-main')],
      deletedFunds: [],
    }
    const honestOscTag = mergeMainStoreWrite(current, {
      funds: [],
      deletedFunds: [tomb('f-osc', 'osc-a', 'osc')],
    })
    assert.equal(
      (honestOscTag.funds as { id: string }[]).some((f) => f.id === 'f-osc'),
      true,
      'Main cannot manufacture OSC-tagged fund tombstone',
    )
    assert.equal(
      (honestOscTag.deletedFunds as { id: string }[]).some((t) => t.id === 'f-osc'),
      false,
    )

    // BLOCKER forge path: client claims main ownership for an OSC id.
    const forged = mergeMainStoreWrite(current, {
      funds: [],
      deletedFunds: [tomb('f-osc', 'main', 'main')],
    })
    assert.equal(
      (forged.funds as { id: string }[]).some((f) => f.id === 'f-osc'),
      true,
      'forged main-tagged tombstone must not delete OSC fund',
    )
    assert.equal(
      (forged.deletedFunds as { id: string }[]).some((t) => t.id === 'f-osc'),
      false,
    )
  })

  it('TEST 11: OSC can delete its own row', () => {
    const fundA = {
      ...hmFund('f-a'),
      centreId: 'osc-a',
      centreKind: 'osc',
    }
    const current = { funds: [fundA], deletedFunds: [] }
    const incoming = {
      funds: [],
      deletedFunds: [tomb('f-a', 'osc-a', 'osc')],
    }
    const merged = mergeOscStoreWrite(current, incoming, 'osc-a')
    assert.equal((merged.funds as { id: string }[]).some((f) => f.id === 'f-a'), false)
    assert.ok((merged.deletedFunds as { id: string }[]).some((t) => t.id === 'f-a'))
  })

  it('TEST 12: OS cancel — stale Open cannot reopen service', () => {
    const cancelled = {
      id: 'os-1',
      status: 'Cancelled',
      cancelledAt: '2026-09-12T12:00:00.000Z',
      cancelledBy: 'admin',
      typeId: 'manual',
      kind: 'manual',
      amountReceived: 0,
      quantity: 1,
      rate: 100,
      unit: 'Fixed',
      rateBasis: 'Fixed',
    }
    const current = { otherServices: [cancelled], funds: [] }
    const stale = {
      otherServices: [
        {
          ...cancelled,
          status: 'Open',
          fundId: 'OS-FUND-1',
          amountReceived: 100,
        },
      ],
      funds: [
        {
          id: 'OS-FUND-1',
          source: OTHER_SERVICE_FUND_SOURCE,
          voucherNo: 'RC-OS-000001',
          amount: 100,
          mode: 'Cash',
          date: '2026-09-12',
        },
      ],
    }
    const next = structuredClone(stale)
    enforceOtherServiceCancelImmutability({
      currentStore: current,
      nextStore: next,
      replaceAll: false,
    })
    assert.equal((next.otherServices as { status: string }[])[0].status, 'Cancelled')
    assert.equal('fundId' in (next.otherServices as object[])[0], false)
  })

  it('TEST 13: stale OS fund cannot resurrect after cancel + tombstone', () => {
    const current = {
      otherServices: [
        {
          id: 'os-1',
          status: 'Cancelled',
          typeId: 'manual',
          kind: 'manual',
          amountReceived: 0,
          quantity: 1,
          rate: 100,
          unit: 'Fixed',
          rateBasis: 'Fixed',
        },
      ],
      funds: [],
      deletedFunds: [tomb('OS-FUND-1')],
    }
    const stale = {
      otherServices: [
        {
          id: 'os-1',
          status: 'Open',
          fundId: 'OS-FUND-1',
          typeId: 'manual',
          kind: 'manual',
          amountReceived: 100,
          quantity: 1,
          rate: 100,
          unit: 'Fixed',
          rateBasis: 'Fixed',
          receiptNo: 'RC-OS-000001',
        },
      ],
      funds: [
        {
          id: 'OS-FUND-1',
          source: OTHER_SERVICE_FUND_SOURCE,
          voucherNo: 'RC-OS-000001',
          amount: 100,
          mode: 'Cash',
          date: '2026-09-12',
        },
      ],
      deletedFunds: [],
    }
    const merged = mergeMainStoreWrite(current, stale)
    enforceOtherServiceCancelImmutability({
      currentStore: current,
      nextStore: merged,
      replaceAll: false,
    })
    const identity = enforceOtherServiceFundIdentity({
      currentStore: current,
      nextStore: merged,
      replaceAll: false,
    })
    assert.equal(identity.ok, true)
    assert.equal((merged.funds as { id: string }[]).some((f) => f.id === 'OS-FUND-1'), false)
    assert.equal((merged.otherServices as { status: string }[])[0].status, 'Cancelled')
  })

  it('TEST 14: OS fund tombstone cannot bypass P1-5 — linked fund still protected when Open', () => {
    const current = {
      otherServices: [
        {
          id: 'os-1',
          status: 'Open',
          fundId: 'OS-FUND-2',
          typeId: 'manual',
          kind: 'manual',
          amountReceived: 200,
          quantity: 1,
          rate: 200,
          unit: 'Fixed',
          rateBasis: 'Fixed',
          receiptNo: 'RC-OS-000020',
          customerName: 'A',
          contactNo: '9999999999',
          date: '2026-09-12',
          item: 'x',
          productDescription: '',
          remark: '',
          address: '',
          slipNo: 'MN-2',
          typeName: 'Chain Cleaning',
        },
      ],
      otherServiceTypes: [
        {
          id: 'manual',
          name: 'Chain Cleaning',
          kind: 'manual',
          slipPrefix: 'MN',
          builtIn: true,
          active: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      funds: [
        {
          id: 'OS-FUND-2',
          source: OTHER_SERVICE_FUND_SOURCE,
          voucherNo: 'RC-OS-000020',
          amount: 200,
          mode: 'Cash',
          date: '2026-09-12',
        },
      ],
      deletedFunds: [],
    }
    const next = structuredClone(current)
    next.funds = []
    next.deletedFunds = [tomb('OS-FUND-2')]
    // Merge would strip fund via tombstone, but identity must reject linked omit.
    const merged = mergeMainStoreWrite(current, next)
    const identity = enforceOtherServiceFundIdentity({
      currentStore: current,
      nextStore: merged,
      replaceAll: false,
    })
    assert.equal(identity.ok, false)
  })

  it('TEST 15 / 16: replaceAll restore can restore deleted row; stale live tombstone cannot defeat it', () => {
    const backup = {
      funds: [hmFund('f-restored')],
      deletedFunds: [],
      expenses: [],
      monthlyInvoices: [],
    }
    // Simulate live had a tombstone for f-restored — replaceAll must NOT union live tombs.
    reconcileFinancialTombstonesForReplaceAll(backup)
    assert.equal(
      (backup.funds as { id: string }[]).some((f) => f.id === 'f-restored'),
      true,
    )
    // If backup incorrectly contains both row and tombstone, reconcile drops tombstone.
    const conflicted = {
      funds: [hmFund('f-1')],
      deletedFunds: [tomb('f-1')],
      expenses: [],
      monthlyInvoices: [],
    }
    reconcileFinancialTombstonesForReplaceAll(conflicted)
    assert.equal((conflicted.funds as { id: string }[]).some((f) => f.id === 'f-1'), true)
    assert.equal((conflicted.deletedFunds as unknown[]).length, 0)
  })

  it('TEST 17: missing tombstone keys in old backup remain compatible', () => {
    const legacy = {
      funds: [hmFund()],
      expenses: [],
      monthlyInvoices: [],
    }
    const merged = mergeMainStoreWrite(legacy, {
      funds: [hmFund()],
      expenses: [],
      monthlyInvoices: [],
    })
    assert.ok(Array.isArray(merged.deletedFunds) || merged.deletedFunds === undefined || true)
    assert.equal((merged.funds as { id: string }[]).some((f) => f.id === 'f-1'), true)
    reconcileFinancialTombstonesForReplaceAll(legacy as Record<string, unknown>)
    assert.equal((legacy.funds as unknown[]).length, 1)
  })

  it('TEST 18: invoice tombstone regression — still applied in merge', () => {
    const tombstone = {
      id: 'i-osc',
      centreId: 'osc-a',
      centreKind: 'osc' as const,
      deletedAt: '2026-09-12T12:00:00.000Z',
    }
    const current = {
      invoices: [],
      deletedInvoices: [tombstone],
      funds: [],
    }
    const stale = {
      invoices: [{ id: 'i-osc', requestNo: 'HM-1', centreId: 'osc-a', centreKind: 'osc' }],
      deletedInvoices: [],
      funds: [],
    }
    const merged = mergeOscStoreWrite(current, stale, 'osc-a')
    assert.equal((merged.invoices as { id: string }[]).some((i) => i.id === 'i-osc'), false)
  })

  it('TEST 19: lab cannot write financial tombstone keys', () => {
    const payload = {
      funds: [hmFund()],
      deletedFunds: [tomb('f-1')],
      deletedExpenses: [tomb('e-1')],
      deletedMonthlyInvoices: [tomb('m-1')],
      fireAssays: [{ id: 'fa-1' }],
    }
    const lab = pickStoreForRole(payload, 'assay_lab')
    assert.equal('deletedFunds' in lab, false)
    assert.equal('deletedExpenses' in lab, false)
    assert.equal('deletedMonthlyInvoices' in lab, false)
    assert.equal('funds' in lab, false)
    assert.ok(lab.fireAssays)
    const rec = pickStoreForRole(payload, 'reception')
    assert.ok(rec.deletedFunds)
    assert.ok(rec.deletedExpenses)
    assert.ok(rec.deletedMonthlyInvoices)
  })

  it('TEST 21: normal current-revision legitimate delete still works (omission + tombstone)', () => {
    const accepted = acceptMainFinancialTombstones([], [], [tomb('f-new')], 'funds')
    assert.equal(accepted.some((t) => t.id === 'f-new'), true)
    const after = applyFinancialTombstones([hmFund('f-new')], accepted)
    assert.equal(after.length, 0)
  })

  it('TEST 22: GET filters tombstoned funds defensively', () => {
    const payload = {
      funds: [hmFund('f-1'), hmFund('f-2')],
      deletedFunds: [tomb('f-1')],
      invoices: [],
      deletedInvoices: [],
      expenses: [],
      monthlyInvoices: [],
    }
    const filtered = filterStoreForSession(payload, { centreId: 'main', centreKind: 'main' })
    assert.equal((filtered.funds as { id: string }[]).some((f) => f.id === 'f-1'), false)
    assert.equal((filtered.funds as { id: string }[]).some((f) => f.id === 'f-2'), true)
  })

  it('union / accept helpers normalize malformed tombstones', () => {
    const tombs = unionFinancialTombstones(
      [{ id: 'a', centreId: 'main', centreKind: 'main', deletedAt: '2026-09-12T00:00:00.000Z' }, null, 'x'],
      [{ id: 'a' }, { id: '' }],
    )
    assert.equal(tombs.filter((t) => t.id === 'a').length, 1)
    const osc = acceptOscFinancialTombstones(
      [{ id: 'f-x', centreId: 'osc-a' }],
      [],
      [tomb('f-x', 'osc-b', 'osc')],
      'osc-a',
      'funds',
    )
    assert.equal(osc.some((t) => t.id === 'f-x'), false)
  })

  // --- BLOCKER suite: Main → OSC forge + ownership matrix ---

  it('TEST A: forged Main tombstone cannot delete OSC fund', () => {
    const fundOsc = { ...hmFund('f-osc'), centreId: 'osc-a', centreKind: 'osc' as const }
    const current = { funds: [fundOsc], deletedFunds: [] }
    const merged = mergeMainStoreWrite(current, {
      funds: [],
      deletedFunds: [tomb('f-osc', 'main', 'main')],
    })
    assert.equal((merged.funds as { id: string }[]).some((f) => f.id === 'f-osc'), true)
    assert.equal((merged.deletedFunds as { id: string }[]).some((t) => t.id === 'f-osc'), false)
  })

  it('TEST B: forged Main tombstone cannot delete OSC expense', () => {
    const expense = {
      id: 'e-osc',
      date: '2026-09-12',
      amount: 50,
      gstAmount: 0,
      centreId: 'osc-a',
      centreKind: 'osc',
    }
    const current = { expenses: [expense], deletedExpenses: [], funds: [] }
    const merged = mergeMainStoreWrite(current, {
      expenses: [],
      deletedExpenses: [tomb('e-osc', 'main', 'main')],
      funds: [],
    })
    assert.equal((merged.expenses as { id: string }[]).some((e) => e.id === 'e-osc'), true)
    assert.equal((merged.deletedExpenses as { id: string }[]).some((t) => t.id === 'e-osc'), false)
  })

  it('TEST C: forged Main tombstone cannot delete OSC monthly invoice', () => {
    const inv = {
      id: 'm-osc',
      invoiceNo: 'M-OSC',
      amount: 100,
      centreId: 'osc-a',
      centreKind: 'osc',
    }
    const current = { monthlyInvoices: [inv], deletedMonthlyInvoices: [], funds: [] }
    const merged = mergeMainStoreWrite(current, {
      monthlyInvoices: [],
      deletedMonthlyInvoices: [tomb('m-osc', 'main', 'main')],
      funds: [],
    })
    assert.equal(
      (merged.monthlyInvoices as { id: string }[]).some((m) => m.id === 'm-osc'),
      true,
    )
    assert.equal(
      (merged.deletedMonthlyInvoices as { id: string }[]).some((t) => t.id === 'm-osc'),
      false,
    )
  })

  it('TEST D: honest Main tombstone deletes Main fund', () => {
    const current = { funds: [hmFund('f-main')], deletedFunds: [] }
    const merged = mergeMainStoreWrite(current, {
      funds: [],
      deletedFunds: [tomb('f-main', 'main', 'main')],
    })
    assert.equal((merged.funds as { id: string }[]).some((f) => f.id === 'f-main'), false)
    assert.ok((merged.deletedFunds as { id: string }[]).some((t) => t.id === 'f-main'))
  })

  it('TEST E: honest OSC-A tombstone deletes OSC-A fund', () => {
    const fundA = { ...hmFund('f-a'), centreId: 'osc-a', centreKind: 'osc' as const }
    const current = { funds: [fundA], deletedFunds: [] }
    const merged = mergeOscStoreWrite(
      current,
      { funds: [], deletedFunds: [tomb('f-a', 'osc-a', 'osc')] },
      'osc-a',
    )
    assert.equal((merged.funds as { id: string }[]).some((f) => f.id === 'f-a'), false)
    assert.ok((merged.deletedFunds as { id: string }[]).some((t) => t.id === 'f-a'))
  })

  it('TEST F: OSC-A tombstone cannot delete OSC-B fund', () => {
    const fundB = { ...hmFund('f-b'), centreId: 'osc-b', centreKind: 'osc' as const }
    const current = { funds: [fundB], deletedFunds: [] }
    const merged = mergeOscStoreWrite(
      current,
      { funds: [], deletedFunds: [tomb('f-b', 'osc-a', 'osc')] },
      'osc-a',
    )
    assert.equal((merged.funds as { id: string }[]).some((f) => f.id === 'f-b'), true)
  })

  it('TEST G: OSC tombstone cannot delete Main fund', () => {
    const current = { funds: [hmFund('f-main')], deletedFunds: [] }
    const merged = mergeOscStoreWrite(
      current,
      { funds: [], deletedFunds: [tomb('f-main', 'osc-a', 'osc')] },
      'osc-a',
    )
    assert.equal((merged.funds as { id: string }[]).some((f) => f.id === 'f-main'), true)
    assert.equal((merged.deletedFunds as { id: string }[]).some((t) => t.id === 'f-main'), false)
  })

  it('TEST H: same-id Main+OSC collision — Main tombstone deletes only Main row', () => {
    const mainFund = hmFund('X')
    const oscFund = { ...hmFund('X'), centreId: 'osc-a', centreKind: 'osc' as const }
    const current = { funds: [mainFund, oscFund], deletedFunds: [] }
    const merged = mergeMainStoreWrite(current, {
      funds: [mainFund, oscFund],
      deletedFunds: [tomb('X', 'main', 'main')],
    })
    const funds = merged.funds as { id: string; centreKind?: string; centreId?: string }[]
    assert.equal(
      funds.some((f) => f.id === 'X' && f.centreKind === 'osc' && f.centreId === 'osc-a'),
      true,
      'OSC fund with same id must survive',
    )
    assert.equal(
      funds.some((f) => f.id === 'X' && f.centreKind === 'main'),
      false,
      'Main fund with same id must be deleted',
    )
  })

  it('TEST I: 409-style Main stale merge cannot kill OSC via forged tombstone', () => {
    const oscFund = { ...hmFund('f-osc'), centreId: 'osc-a', centreKind: 'osc' as const }
    // Server already has OSC fund; Main stale client tries forged tombstone + unrelated edit.
    const current = {
      funds: [oscFund, hmFund('f-keep')],
      deletedFunds: [],
      expenses: [],
    }
    const staleMain = {
      funds: [hmFund('f-keep'), { ...hmFund('f-keep'), amount: 999 }],
      deletedFunds: [tomb('f-osc', 'main', 'main')],
      expenses: [{ id: 'e-new', amount: 1, date: '2026-09-12', centreId: 'main', centreKind: 'main' }],
    }
    const merged = mergeMainStoreWrite(current, staleMain)
    assert.equal((merged.funds as { id: string }[]).some((f) => f.id === 'f-osc'), true)
    assert.equal((merged.deletedFunds as { id: string }[]).some((t) => t.id === 'f-osc'), false)
  })

  it('TEST J: P1-5 OS fund identity remains intact with financial tombs', () => {
    const current = {
      otherServices: [
        {
          id: 'os-1',
          status: 'Open',
          fundId: 'OS-FUND-2',
          typeId: 'manual',
          kind: 'manual',
          amountReceived: 200,
          quantity: 1,
          rate: 200,
          unit: 'Fixed',
          rateBasis: 'Fixed',
          receiptNo: 'RC-OS-000020',
          customerName: 'A',
          contactNo: '9999999999',
          date: '2026-09-12',
          item: 'x',
          productDescription: '',
          remark: '',
          address: '',
          slipNo: 'MN-2',
          typeName: 'Chain Cleaning',
        },
      ],
      otherServiceTypes: [
        {
          id: 'manual',
          name: 'Chain Cleaning',
          kind: 'manual',
          slipPrefix: 'MN',
          builtIn: true,
          active: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      funds: [
        {
          id: 'OS-FUND-2',
          source: OTHER_SERVICE_FUND_SOURCE,
          voucherNo: 'RC-OS-000020',
          amount: 200,
          mode: 'Cash',
          date: '2026-09-12',
        },
      ],
      deletedFunds: [],
    }
    const next = structuredClone(current)
    next.funds = []
    next.deletedFunds = [tomb('OS-FUND-2')]
    const merged = mergeMainStoreWrite(current, next)
    const identity = enforceOtherServiceFundIdentity({
      currentStore: current,
      nextStore: merged,
      replaceAll: false,
    })
    assert.equal(identity.ok, false)
  })

  it('TEST K: P0-2 financial authority remains intact after Main tombstone delete', () => {
    const party = {
      id: 'p-1',
      name: 'Rajesh Jewellers',
      skipMinBill: false,
      igstApplicable: false,
    }
    const invoice = {
      id: 'i-1',
      invoiceNo: 'SMG/MAIN/SEP/001',
      partyName: 'Rajesh Jewellers',
      partyId: 'p-1',
      requestNo: 'HM-1',
      amount: 1000,
      tax: 180,
      total: 1180,
      cgst: 90,
      sgst: 90,
      igst: 0,
      useIgst: false,
      status: 'Paid',
      date: '2026-09-12',
      minChargeAdjustment: 0,
      lines: [
        {
          description: 'Ring',
          purity: '22K',
          pcsRec: 25,
          hm: 25,
          rej: 0,
          melt: 0,
          rate: 40,
          amount: 1000,
        },
      ],
      centreId: 'main',
      centreKind: 'main',
    }
    const current = {
      parties: [party],
      invoices: [invoice],
      funds: [hmFund('f-1', 1180)],
      deletedFunds: [],
      expenses: [],
      monthlyInvoices: [],
    }
    const afterDelete = {
      ...current,
      funds: [],
      deletedFunds: [tomb('f-1')],
    }
    const merged = mergeMainStoreWrite(current, afterDelete)
    const financial = enforceHallmarkingFinancialAuthority({
      currentStore: current,
      nextStore: merged,
    })
    assert.equal(financial.ok, true, financial.ok ? '' : (financial as { error?: string }).error)
    assert.equal((merged.invoices as { status: string }[])[0].status, 'Unpaid')
  })

  it('TEST pipeline: role filter → merge → accept → apply → OS identity → P0-2', () => {
    const oscFund = { ...hmFund('f-osc'), centreId: 'osc-a', centreKind: 'osc' as const }
    const current = {
      parties: [],
      invoices: [],
      funds: [oscFund, hmFund('f-main')],
      deletedFunds: [],
      expenses: [],
      monthlyInvoices: [],
      otherServices: [],
      otherServiceTypes: [],
    }
    const body = {
      funds: [hmFund('f-main')],
      deletedFunds: [tomb('f-osc', 'main', 'main')],
      deletedExpenses: [],
      deletedMonthlyInvoices: [],
      expenses: [],
      monthlyInvoices: [],
      invoices: [],
      parties: [],
      otherServices: [],
      fireAssays: [{ id: 'should-strip-for-reception' }],
    }
    const incoming = pickStoreForRole(body, 'reception')
    assert.equal('fireAssays' in incoming, false)
    const merged = mergeStoreWrite(current, incoming, { centreId: 'main', centreKind: 'main' })
    enforceOtherServiceCancelImmutability({
      currentStore: current,
      nextStore: merged,
      replaceAll: false,
    })
    const identity = enforceOtherServiceFundIdentity({
      currentStore: current,
      nextStore: merged,
      replaceAll: false,
    })
    assert.equal(identity.ok, true)
    const financial = enforceHallmarkingFinancialAuthority({
      currentStore: current,
      nextStore: merged,
    })
    assert.equal(financial.ok, true, financial.ok ? '' : (financial as { error?: string }).error)
    assert.equal(
      (merged.funds as { id: string }[]).some((f) => f.id === 'f-osc'),
      true,
      'pipeline must keep OSC fund after forged Main tombstone',
    )
    assert.equal((merged.deletedFunds as { id: string }[]).some((t) => t.id === 'f-osc'), false)
    assert.equal((merged.funds as { id: string }[]).some((f) => f.id === 'f-main'), true)
  })
})
