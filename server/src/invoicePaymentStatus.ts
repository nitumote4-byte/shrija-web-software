/**
 * Shared Hallmarking invoice payment allocation (FIFO) and party balance.
 * Used by server financial authority and the SPA store — keep one implementation.
 */

import { isOtherServiceFund } from './otherServices.js'

export type PaymentStatusInvoice = {
  id: string
  partyName: string
  date: string
  invoiceNo: string
  total: number
  status: 'Unpaid' | 'Paid' | 'Partial'
}

export type PaymentStatusFund = {
  source?: string
  voucherNo?: string
  partyName?: string
  amount: number
}

export function normPartyName(name: string | undefined | null) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function fundBelongsToParty(f: PaymentStatusFund, partyName: string) {
  if (isOtherServiceFund(f)) return false
  const key = normPartyName(partyName)
  if (!key) return false
  return normPartyName(f.partyName) === key || normPartyName(f.source) === key
}

/**
 * Allocate party funds FIFO (oldest invoice first) → Paid / Partial / Unpaid.
 * Returns a map of invoiceId → status (does not mutate).
 */
export function computeInvoicePaymentStatuses(
  invoices: PaymentStatusInvoice[],
  funds: PaymentStatusFund[],
  partyName?: string,
): Map<string, PaymentStatusInvoice['status']> {
  const result = new Map<string, PaymentStatusInvoice['status']>()
  const partyKey = partyName ? normPartyName(partyName) : null

  const byParty = new Map<string, PaymentStatusInvoice[]>()
  for (const inv of invoices) {
    const k = normPartyName(inv.partyName)
    if (!k) continue
    if (partyKey && k !== partyKey) continue
    if (!byParty.has(k)) byParty.set(k, [])
    byParty.get(k)!.push(inv)
  }

  for (const [k, invs] of byParty) {
    let pool = funds
      .filter((f) => !isOtherServiceFund(f) && fundBelongsToParty(f, k))
      .reduce((s, f) => s + (Number(f.amount) || 0), 0)

    const sorted = [...invs].sort((a, b) => {
      const d = String(a.date || '').localeCompare(String(b.date || ''))
      if (d !== 0) return d
      return String(a.invoiceNo || '').localeCompare(String(b.invoiceNo || ''))
    })

    for (const inv of sorted) {
      const total = Number(inv.total) || 0
      if (pool <= 0.009) {
        result.set(inv.id, 'Unpaid')
      } else if (pool + 0.009 >= total) {
        result.set(inv.id, 'Paid')
        pool = Number((pool - total).toFixed(2))
      } else {
        result.set(inv.id, 'Partial')
        pool = 0
      }
    }
  }
  return result
}

/** Party outstanding: billed − paid (negative = advance / credit). */
export function calcPartyBalance(
  invoices: PaymentStatusInvoice[],
  funds: PaymentStatusFund[],
  partyName: string,
  excludeVoucherNo?: string,
) {
  const billed = invoices
    .filter((i) => normPartyName(i.partyName) === normPartyName(partyName))
    .reduce((s, i) => s + (Number(i.total) || 0), 0)
  const paid = funds
    .filter((f) => !isOtherServiceFund(f) && fundBelongsToParty(f, partyName))
    .filter((f) => !excludeVoucherNo || String(f.voucherNo) !== String(excludeVoucherNo))
    .reduce((s, f) => s + (Number(f.amount) || 0), 0)
  return Number((billed - paid).toFixed(2))
}
