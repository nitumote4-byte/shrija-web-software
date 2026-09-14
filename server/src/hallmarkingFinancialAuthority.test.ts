import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  enforceHallmarkingFinancialAuthority,
  parseInvoiceMinBillSettings,
} from './hallmarkingFinancialAuthority.js'
import {
  OTHER_SERVICE_FUND_SOURCE,
  enforceOtherServiceFundIdentity,
  sanitizeOtherServicesStorePayload,
} from './otherServices.js'
import { isAdminUser } from './rbac.js'
import { filterStoreForSession, mergeMainStoreWrite, mergeOscStoreWrite } from './tenantIsolation.js'

function deepClone<T>(value: T): T {
  return structuredClone(value)
}

function baseParty(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    name: 'Rajesh Jewellers',
    skipMinBill: false,
    igstApplicable: false,
    ...overrides,
  }
}

function baseInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    invoiceNo: 'SMG/MAIN/SEP/001',
    partyName: 'Rajesh Jewellers',
    partyId: 'p1',
    requestNo: 'HM-1',
    amount: 1000,
    tax: 180,
    total: 1180,
    cgst: 90,
    sgst: 90,
    igst: 0,
    useIgst: false,
    status: 'Unpaid',
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
    ...overrides,
  }
}

function baseFund(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f-1',
    date: '2026-09-12',
    source: 'Rajesh Jewellers',
    partyName: 'Rajesh Jewellers',
    amount: 500,
    mode: 'Cash',
    remarks: 'Collection',
    voucherNo: '1',
    ...overrides,
  }
}

function applyAuthority(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
  invoiceSettings: unknown = { minBillCharges: false, minBillAmount: 200 },
  replaceAll = false,
) {
  const currentStore = deepClone(current)
  const nextStore = deepClone(next)
  sanitizeOtherServicesStorePayload(nextStore)
  const identity = enforceOtherServiceFundIdentity({
    currentStore,
    nextStore,
    replaceAll,
  })
  if (!identity.ok) return { identity, financial: null, nextStore }
  const financial = enforceHallmarkingFinancialAuthority({
    currentStore,
    nextStore,
    replaceAll,
    invoiceSettings,
  })
  return { identity, financial, nextStore }
}

describe('hallmarking financial authority', () => {
  it('TEST 1: inflated invoice total is overwritten to authoritative value', () => {
    const current = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [],
      expenses: [],
      monthlyInvoices: [],
    }
    const next = {
      ...current,
      invoices: [baseInvoice({ total: 999999, tax: 1, cgst: 1, sgst: 0, amount: 50000 })],
    }
    const { financial, nextStore } = applyAuthority(current, next)
    assert.equal(financial?.ok, true)
    const inv = (nextStore.invoices as Record<string, unknown>[])[0]
    assert.equal(inv.amount, 1000)
    assert.equal(inv.total, 1180)
    assert.equal(inv.cgst, 90)
    assert.equal(inv.sgst, 90)
  })

  it('TEST 2: negative invoice total is rejected', () => {
    const current = {
      parties: [baseParty()],
      invoices: [],
      funds: [],
    }
    const next = {
      parties: [baseParty()],
      invoices: [
        baseInvoice({
          id: 'inv-new',
          lines: undefined,
          amount: -10,
          total: -10,
          cgst: 0,
          sgst: 0,
          igst: 0,
          tax: 0,
        }),
      ],
      funds: [],
    }
    // Strip lines so new-invoice path validates amount directly.
    delete (next.invoices as Record<string, unknown>[])[0].lines
    const { financial } = applyAuthority(current, next)
    assert.equal(financial?.ok, false)
    if (financial && !financial.ok) {
      assert.equal(financial.code, 'HM_FINANCIAL_VIOLATION')
      assert.match(financial.error, /negative/i)
    }
  })

  it('TEST 3: NaN / Infinity amounts are rejected', () => {
    const current = { parties: [baseParty()], invoices: [baseInvoice()], funds: [] }
    const next = {
      parties: [baseParty()],
      invoices: [baseInvoice({ lines: [{ ...baseInvoice().lines![0], hm: Number.NaN, rate: 40 }] })],
      funds: [],
    }
    const { financial } = applyAuthority(current, next)
    assert.equal(financial?.ok, false)

    const nextInf = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [baseFund({ amount: Number.POSITIVE_INFINITY })],
    }
    const r2 = applyAuthority(current, nextInf)
    assert.equal(r2.financial?.ok, false)
  })

  it('TEST 4: client paid/status is ignored; status derived from funds', () => {
    const current = {
      parties: [baseParty()],
      invoices: [baseInvoice({ status: 'Unpaid', total: 1180 })],
      funds: [],
    }
    const next = {
      parties: [baseParty()],
      invoices: [baseInvoice({ status: 'Paid', total: 1180 })],
      funds: [],
    }
    const unpaid = applyAuthority(current, next)
    assert.equal(unpaid.financial?.ok, true)
    assert.equal((unpaid.nextStore.invoices as Record<string, unknown>[])[0].status, 'Unpaid')

    const paidNext = {
      parties: [baseParty()],
      invoices: [baseInvoice({ status: 'Unpaid' })],
      funds: [baseFund({ amount: 1180 })],
    }
    const paid = applyAuthority(current, paidNext)
    assert.equal(paid.financial?.ok, true)
    assert.equal((paid.nextStore.invoices as Record<string, unknown>[])[0].status, 'Paid')
  })

  it('TEST 5: fake fund with invalid amount is rejected; valid fund accepted', () => {
    const current = { parties: [baseParty()], invoices: [baseInvoice()], funds: [] }
    const bad = applyAuthority(current, {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [baseFund({ amount: -50 })],
    })
    assert.equal(bad.financial?.ok, false)

    const good = applyAuthority(current, {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [baseFund({ amount: 200 })],
    })
    assert.equal(good.financial?.ok, true)
    assert.equal((good.nextStore.funds as Record<string, unknown>[])[0].amount, 200)
  })

  it('TEST 6: existing fund amount change allowed when finite and positive', () => {
    const current = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [baseFund({ amount: 500 })],
    }
    const next = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [baseFund({ amount: 800 })],
    }
    const { financial, nextStore } = applyAuthority(current, next)
    assert.equal(financial?.ok, true)
    assert.equal((nextStore.funds as Record<string, unknown>[])[0].amount, 800)
  })

  it('TEST 7: voucher number on existing fund is preserved', () => {
    const current = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [baseFund({ voucherNo: '42' })],
    }
    const next = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [baseFund({ voucherNo: 'HACKED-999', amount: 500 })],
    }
    const { financial, nextStore } = applyAuthority(current, next)
    assert.equal(financial?.ok, true)
    assert.equal((nextStore.funds as Record<string, unknown>[])[0].voucherNo, '42')
  })

  it('TEST 7b: invoice number on existing invoice is preserved', () => {
    const current = {
      parties: [baseParty()],
      invoices: [baseInvoice({ invoiceNo: 'SMG/MAIN/SEP/001' })],
      funds: [],
    }
    const next = {
      parties: [baseParty()],
      invoices: [baseInvoice({ invoiceNo: 'HACKED-INV' })],
      funds: [],
    }
    const { financial, nextStore } = applyAuthority(current, next)
    assert.equal(financial?.ok, true)
    assert.equal((nextStore.invoices as Record<string, unknown>[])[0].invoiceNo, 'SMG/MAIN/SEP/001')
  })

  it('TEST 8: fund omission (SPA delete) is permitted by authority layer', () => {
    // Role gating for who may omit is pickStoreForRole / merge; authority validates rows present.
    const current = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [baseFund()],
    }
    const next = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [],
    }
    const { financial, nextStore } = applyAuthority(current, next)
    assert.equal(financial?.ok, true)
    assert.equal((nextStore.funds as unknown[]).length, 0)
  })

  it('TEST 9: expense amount tampering is normalized; invalid rejected', () => {
    const current = {
      parties: [baseParty()],
      expenses: [
        {
          id: 'e-1',
          date: '2026-09-12',
          category: 'Rent',
          amount: 1000,
          gstAmount: 180,
          grossAmount: 1180,
          paidTo: 'Landlord',
          remarks: '',
          mode: 'Bank',
        },
      ],
    }
    const ok = applyAuthority(current, {
      parties: [baseParty()],
      expenses: [
        {
          id: 'e-1',
          date: '2026-09-12',
          category: 'Rent',
          amount: 1000,
          gstAmount: 180,
          grossAmount: 999999,
          paidTo: 'Landlord',
          remarks: '',
          mode: 'Bank',
        },
      ],
    })
    assert.equal(ok.financial?.ok, true)
    assert.equal((ok.nextStore.expenses as Record<string, unknown>[])[0].grossAmount, 1180)

    const bad = applyAuthority(current, {
      parties: [baseParty()],
      expenses: [
        {
          id: 'e-1',
          date: '2026-09-12',
          category: 'Rent',
          amount: Number.NaN,
          gstAmount: 0,
          paidTo: 'Landlord',
          remarks: '',
        },
      ],
    })
    assert.equal(bad.financial?.ok, false)
  })

  it('TEST 10: monthly invoice derived totals are recalculated', () => {
    const current = {
      parties: [baseParty()],
      monthlyInvoices: [
        {
          id: 'minv-1',
          invoiceNo: 'M-001',
          partyId: 'p1',
          partyName: 'Rajesh Jewellers',
          amount: 2000,
          cgst: 180,
          sgst: 180,
          igst: 0,
          tax: 360,
          total: 2360,
          useIgst: false,
          status: 'Unpaid',
          lines: [{ requestNo: 'HM-1', partyName: 'Rajesh Jewellers', date: '2026-09-01', articlesHm: 50, amount: 2000 }],
        },
      ],
    }
    const next = deepClone(current)
    ;(next.monthlyInvoices as Record<string, unknown>[])[0].total = 999999
    ;(next.monthlyInvoices as Record<string, unknown>[])[0].cgst = 1
    const { financial, nextStore } = applyAuthority(current, next)
    assert.equal(financial?.ok, true)
    const row = (nextStore.monthlyInvoices as Record<string, unknown>[])[0]
    assert.equal(row.amount, 2000)
    assert.equal(row.cgst, 180)
    assert.equal(row.sgst, 180)
    assert.equal(row.total, 2360)
    assert.equal(row.invoiceNo, 'M-001')
  })

  it('TEST 11: OSC merge drops foreign-centre financial rows before authority', () => {
    const current = {
      invoices: [baseInvoice({ id: 'inv-osc-a', centreId: 'osc-a', centreKind: 'osc' })],
      funds: [baseFund({ id: 'f-osc-a', centreId: 'osc-a', centreKind: 'osc' })],
      parties: [baseParty({ centreId: 'osc-a', centreKind: 'osc' })],
    }
    const incoming = {
      invoices: [
        baseInvoice({
          id: 'inv-foreign',
          centreId: 'osc-b',
          centreKind: 'osc',
          total: 999999,
        }),
        baseInvoice({ id: 'inv-osc-a', centreId: 'osc-a', centreKind: 'osc' }),
      ],
      funds: [baseFund({ id: 'f-osc-a', centreId: 'osc-a', centreKind: 'osc', amount: 100 })],
      parties: [baseParty({ centreId: 'osc-a', centreKind: 'osc' })],
    }
    const merged = mergeOscStoreWrite(current, incoming, 'osc-a')
    const ids = (merged.invoices as { id: string }[]).map((i) => i.id)
    assert.ok(!ids.includes('inv-foreign'))
    const { financial } = applyAuthority(current, merged)
    assert.equal(financial?.ok, true)
  })

  it('TEST 12: HM fund → OTHER_SERVICE attack remains blocked', () => {
    const current = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [baseFund()],
      otherServices: [],
    }
    const next = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [baseFund({ source: OTHER_SERVICE_FUND_SOURCE, voucherNo: 'RC-OS-000001' })],
      otherServices: [],
    }
    const { identity } = applyAuthority(current, next)
    assert.equal(identity.ok, false)
  })

  it('TEST 13: OS fund → HM attack remains blocked / isolated', () => {
    const current = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      otherServices: [
        {
          id: 'os-1',
          typeId: 'manual',
          typeName: 'Chain Cleaning',
          kind: 'manual',
          unit: 'Fixed',
          rateBasis: 'Fixed',
          quantity: 1,
          rate: 250,
          amountReceived: 250,
          paymentMode: 'Cash',
          customerName: 'Walk-in',
          contactNo: '9999999999',
          date: '2026-09-12',
          item: 'Clean',
          productDescription: '',
          remark: '',
          address: '',
          slipNo: 'MN-000001',
          receiptNo: 'RC-OS-000001',
          fundId: 'f-os',
          status: 'Open',
        },
      ],
      funds: [
        {
          id: 'f-os',
          date: '2026-09-12',
          source: OTHER_SERVICE_FUND_SOURCE,
          amount: 250,
          mode: 'Cash',
          remarks: 'OS',
          voucherNo: 'RC-OS-000001',
        },
      ],
    }
    const next = deepClone(current)
    ;(next.funds as Record<string, unknown>[])[0].source = 'Rajesh Jewellers'
    ;(next.funds as Record<string, unknown>[])[0].partyName = 'Rajesh Jewellers'
    ;(next.otherServices as Record<string, unknown>[])[0].fundId = undefined
    const { identity, financial, nextStore } = applyAuthority(current, next)
    assert.equal(identity.ok, true)
    assert.equal(financial?.ok, true)
    const fund = (nextStore.funds as Record<string, unknown>[])[0]
    assert.equal(fund.source, OTHER_SERVICE_FUND_SOURCE)
    assert.equal('partyName' in fund, false)
  })

  it('TEST 14: invoice tombstone prevents resurrection through stale PUT', () => {
    const tombstone = {
      id: 'inv-1',
      centreId: 'main',
      centreKind: 'main' as const,
      deletedAt: new Date().toISOString(),
    }
    const current = {
      parties: [baseParty()],
      invoices: [],
      deletedInvoices: [tombstone],
      funds: [],
    }
    const incoming = {
      parties: [baseParty()],
      invoices: [baseInvoice({ total: 999999 })],
      deletedInvoices: [tombstone],
      funds: [],
    }
    const merged = mergeMainStoreWrite(current, incoming)
    assert.equal(
      (merged.invoices as { id: string }[]).some((i) => i.id === 'inv-1'),
      false,
      'tombstone blocks resurrection in merge',
    )
    const filtered = filterStoreForSession(merged, { centreId: 'main', centreKind: 'main' })
    assert.equal(
      (filtered.invoices as { id: string }[]).some((i) => i.id === 'inv-1'),
      false,
    )
    const { financial } = applyAuthority(current, merged)
    assert.equal(financial?.ok, true)
  })

  it('recalculates GST when invoice lines are legitimately edited', () => {
    const current = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [],
    }
    const next = {
      parties: [baseParty()],
      invoices: [
        baseInvoice({
          lines: [
            {
              description: 'Ring',
              purity: '22K',
              pcsRec: 50,
              hm: 50,
              rej: 0,
              melt: 0,
              rate: 40,
              amount: 1,
            },
          ],
          amount: 1,
          total: 1,
        }),
      ],
      funds: [],
    }
    const { financial, nextStore } = applyAuthority(current, next)
    assert.equal(financial?.ok, true)
    const inv = (nextStore.invoices as Record<string, unknown>[])[0]
    assert.equal(inv.amount, 2000)
    assert.equal(inv.total, 2360)
  })

  it('parses invoice-settings KV defaults safely', () => {
    assert.deepEqual(parseInvoiceMinBillSettings(null), {
      enabled: false,
      minAmount: 200,
    })
    assert.equal(
      parseInvoiceMinBillSettings({ minBillCharges: true, minBillAmount: 250 }).enabled,
      true,
    )
  })

  it('TEST A: replaceAll must not preserve forged LIVE money when backup lines match', () => {
    const live = {
      parties: [baseParty()],
      invoices: [
        baseInvoice({
          amount: 50000,
          tax: 1,
          total: 999999,
          cgst: 1,
          sgst: 0,
          igst: 0,
        }),
      ],
      funds: [],
    }
    // Backup has same legitimate lines but its own (also forged) money fields — server must recalc.
    const backup = {
      parties: [baseParty()],
      invoices: [
        baseInvoice({
          amount: 1,
          tax: 1,
          total: 2,
          cgst: 0,
          sgst: 0,
          igst: 0,
        }),
      ],
      funds: [],
    }
    const { financial, nextStore } = applyAuthority(live, backup, undefined, true)
    assert.equal(financial?.ok, true)
    const inv = (nextStore.invoices as Record<string, unknown>[])[0]
    assert.equal(inv.amount, 1000, 'recalculated from backup lines, not live 50000')
    assert.equal(inv.total, 1180, 'must not keep live forged 999999')
    assert.equal(inv.cgst, 90)
    assert.equal(inv.sgst, 90)
    assert.notEqual(inv.total, 999999)
  })

  it('TEST B: replaceAll recalculates and ignores forged backup totals', () => {
    const current = {
      parties: [baseParty()],
      invoices: [],
      funds: [],
    }
    const backup = {
      parties: [baseParty()],
      invoices: [
        baseInvoice({
          amount: 777777,
          tax: 1,
          total: 888888,
          cgst: 1,
          sgst: 1,
          igst: 0,
        }),
      ],
      funds: [],
    }
    const { financial, nextStore } = applyAuthority(current, backup, undefined, true)
    assert.equal(financial?.ok, true)
    const inv = (nextStore.invoices as Record<string, unknown>[])[0]
    assert.equal(inv.amount, 1000)
    assert.equal(inv.total, 1180)
    assert.equal(inv.tax, 180)
  })

  it('TEST C: normal PUT with same lines still preserves server money', () => {
    const current = {
      parties: [baseParty()],
      invoices: [baseInvoice({ amount: 1000, total: 1180, cgst: 90, sgst: 90, tax: 180 })],
      funds: [],
    }
    const next = {
      parties: [baseParty()],
      invoices: [baseInvoice({ amount: 50000, total: 999999, cgst: 1, sgst: 0, tax: 1 })],
      funds: [],
    }
    const { financial, nextStore } = applyAuthority(current, next, undefined, false)
    assert.equal(financial?.ok, true)
    const inv = (nextStore.invoices as Record<string, unknown>[])[0]
    assert.equal(inv.amount, 1000)
    assert.equal(inv.total, 1180)
  })

  it('TEST D: normal PUT with changed lines recalculates', () => {
    const current = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [],
    }
    const next = {
      parties: [baseParty()],
      invoices: [
        baseInvoice({
          lines: [
            {
              description: 'Ring',
              purity: '22K',
              pcsRec: 50,
              hm: 50,
              rej: 0,
              melt: 0,
              rate: 40,
              amount: 999,
            },
          ],
          amount: 1,
          total: 1,
          cgst: 0,
          sgst: 0,
          tax: 0,
        }),
      ],
      funds: [],
    }
    const { financial, nextStore } = applyAuthority(current, next, undefined, false)
    assert.equal(financial?.ok, true)
    const inv = (nextStore.invoices as Record<string, unknown>[])[0]
    assert.equal(inv.amount, 2000)
    assert.equal(inv.total, 2360)
  })

  it('TEST E: replaceAll remains admin+main only', () => {
    const root = path.dirname(fileURLToPath(import.meta.url))
    const routeSrc = readFileSync(path.join(root, 'routes/data.ts'), 'utf8')
    assert.match(
      routeSrc,
      /Only a centre administrator can replace the full store/,
      'non-admin replaceAll is rejected',
    )
    assert.match(
      routeSrc,
      /replaceAll === true && centre\.centreKind === 'main' && isAdminUser\(req\.user!\)/,
      'effective replaceAll requires main + admin',
    )
    assert.equal(isAdminUser({ role: 'reception', isAdmin: false }), false)
    assert.equal(isAdminUser({ role: 'accountant', isAdmin: false }), false)
    assert.equal(isAdminUser({ role: 'admin', isAdmin: true }), true)
    assert.equal(isAdminUser({ role: 'quality_manager', isAdmin: false }), true)
  })

  it('TEST F: P1-5 OS/HM identity still enforced in authority pipeline', () => {
    const current = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [baseFund()],
      otherServices: [],
    }
    const hmToOs = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [baseFund({ source: OTHER_SERVICE_FUND_SOURCE, voucherNo: 'RC-OS-000001' })],
      otherServices: [],
    }
    const normal = applyAuthority(current, hmToOs, undefined, false)
    assert.equal(normal.identity.ok, false, 'normal PUT still rejects HM→OS relabel')

    // replaceAll restore path (Phase-2A): unlinked OS markers are isolated, not HM-allocated.
    const backup = {
      parties: [baseParty()],
      invoices: [baseInvoice()],
      funds: [
        baseFund({
          id: 'f-restore',
          source: OTHER_SERVICE_FUND_SOURCE,
          voucherNo: 'RC-OS-000050',
          partyName: 'Rajesh Jewellers',
          amount: 250,
        }),
      ],
      otherServices: [],
    }
    const restored = applyAuthority({ parties: [], invoices: [], funds: [], otherServices: [] }, backup, undefined, true)
    assert.equal(restored.identity.ok, true)
    assert.equal(restored.financial?.ok, true)
    const fund = (restored.nextStore.funds as Record<string, unknown>[])[0]
    assert.equal(fund.source, OTHER_SERVICE_FUND_SOURCE)
    assert.equal('partyName' in fund, false, 'restore isolation strips HM party linkage')
  })
})
