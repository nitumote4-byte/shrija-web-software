import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  OTHER_SERVICE_FUND_SOURCE,
  enforceOtherServiceFundIdentity,
  getAuthoritativeOtherServiceFundIds,
  isOtherServiceFund,
  sanitizeOtherServicesStorePayload,
} from './otherServices.js'
import {
  calcPartyBalance,
  computeInvoicePaymentStatuses,
  type PaymentStatusFund,
  type PaymentStatusInvoice,
} from './invoicePaymentStatus.js'

function hmInvoice(): PaymentStatusInvoice {
  return {
    id: 'i1',
    invoiceNo: 'INV-1',
    partyName: 'Rajesh Jewellers',
    total: 1000,
    status: 'Unpaid',
    date: '2026-09-12',
  }
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function applyWrite(current: Record<string, unknown>, next: Record<string, unknown>, replaceAll = false) {
  const currentStore = deepClone(current)
  const nextStore = deepClone(next)
  sanitizeOtherServicesStorePayload(nextStore)
  return {
    result: enforceOtherServiceFundIdentity({ currentStore, nextStore, replaceAll }),
    nextStore,
  }
}

describe('Other Service fund identity (P1-5)', () => {
  it('TEST 1 — rejects HM → OS relabel via source + RC-OS voucher', () => {
    const current = {
      otherServices: [],
      funds: [
        {
          id: 'HM-FUND-1',
          date: '2026-09-12',
          source: 'Rajesh Jewellers',
          partyName: 'Rajesh Jewellers',
          amount: 1000,
          mode: 'Cash',
          voucherNo: '12',
        },
      ],
    }
    const next = {
      otherServices: [],
      funds: [
        {
          id: 'HM-FUND-1',
          date: '2026-09-12',
          source: OTHER_SERVICE_FUND_SOURCE,
          partyName: 'Rajesh Jewellers',
          amount: 1000,
          mode: 'Cash',
          voucherNo: 'RC-OS-999999',
        },
      ],
    }
    const { result, nextStore } = applyWrite(current, next)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, 'OS_FUND_IDENTITY_VIOLATION')

    // Original HM identity must remain usable for calculations (server state unchanged on reject).
    const funds = current.funds as PaymentStatusFund[]
    assert.equal(isOtherServiceFund(funds[0]), false)
    assert.equal(calcPartyBalance([hmInvoice()], funds, 'Rajesh Jewellers'), 0)
    assert.equal(computeInvoicePaymentStatuses([hmInvoice()], funds, 'Rajesh Jewellers').get('i1'), 'Paid')
    void nextStore
  })

  it('TEST 2 — rejects HM → OS relabel via voucher only', () => {
    const current = {
      otherServices: [],
      funds: [
        {
          id: 'HM-FUND-1',
          date: '2026-09-12',
          source: 'Rajesh Jewellers',
          partyName: 'Rajesh Jewellers',
          amount: 500,
          mode: 'Cash',
          voucherNo: '7',
        },
      ],
    }
    const next = {
      otherServices: [],
      funds: [
        {
          id: 'HM-FUND-1',
          date: '2026-09-12',
          source: 'Rajesh Jewellers',
          partyName: 'Rajesh Jewellers',
          amount: 500,
          mode: 'Cash',
          voucherNo: 'RC-OS-000777',
        },
      ],
    }
    const { result } = applyWrite(current, next)
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.match(result.error, /relabel/i)
    }
  })

  it('TEST 3 — preserves OS identity on detag / party injection', () => {
    const current = {
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
          fundId: 'OS-FUND-1',
          status: 'Open',
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
          id: 'OS-FUND-1',
          date: '2026-09-12',
          source: OTHER_SERVICE_FUND_SOURCE,
          amount: 250,
          mode: 'Cash',
          voucherNo: 'RC-OS-000001',
          remarks: 'Chain Cleaning · MN-000001 · Walk-in',
        },
      ],
    }
    const next = deepClone(current)
    const fund = (next.funds as Record<string, unknown>[])[0]
    fund.source = 'Rajesh Jewellers'
    fund.partyName = 'Rajesh Jewellers'
    fund.partyId = 'p1'
    fund.voucherNo = '88'
    fund.amount = 9999

    const { result, nextStore } = applyWrite(current, next)
    assert.equal(result.ok, true)
    const preserved = (nextStore.funds as Record<string, unknown>[])[0]
    assert.equal(preserved.source, OTHER_SERVICE_FUND_SOURCE)
    assert.equal(preserved.voucherNo, 'RC-OS-000001')
    assert.equal(preserved.amount, 250)
    assert.equal('partyName' in preserved, false)
    assert.equal('partyId' in preserved, false)
    assert.equal(isOtherServiceFund(preserved as PaymentStatusFund), true)
    assert.equal(
      calcPartyBalance([hmInvoice()], nextStore.funds as PaymentStatusFund[], 'Rajesh Jewellers'),
      1000,
    )
  })

  it('TEST 4 — rejects deletion of linked OS fund via raw funds omit', () => {
    const current = {
      otherServices: [
        {
          id: 'os-1',
          typeId: 'manual',
          typeName: 'Chain Cleaning',
          kind: 'manual',
          unit: 'Fixed',
          rateBasis: 'Fixed',
          quantity: 1,
          rate: 100,
          amountReceived: 100,
          paymentMode: 'Cash',
          customerName: 'A',
          contactNo: '9999999999',
          date: '2026-09-12',
          item: 'x',
          productDescription: '',
          remark: '',
          address: '',
          slipNo: 'MN-1',
          receiptNo: 'RC-OS-000010',
          fundId: 'OS-FUND-1',
          status: 'Open',
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
          id: 'OS-FUND-1',
          source: OTHER_SERVICE_FUND_SOURCE,
          amount: 100,
          voucherNo: 'RC-OS-000010',
          mode: 'Cash',
          date: '2026-09-12',
        },
      ],
    }
    const next = deepClone(current)
    next.funds = []
    const { result } = applyWrite(current, next)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /deleted/i)
  })

  it('TEST 5 — authoritative fields win over raw OS fund mutation', () => {
    const current = {
      otherServices: [
        {
          id: 'os-1',
          typeId: 'manual',
          typeName: 'Chain Cleaning',
          kind: 'manual',
          unit: 'Fixed',
          rateBasis: 'Fixed',
          quantity: 1,
          rate: 400,
          amountReceived: 400,
          paymentMode: 'UPI',
          customerName: 'A',
          contactNo: '9999999999',
          date: '2026-09-12',
          item: 'x',
          productDescription: '',
          remark: '',
          address: '',
          slipNo: 'MN-2',
          receiptNo: 'RC-OS-000020',
          fundId: 'OS-FUND-2',
          status: 'Open',
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
          amount: 400,
          voucherNo: 'RC-OS-000020',
          mode: 'UPI',
          date: '2026-09-12',
          remarks: 'Chain Cleaning · MN-2 · A',
        },
      ],
    }
    const next = deepClone(current)
    const fund = (next.funds as Record<string, unknown>[])[0]
    fund.amount = 1
    fund.source = 'Hacked'
    fund.voucherNo = '1'
    fund.partyName = 'Rajesh Jewellers'

    const { result, nextStore } = applyWrite(current, next)
    assert.equal(result.ok, true)
    const preserved = (nextStore.funds as Record<string, unknown>[])[0]
    assert.equal(preserved.amount, 400)
    assert.equal(preserved.source, OTHER_SERVICE_FUND_SOURCE)
    assert.equal(preserved.voucherNo, 'RC-OS-000020')
    assert.equal(preserved.mode, 'UPI')
    assert.equal('partyName' in preserved, false)
  })

  it('TEST 6 — legitimate OS create, payment sync, cancel unlink, no reprint fund', () => {
    const current = { otherServices: [], funds: [], otherServiceTypes: [] as unknown[] }
    const types = [
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
    ]
    current.otherServiceTypes = types

    // Create OS + linked fund in one write
    const created = {
      otherServiceTypes: types,
      otherServices: [
        {
          id: 'os-new',
          typeId: 'manual',
          typeName: 'Chain Cleaning',
          kind: 'manual',
          unit: 'Fixed',
          rateBasis: 'Fixed',
          quantity: 1,
          rate: 150,
          amountReceived: 150,
          paymentMode: 'Cash',
          customerName: 'Cust',
          contactNo: '9999999999',
          date: '2026-09-12',
          item: 'x',
          productDescription: '',
          remark: '',
          address: '',
          slipNo: 'MN-000099',
          receiptNo: 'RC-OS-000099',
          fundId: 'OS-NEW-1',
          status: 'Open',
        },
      ],
      funds: [
        {
          id: 'OS-NEW-1',
          date: '2026-09-12',
          source: OTHER_SERVICE_FUND_SOURCE,
          amount: 150,
          mode: 'Cash',
          voucherNo: 'RC-OS-000099',
        },
      ],
    }
    const createWrite = applyWrite(current, created)
    assert.equal(createWrite.result.ok, true)
    assert.equal(getAuthoritativeOtherServiceFundIds(createWrite.nextStore).has('OS-NEW-1'), true)
    const createdFund = (createWrite.nextStore.funds as Record<string, unknown>[])[0]
    assert.equal(createdFund.source, OTHER_SERVICE_FUND_SOURCE)
    assert.equal(createdFund.voucherNo, 'RC-OS-000099')

    // Payment update (amount change via OS row)
    const afterCreate = createWrite.nextStore
    const paid = deepClone(afterCreate)
    ;(paid.otherServices as Record<string, unknown>[])[0].amountReceived = 100
    const payWrite = applyWrite(afterCreate, paid)
    assert.equal(payWrite.result.ok, true)
    assert.equal((payWrite.nextStore.funds as Record<string, unknown>[])[0].amount, 100)

    // Cancel: clear fundId and omit fund
    const cancelled = deepClone(payWrite.nextStore)
    const osRow = (cancelled.otherServices as Record<string, unknown>[])[0]
    osRow.status = 'Cancelled'
    delete osRow.fundId
    osRow.amountReceived = 0
    cancelled.funds = []
    const cancelWrite = applyWrite(payWrite.nextStore, cancelled)
    assert.equal(cancelWrite.result.ok, true)
    assert.equal((cancelWrite.nextStore.funds as unknown[]).length, 0)

    // Reprint must not invent a second fund (no new fund without linkage)
    const reprint = deepClone(cancelWrite.nextStore)
    reprint.funds = [
      {
        id: 'OS-REPRINT-DUP',
        source: OTHER_SERVICE_FUND_SOURCE,
        voucherNo: 'RC-OS-000099',
        amount: 100,
        mode: 'Cash',
        date: '2026-09-12',
      },
    ]
    const reprintWrite = applyWrite(cancelWrite.nextStore, reprint)
    assert.equal(reprintWrite.result.ok, false)
  })

  it('TEST 7 — rejects arbitrary fake OS fund without Other Service linkage', () => {
    const current = { otherServices: [], funds: [] }
    const next = {
      otherServices: [],
      funds: [
        {
          id: 'FAKE-OS',
          source: OTHER_SERVICE_FUND_SOURCE,
          voucherNo: 'RC-OS-999999',
          amount: 5000,
          mode: 'Cash',
          date: '2026-09-12',
        },
      ],
    }
    const { result } = applyWrite(current, next)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /linked Other Service/i)
  })

  it('TEST 8 — genuine HM fund still participates in balance and payment status', () => {
    const funds: PaymentStatusFund[] = [
      {
        id: 'HM-FUND-8',
        date: '2026-09-12',
        source: 'Rajesh Jewellers',
        partyName: 'Rajesh Jewellers',
        amount: 1000,
        mode: 'Cash',
        remarks: 'HM',
        voucherNo: '3',
      },
    ]
    assert.equal(isOtherServiceFund(funds[0]), false)
    assert.equal(calcPartyBalance([hmInvoice()], funds, 'Rajesh Jewellers'), 0)
    assert.equal(computeInvoicePaymentStatuses([hmInvoice()], funds, 'Rajesh Jewellers').get('i1'), 'Paid')

    const current = { otherServices: [], funds: deepClone(funds) }
    const next = { otherServices: [], funds: deepClone(funds) }
    const { result, nextStore } = applyWrite(current, next)
    assert.equal(result.ok, true)
    assert.equal(isOtherServiceFund((nextStore.funds as PaymentStatusFund[])[0]), false)
    assert.equal(calcPartyBalance([hmInvoice()], nextStore.funds as PaymentStatusFund[], 'Rajesh Jewellers'), 0)
  })

  it('does not let another payload’s fundId classify an unrelated HM fund (tenant-local set)', () => {
    // Authoritative ids are derived only from the same store blob (already tenant-scoped on the server).
    const foreign = {
      otherServices: [{ fundId: 'HM-FUND-X' }],
      funds: [],
    }
    assert.equal(getAuthoritativeOtherServiceFundIds(foreign).has('HM-FUND-X'), true)

    const current = {
      otherServices: [],
      funds: [
        {
          id: 'HM-FUND-X',
          source: 'Rajesh Jewellers',
          partyName: 'Rajesh Jewellers',
          amount: 100,
          voucherNo: '1',
          mode: 'Cash',
          date: '2026-09-12',
        },
      ],
    }
    const next = {
      otherServices: [
        {
          id: 'os-forge',
          typeId: 'manual',
          typeName: 'Chain Cleaning',
          kind: 'manual',
          unit: 'Fixed',
          rateBasis: 'Fixed',
          quantity: 1,
          rate: 100,
          amountReceived: 100,
          paymentMode: 'Cash',
          customerName: 'A',
          contactNo: '9999999999',
          date: '2026-09-12',
          item: 'x',
          productDescription: '',
          remark: '',
          address: '',
          slipNo: 'MN-9',
          receiptNo: 'RC-OS-000009',
          fundId: 'HM-FUND-X',
          status: 'Open',
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
      funds: deepClone(current.funds),
    }
    const { result } = applyWrite(current, next)
    assert.equal(result.ok, false)
  })

  it('sanitize no longer promotes unlinked RC-OS markers into OS identity', () => {
    const payload = {
      otherServices: [],
      funds: [
        {
          id: 'f-orphan',
          source: 'Rajesh Jewellers',
          partyName: 'Rajesh Jewellers',
          voucherNo: 'RC-OS-000050',
          amount: 250,
        },
      ],
    } as Record<string, unknown>
    sanitizeOtherServicesStorePayload(payload)
    const fund = (payload.funds as Array<Record<string, unknown>>)[0]
    assert.equal(fund.source, 'Rajesh Jewellers')
    assert.equal(fund.partyName, 'Rajesh Jewellers')
  })
})
