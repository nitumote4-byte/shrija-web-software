/**
 * Minimum hallmarking charge per request / job card / consignment.
 *
 * The rupee floor lives in Invoice Settings (`minBillAmount`), not in billing.
 * Billing only reads that stored value. Default for the setting is ₹200.
 */

export const DEFAULT_MIN_BILL_AMOUNT = 200

export type MinBillApplyOpts = {
  enabled: boolean
  minAmount: number
  skipMinBill: boolean
}

export function parseMinBillAmount(
  raw: unknown,
  fallback = DEFAULT_MIN_BILL_AMOUNT,
): number {
  if (raw == null || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Number(n.toFixed(2))
}

export function actualFromLines(lines: { amount: number }[]): number {
  return Number(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0).toFixed(2))
}

/** One adjustment per request. Never per article line. */
export function minBillAdjustment(actualCharge: number, opts: MinBillApplyOpts): number {
  if (!opts.enabled || opts.skipMinBill) return 0
  const min = Number(opts.minAmount)
  if (!Number.isFinite(min) || min <= 0) return 0
  const actual = Number(actualCharge) || 0
  const gap = Number((min - actual).toFixed(2))
  return gap > 0 ? gap : 0
}

/** Existing Billing / View Bills GST: 9%+9% or 18% IGST on taxable. */
export function gstOnTaxable(taxable: number, useIgst: boolean) {
  const cgst = useIgst ? 0 : Number((taxable * 0.09).toFixed(2))
  const sgst = useIgst ? 0 : Number((taxable * 0.09).toFixed(2))
  const igst = useIgst ? Number((taxable * 0.18).toFixed(2)) : 0
  const tax = cgst + sgst + igst
  return {
    cgst,
    sgst,
    igst,
    tax,
    grandTotal: Number((taxable + tax).toFixed(2)),
  }
}

export function invoiceTotalsFromActual(
  actualCharge: number,
  opts: MinBillApplyOpts & { useIgst: boolean },
) {
  const actual = Number((Number(actualCharge) || 0).toFixed(2))
  const minChargeAdjustment = minBillAdjustment(actual, opts)
  const taxable = Number((actual + minChargeAdjustment).toFixed(2))
  return {
    actual,
    minChargeAdjustment,
    taxable,
    ...gstOnTaxable(taxable, opts.useIgst),
  }
}
