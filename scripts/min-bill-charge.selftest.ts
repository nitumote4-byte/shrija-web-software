/**
 * Minimum bill charge per job card — settings amount, once-per-request
 * adjustment, GST, party skip, edit recalc, monthly must not re-apply.
 * Run: npx --yes tsx scripts/min-bill-charge.selftest.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  actualFromLines,
  DEFAULT_MIN_BILL_AMOUNT,
  invoiceTotalsFromActual,
  minBillAdjustment,
  parseMinBillAmount,
} from '../src/utils/minBillCharge.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const MIN = parseMinBillAmount(undefined)
assertEq(MIN, 200, 'Invoice Settings default amount is ₹200')
assertEq(DEFAULT_MIN_BILL_AMOUNT, 200, 'stored default constant is ₹200')
assertEq(parseMinBillAmount(200), 200, 'explicit stored 200 is used')
assertEq(parseMinBillAmount('200'), 200, 'string 200 from settings is used')

const on = { enabled: true, minAmount: MIN, skipMinBill: false }
const off = { enabled: false, minAmount: MIN, skipMinBill: false }

// --- 1. Minimum OFF: actual ₹90 → taxable ₹90 ---
{
  const t = invoiceTotalsFromActual(90, { ...off, useIgst: false })
  assertEq(t.actual, 90, 'OFF keeps actual 90')
  assertEq(t.minChargeAdjustment, 0, 'OFF adds no adjustment')
  assertEq(t.taxable, 90, 'OFF taxable is 90')
}

// --- 2. Minimum ON: actual ₹90 → adjustment ₹110 → taxable ₹200 ---
{
  const t = invoiceTotalsFromActual(90, { ...on, useIgst: false })
  assertEq(t.actual, 90, 'ON keeps actual hallmarking 90')
  assertEq(t.minChargeAdjustment, 110, 'ON adjustment is 200-90=110')
  assertEq(t.taxable, 200, 'ON taxable is 200')
}

// --- 3. Actual exactly ₹200 → adjustment ₹0 ---
{
  const t = invoiceTotalsFromActual(200, { ...on, useIgst: false })
  assertEq(t.minChargeAdjustment, 0, 'exact 200 has no adjustment')
  assertEq(t.taxable, 200, 'exact 200 taxable stays 200')
}

// --- 4. Actual ₹250 → adjustment ₹0 ---
{
  const t = invoiceTotalsFromActual(250, { ...on, useIgst: false })
  assertEq(t.minChargeAdjustment, 0, '250 has no adjustment')
  assertEq(t.taxable, 250, '250 taxable stays 250')
}

// --- 5. Party Skip Minimum ON: actual ₹90 → taxable ₹90 ---
{
  const t = invoiceTotalsFromActual(90, {
    enabled: true,
    minAmount: MIN,
    skipMinBill: true,
    useIgst: false,
  })
  assertEq(t.minChargeAdjustment, 0, 'party skip adds no adjustment')
  assertEq(t.taxable, 90, 'party skip taxable is actual 90')
}

// --- 6. Multiple items: one adjustment on the total, not per line ---
{
  const lines = [{ amount: 45 }, { amount: 45 }, { amount: 40 }]
  const actual = actualFromLines(lines)
  assertEq(actual, 130, 'three items sum to 130')
  const t = invoiceTotalsFromActual(actual, { ...on, useIgst: false })
  assertEq(t.minChargeAdjustment, 70, 'one adjustment 200-130=70')
  assertEq(t.taxable, 200, 'multi-item taxable is 200')
  const perLine = lines.reduce((s, l) => s + minBillAdjustment(l.amount, on), 0)
  assertEq(perLine, 470, 'naive per-line shortfalls would be 470')
  assert(t.minChargeAdjustment !== perLine, 'must not use per-line adjustments')
}

// --- 7. GST intra-state: taxable ₹200 → CGST ₹18 + SGST ₹18 ---
{
  const t = invoiceTotalsFromActual(90, { ...on, useIgst: false })
  assertEq(t.taxable, 200, 'intra-state taxable 200')
  assertEq(t.cgst, 18, 'CGST 9% of 200 = 18')
  assertEq(t.sgst, 18, 'SGST 9% of 200 = 18')
  assertEq(t.igst, 0, 'intra-state IGST is 0')
  assertEq(t.grandTotal, 236, 'grand total 236')
}

// --- 8. GST inter-state: taxable ₹200 → IGST ₹36 ---
{
  const t = invoiceTotalsFromActual(90, { ...on, useIgst: true })
  assertEq(t.taxable, 200, 'IGST taxable 200')
  assertEq(t.cgst, 0, 'IGST CGST is 0')
  assertEq(t.sgst, 0, 'IGST SGST is 0')
  assertEq(t.igst, 36, 'IGST 18% of 200 = 36')
  assertEq(t.grandTotal, 236, 'IGST grand total 236')
}

// --- 9. Edit/recalculation does not remove the adjustment ---
{
  const edited = {
    hm: 2,
    rate: 45,
    amount: Number((Math.max(0, 2) * 45).toFixed(2)),
  }
  assertEq(edited.amount, 90, 'edit still computes line as hm × rate')
  const t = invoiceTotalsFromActual(edited.amount, { ...on, useIgst: false })
  assertEq(t.minChargeAdjustment, 110, 'recalc after hm×rate still adds 110')
  assertEq(t.taxable, 200, 'recalc taxable remains 200')
  const again = invoiceTotalsFromActual(t.actual, { ...on, useIgst: false })
  assertEq(again.minChargeAdjustment, 110, 'second apply on actual does not duplicate')
  assertEq(again.taxable, 200, 'second apply taxable still 200')
}

// --- 10. Monthly billing does not apply another minimum ---
{
  const requestInvoices = [
    { amount: 200, minChargeAdjustment: 110 },
    { amount: 200, minChargeAdjustment: 110 },
  ]
  const monthlyTaxable = Number(
    requestInvoices.reduce((s, i) => s + i.amount, 0).toFixed(2),
  )
  assertEq(monthlyTaxable, 400, 'monthly sums already-generated invoice amounts')
  assertEq(
    minBillAdjustment(monthlyTaxable, on),
    0,
    'monthly total must not receive a further shortfall',
  )
}

const root = path.dirname(fileURLToPath(import.meta.url))

{
  const billing = readFileSync(path.join(root, '../src/pages/Billing.tsx'), 'utf8')
  assert(billing.includes('invoiceTotalsFromActual'), 'Billing uses shared min-bill totals')
  assert(billing.includes('skipMinBill'), 'Billing respects party skipMinBill')
  assert(billing.includes('minBillAmount'), 'Billing reads stored settings amount')
  assert(!billing.includes('amount < rate'), 'Billing must not floor a line to one piece rate')
  assert(!/\bminBill &&/.test(billing), 'Billing must not inflate article lines for min bill')
}

{
  const monthly = readFileSync(path.join(root, '../src/pages/MonthlyBilling.tsx'), 'utf8')
  assert(!monthly.includes('minBillAdjustment'), 'Monthly Billing must not import min-bill math')
  assert(!monthly.includes('invoiceTotalsFromActual'), 'Monthly Billing must not re-run invoice totals')
  assert(!monthly.includes('minChargeAdjustment'), 'Monthly Billing must not add a min-charge field')
  assert(
    monthly.includes('inv?.amount'),
    'Monthly Billing continues to use already-generated invoice.amount',
  )
}

{
  const view = readFileSync(path.join(root, '../src/pages/ViewGeneratedBills.tsx'), 'utf8')
  assert(view.includes('invoiceTotalsFromActual'), 'View Bills recalc uses shared min-bill totals')
  assert(view.includes('minChargeAdjustment'), 'View Bills persists the adjustment')
  assert(view.includes('skipMinBill'), 'View Bills honours party skip on edit')
}

{
  const challan = readFileSync(path.join(root, '../src/components/InvoiceChallan.tsx'), 'utf8')
  assert(challan.includes('Add: Minimum Charge'), 'challan shows Add: Minimum Charge')
  assert(challan.includes('minChargeAdjustment'), 'challan reads persisted adjustment')
}

{
  const settings = readFileSync(path.join(root, '../src/pages/OthersPages.tsx'), 'utf8')
  assert(settings.includes('minBillAmount'), 'Invoice Settings stores the rupee amount')
  assert(settings.includes('DEFAULT_MIN_BILL_AMOUNT'), 'settings default is the stored ₹200')
}

console.log('min-bill-charge.selftest: all checks passed')
