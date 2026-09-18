/**
 * Server-authoritative Hallmarking financial fields for PUT /api/data/store.
 *
 * The SPA still submits the JSON store blob. This layer:
 * - rejects non-finite / negative financial amounts
 * - recalculates invoice/monthly GST + totals from lines (or preserves server
 *   financial snapshot when an existing invoice's lines are unchanged)
 * - derives invoice payment status from funds (FIFO), never client status
 * - preserves invoiceNo / voucherNo identity on existing rows
 * - recalculates expense grossAmount
 * - leaves Phase-2A Other Service fund identity to enforceOtherServiceFundIdentity
 *
 * Does not invent new GST rules — reuses ./minBillCharge.js.
 */

import {
  actualFromLines,
  gstOnTaxable,
  invoiceTotalsFromActual,
  parseMinBillAmount,
  type MinBillApplyOpts,
} from './minBillCharge.js'
import {
  metalFromPurity,
  normalizeHallmarkMetal,
  resolveHallmarkMinConsignmentFee,
} from './hallmarkingRates.js'
import { isOtherServiceFund } from './otherServices.js'
import {
  computeInvoicePaymentStatuses,
  type PaymentStatusFund,
  type PaymentStatusInvoice,
} from './invoicePaymentStatus.js'

export const HM_FINANCIAL_VIOLATION = 'HM_FINANCIAL_VIOLATION' as const

export type HallmarkingFinancialAuthorityResult =
  | { ok: true }
  | {
      ok: false
      status: 400
      error: string
      code: typeof HM_FINANCIAL_VIOLATION
    }

export type InvoiceMinBillSettings = {
  enabled: boolean
  minAmount: number
}

const FUND_MODES = new Set(['Cash', 'UPI', 'Bank', 'Cheque'])
const EXPENSE_MODES = new Set(['Cash', 'Bank', 'UPI', 'Cheque'])
const PAY_STATUSES = new Set(['Unpaid', 'Paid', 'Partial'])

function fail(error: string): HallmarkingFinancialAuthorityResult {
  return { ok: false, status: 400, error, code: HM_FINANCIAL_VIOLATION }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function rowId(row: Record<string, unknown>): string {
  return String(row.id || '').trim()
}

function indexById(rows: unknown): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>()
  if (!Array.isArray(rows)) return map
  for (const raw of rows) {
    const row = asRecord(raw)
    if (!row) continue
    const id = rowId(row)
    if (id) map.set(id, row)
  }
  return map
}

function indexParties(rows: unknown): Map<string, Record<string, unknown>> {
  const byId = new Map<string, Record<string, unknown>>()
  const byName = new Map<string, Record<string, unknown>>()
  if (!Array.isArray(rows)) return byId
  for (const raw of rows) {
    const row = asRecord(raw)
    if (!row) continue
    const id = rowId(row)
    if (id) byId.set(id, row)
    const name = String(row.name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
    if (name) byName.set(name, row)
  }
  // Attach name index on the map object for lookup helper via closure — return byId only;
  // use resolveParty below with both.
  ;(byId as Map<string, Record<string, unknown>> & { __byName?: typeof byName }).__byName = byName
  return byId
}

function resolveParty(
  partiesById: Map<string, Record<string, unknown>>,
  partyId: unknown,
  partyName: unknown,
): Record<string, unknown> | null {
  const id = String(partyId || '').trim()
  if (id && partiesById.has(id)) return partiesById.get(id)!
  const name = String(partyName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  const byName = (partiesById as Map<string, Record<string, unknown>> & {
    __byName?: Map<string, Record<string, unknown>>
  }).__byName
  if (name && byName?.has(name)) return byName.get(name)!
  return null
}

/** Resolve Gold/Silver for Schedule IV min consignment from invoice context. */
function invoiceMetal(
  inv: Record<string, unknown>,
  store: Record<string, unknown>,
): string {
  if (Array.isArray(inv.lines)) {
    for (const raw of inv.lines) {
      const line = asRecord(raw)
      if (!line) continue
      const purity = String(line.purity || '')
      if (purity) return metalFromPurity(purity)
    }
  }
  const requestNo = String(inv.requestNo || '').trim()
  if (requestNo && Array.isArray(store.requests) && Array.isArray(store.categories)) {
    const req = store.requests
      .map((r) => asRecord(r))
      .find((r) => r && String(r.requestNo || '').trim() === requestNo)
    if (req) {
      const catId = String(req.categoryId || '').trim()
      const cat = store.categories
        .map((c) => asRecord(c))
        .find((c) => c && String(c.id || '').trim() === catId)
      const metal = normalizeHallmarkMetal(cat ? String(cat.metal || '') : '')
      if (metal) return metal
      if (req.purity) return metalFromPurity(String(req.purity))
    }
  }
  return 'Gold'
}

/** Finite number, optionally allowing zero. Rejects NaN / ±Infinity. */
export function assertFiniteMoney(
  value: unknown,
  label: string,
  opts?: { allowZero?: boolean; allowNegative?: boolean },
): { ok: true; value: number } | { ok: false; error: string } {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) {
    return { ok: false, error: `${label} must be a finite number` }
  }
  if (!opts?.allowNegative && n < 0) {
    return { ok: false, error: `${label} cannot be negative` }
  }
  if (!opts?.allowZero && n === 0) {
    return { ok: false, error: `${label} must be greater than zero` }
  }
  if (opts?.allowZero && n < 0 && !opts.allowNegative) {
    return { ok: false, error: `${label} cannot be negative` }
  }
  return { ok: true, value: Number(n.toFixed(2)) }
}

export function parseInvoiceMinBillSettings(raw: unknown): InvoiceMinBillSettings {
  const defaults: InvoiceMinBillSettings = {
    enabled: false,
    minAmount: parseMinBillAmount(undefined),
  }
  if (raw == null) return defaults
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return defaults
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults
  const rec = parsed as Record<string, unknown>
  return {
    enabled: Boolean(rec.minBillCharges),
    minAmount: parseMinBillAmount(rec.minBillAmount),
  }
}

function linesFingerprint(lines: unknown): string {
  if (!Array.isArray(lines)) return ''
  return lines
    .map((raw) => {
      const l = asRecord(raw)
      if (!l) return ''
      return [
        String(l.description || ''),
        String(l.purity || ''),
        Number(l.pcsRec) || 0,
        Number(l.hm) || 0,
        Number(l.rej) || 0,
        Number(l.melt) || 0,
        Number(l.rate) || 0,
      ].join('|')
    })
    .join(';')
}

function normalizeInvoiceLines(lines: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(lines)) return null
  const out: Record<string, unknown>[] = []
  for (const raw of lines) {
    const l = asRecord(raw)
    if (!l) return null
    const hm = Number(l.hm)
    const rate = Number(l.rate)
    if (!Number.isFinite(hm) || hm < 0 || !Number.isFinite(rate) || rate < 0) return null
    const amount = Number((Math.max(0, hm) * rate).toFixed(2))
    out.push({
      ...l,
      pcsRec: Number(l.pcsRec) || 0,
      hm: Math.max(0, hm),
      rej: Number(l.rej) || 0,
      melt: Number(l.melt) || 0,
      rate,
      amount,
    })
  }
  return out
}

function applyInvoiceTotalsFromActual(
  inv: Record<string, unknown>,
  actual: number,
  minBill: MinBillApplyOpts & { useIgst: boolean },
) {
  const totals = invoiceTotalsFromActual(actual, minBill)
  inv.amount = totals.taxable
  inv.minChargeAdjustment = totals.minChargeAdjustment
  inv.cgst = totals.cgst
  inv.sgst = totals.sgst
  inv.igst = totals.igst
  inv.tax = totals.tax
  inv.total = totals.grandTotal
  inv.useIgst = Boolean(minBill.useIgst)
}

function preserveServerInvoiceMoney(inv: Record<string, unknown>, prev: Record<string, unknown>) {
  for (const key of [
    'amount',
    'tax',
    'total',
    'cgst',
    'sgst',
    'igst',
    'useIgst',
    'minChargeAdjustment',
  ] as const) {
    if (key in prev) inv[key] = prev[key]
  }
}

function authorizeInvoices(
  currentStore: Record<string, unknown>,
  nextStore: Record<string, unknown>,
  minBillSettings: InvoiceMinBillSettings,
  replaceAll: boolean,
): HallmarkingFinancialAuthorityResult {
  if (!Array.isArray(nextStore.invoices)) return { ok: true }

  const prevById = indexById(currentStore.invoices)
  const partiesById = indexParties(nextStore.parties ?? currentStore.parties)
  const nextInvoices: Record<string, unknown>[] = []

  for (const raw of nextStore.invoices) {
    const inv = asRecord(raw)
    if (!inv) return fail('Invalid invoice row')
    const id = rowId(inv)
    if (!id) return fail('Invoice id is required')

    const prev = prevById.get(id)
    // Normal PUT: server owns serial identity for existing rows.
    // replaceAll restore: keep backup identity fields (do not copy live serials).
    if (prev && !replaceAll) {
      if (prev.invoiceNo != null) inv.invoiceNo = prev.invoiceNo
      if (prev.operationalPeriod != null) inv.operationalPeriod = prev.operationalPeriod
    }

    const party = resolveParty(partiesById, inv.partyId, inv.partyName)
    const useIgst = party
      ? Boolean(party.igstApplicable)
      : Boolean(inv.useIgst ?? (!replaceAll ? prev?.useIgst : undefined))
    const skipMinBill = party ? Boolean(party.skipMinBill) : false
    const metal = invoiceMetal(inv, nextStore)
    const minOpts: MinBillApplyOpts & { useIgst: boolean } = {
      enabled: minBillSettings.enabled,
      minAmount: resolveHallmarkMinConsignmentFee(metal, minBillSettings.minAmount),
      skipMinBill,
      useIgst,
    }

    const normalizedLines = normalizeInvoiceLines(inv.lines)
    if (inv.lines != null && normalizedLines == null) {
      return fail('Invoice line amounts are invalid')
    }
    if (normalizedLines) {
      inv.lines = normalizedLines
      const actual = actualFromLines(normalizedLines as { amount: number }[])
      if (replaceAll) {
        // Backup restore: always recalculate from backup lines. Never preserve live money.
        applyInvoiceTotalsFromActual(inv, actual, minOpts)
      } else {
        const linesChanged = !prev || linesFingerprint(prev.lines) !== linesFingerprint(normalizedLines)
        if (!prev || linesChanged) {
          applyInvoiceTotalsFromActual(inv, actual, minOpts)
        } else {
          // Unchanged lines: ignore client-inflated money fields.
          preserveServerInvoiceMoney(inv, prev)
        }
      }
    } else if (prev && !replaceAll) {
      // Legacy row without lines — keep server money; do not trust client totals.
      preserveServerInvoiceMoney(inv, prev)
    } else {
      // New invoice without lines, or replaceAll legacy row: taxable from payload, GST server-side.
      const amountCheck = assertFiniteMoney(inv.amount, 'Invoice amount', { allowZero: true })
      if (!amountCheck.ok) return fail(amountCheck.error)
      const gst = gstOnTaxable(amountCheck.value, useIgst)
      inv.amount = amountCheck.value
      inv.cgst = gst.cgst
      inv.sgst = gst.sgst
      inv.igst = gst.igst
      inv.tax = gst.tax
      inv.total = gst.grandTotal
      inv.useIgst = useIgst
      inv.minChargeAdjustment = Number(inv.minChargeAdjustment) || 0
    }

    for (const key of ['amount', 'tax', 'total', 'cgst', 'sgst', 'igst'] as const) {
      if (!(key in inv) || inv[key] == null) continue
      const check = assertFiniteMoney(inv[key], `Invoice ${key}`, { allowZero: true })
      if (!check.ok) return fail(check.error)
      inv[key] = check.value
    }

    // Status is always derived later from funds; strip client-paid fiction for now.
    if (!PAY_STATUSES.has(String(inv.status || ''))) {
      inv.status = (!replaceAll && prev?.status) || 'Unpaid'
    }

    nextInvoices.push(inv)
  }

  nextStore.invoices = nextInvoices
  return { ok: true }
}

function authorizeMonthlyInvoices(
  currentStore: Record<string, unknown>,
  nextStore: Record<string, unknown>,
  replaceAll: boolean,
): HallmarkingFinancialAuthorityResult {
  if (!Array.isArray(nextStore.monthlyInvoices)) return { ok: true }

  const prevById = indexById(currentStore.monthlyInvoices)
  const partiesById = indexParties(nextStore.parties ?? currentStore.parties)
  const nextRows: Record<string, unknown>[] = []

  for (const raw of nextStore.monthlyInvoices) {
    const inv = asRecord(raw)
    if (!inv) return fail('Invalid monthly invoice row')
    const id = rowId(inv)
    if (!id) return fail('Monthly invoice id is required')

    const prev = prevById.get(id)
    if (prev && !replaceAll) {
      if (prev.invoiceNo != null) inv.invoiceNo = prev.invoiceNo
      if (prev.operationalPeriod != null) inv.operationalPeriod = prev.operationalPeriod
    }

    const party = resolveParty(partiesById, inv.partyId, inv.partyName)
    const useIgst = party
      ? Boolean(party.igstApplicable)
      : Boolean(inv.useIgst ?? (!replaceAll ? prev?.useIgst : undefined))

    if (Array.isArray(inv.lines)) {
      let amount = 0
      for (const lineRaw of inv.lines) {
        const line = asRecord(lineRaw)
        if (!line) return fail('Invalid monthly invoice line')
        const lineAmt = assertFiniteMoney(line.amount, 'Monthly invoice line amount', {
          allowZero: true,
        })
        if (!lineAmt.ok) return fail(lineAmt.error)
        line.amount = lineAmt.value
        amount = Number((amount + lineAmt.value).toFixed(2))
      }
      inv.amount = amount
    } else if (prev && !replaceAll && 'amount' in prev) {
      inv.amount = prev.amount
    }

    const amountCheck = assertFiniteMoney(inv.amount, 'Monthly invoice amount', { allowZero: true })
    if (!amountCheck.ok) return fail(amountCheck.error)
    const gst = gstOnTaxable(amountCheck.value, useIgst)
    inv.amount = amountCheck.value
    inv.cgst = gst.cgst
    inv.sgst = gst.sgst
    inv.igst = gst.igst
    inv.tax = gst.tax
    inv.total = gst.grandTotal
    inv.useIgst = useIgst

    if (!PAY_STATUSES.has(String(inv.status || ''))) {
      inv.status = (!replaceAll && prev?.status) || 'Unpaid'
    }

    nextRows.push(inv)
  }

  nextStore.monthlyInvoices = nextRows
  return { ok: true }
}

function authorizeFunds(
  currentStore: Record<string, unknown>,
  nextStore: Record<string, unknown>,
  replaceAll: boolean,
): HallmarkingFinancialAuthorityResult {
  if (!Array.isArray(nextStore.funds)) return { ok: true }

  const prevById = indexById(currentStore.funds)
  const nextFunds: Record<string, unknown>[] = []

  for (const raw of nextStore.funds) {
    const fund = asRecord(raw)
    if (!fund) return fail('Invalid fund row')
    const id = rowId(fund)
    if (!id) return fail('Fund id is required')

    const prev = prevById.get(id)
    const osPrev =
      prev &&
      isOtherServiceFund({
        source: String(prev.source || ''),
        voucherNo: String(prev.voucherNo || ''),
      })
    const osNext = isOtherServiceFund({
      source: String(fund.source || ''),
      voucherNo: String(fund.voucherNo || ''),
    })

    // Hallmarking path must not rewrite OS vouchers; Phase-2A owns those.
    if (osPrev || osNext) {
      nextFunds.push(fund)
      continue
    }

    // Normal PUT: preserve live voucher identity. replaceAll: keep backup voucherNo.
    if (prev?.voucherNo != null && !replaceAll) {
      fund.voucherNo = prev.voucherNo
    }

    const amountCheck = assertFiniteMoney(fund.amount, 'Fund amount', { allowZero: false })
    if (!amountCheck.ok) return fail(amountCheck.error)
    fund.amount = amountCheck.value

    const mode = String(fund.mode || 'Cash')
    if (!FUND_MODES.has(mode)) return fail('Fund payment mode is invalid')
    fund.mode = mode

    if (!String(fund.source || fund.partyName || '').trim()) {
      return fail('Fund source / party is required')
    }

    nextFunds.push(fund)
  }

  nextStore.funds = nextFunds
  return { ok: true }
}

function authorizeExpenses(
  currentStore: Record<string, unknown>,
  nextStore: Record<string, unknown>,
): HallmarkingFinancialAuthorityResult {
  if (!Array.isArray(nextStore.expenses)) return { ok: true }

  const prevById = indexById(currentStore.expenses)
  const nextExpenses: Record<string, unknown>[] = []

  for (const raw of nextStore.expenses) {
    const exp = asRecord(raw)
    if (!exp) return fail('Invalid expense row')
    const id = rowId(exp)
    if (!id) return fail('Expense id is required')

    const prev = prevById.get(id)
    if (!('amount' in exp) || exp.amount === undefined) {
      if (prev && 'amount' in prev) exp.amount = prev.amount
    }
    if (!('gstAmount' in exp) || exp.gstAmount === undefined) {
      if (prev && 'gstAmount' in prev) exp.gstAmount = prev.gstAmount
      else exp.gstAmount = 0
    }

    const amountCheck = assertFiniteMoney(exp.amount, 'Expense amount', {
      allowZero: true,
    })
    if (!amountCheck.ok) return fail(amountCheck.error)
    const gstCheck = assertFiniteMoney(exp.gstAmount, 'Expense GST', {
      allowZero: true,
    })
    if (!gstCheck.ok) return fail(gstCheck.error)

    exp.amount = amountCheck.value
    exp.gstAmount = gstCheck.value
    const gstRate = Number(exp.gstRate) || 0
    if (!Number.isFinite(gstRate) || gstRate < 0) {
      return fail('Expense GST rate is invalid')
    }
    exp.gstRate = gstRate
    exp.grossAmount = Number((amountCheck.value + gstCheck.value).toFixed(2))

    if (exp.mode != null && exp.mode !== '') {
      const mode = String(exp.mode)
      if (!EXPENSE_MODES.has(mode)) return fail('Expense payment mode is invalid')
      exp.mode = mode
    }

    if (!String(exp.date || '').trim()) return fail('Expense date is required')

    nextExpenses.push(exp)
  }

  nextStore.expenses = nextExpenses
  return { ok: true }
}

/**
 * Overwrite Hallmarking invoice payment status from authoritative funds (FIFO).
 * Monthly invoice status is not fund-derived in the current product model.
 */
function applyDerivedInvoiceStatuses(nextStore: Record<string, unknown>) {
  if (!Array.isArray(nextStore.invoices)) return
  const invoices = nextStore.invoices as PaymentStatusInvoice[]
  const funds = (Array.isArray(nextStore.funds) ? nextStore.funds : []) as PaymentStatusFund[]
  const statuses = computeInvoicePaymentStatuses(invoices, funds)
  const now = new Date().toISOString()
  for (const inv of nextStore.invoices as Record<string, unknown>[]) {
    const id = rowId(inv)
    const next = statuses.get(id)
    if (!next) {
      inv.status = 'Unpaid'
      continue
    }
    if (inv.status !== next) {
      inv.status = next
      inv.updatedAt = now
    }
  }
}

/**
 * Enforce Hallmarking financial authority on a merged (or replaceAll) store payload.
 * Mutates nextStore in place. Call after centre merge + OS fund identity.
 *
 * Normal PUT: preserve live money when existing invoice lines are unchanged.
 * replaceAll: always recalculate from backup lines / rules — never preserve live money.
 */
export function enforceHallmarkingFinancialAuthority(opts: {
  currentStore: Record<string, unknown>
  nextStore: Record<string, unknown>
  replaceAll?: boolean
  invoiceSettings?: InvoiceMinBillSettings | unknown
}): HallmarkingFinancialAuthorityResult {
  const { currentStore, nextStore } = opts
  const replaceAll = opts.replaceAll === true
  const minBillSettings = parseInvoiceMinBillSettings(opts.invoiceSettings)

  const steps = [
    () => authorizeInvoices(currentStore, nextStore, minBillSettings, replaceAll),
    () => authorizeMonthlyInvoices(currentStore, nextStore, replaceAll),
    () => authorizeFunds(currentStore, nextStore, replaceAll),
    () => authorizeExpenses(currentStore, nextStore),
  ]
  for (const step of steps) {
    const result = step()
    if (!result.ok) return result
  }

  applyDerivedInvoiceStatuses(nextStore)
  return { ok: true }
}
