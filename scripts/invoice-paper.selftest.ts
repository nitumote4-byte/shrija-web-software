/**
 * Invoice print @page — fill (daily challan) vs flow (monthly).
 * Run: npx --yes tsx scripts/invoice-paper.selftest.ts
 */
import { invoicePageCss } from '../src/utils/invoicePaper.ts'

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`[invoice-paper] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

assertEq(
  invoicePageCss('A4', 'fill'),
  '@page { size: A4 portrait; margin: 0; }',
  'A4 fill uses zero page margin so the 210×297mm sheet is the paper',
)
assertEq(
  invoicePageCss('A5', 'fill'),
  '@page { size: A5 portrait; margin: 0; }',
  'A5 fill uses zero page margin so the 148×210mm sheet is the paper',
)
assertEq(
  invoicePageCss('A4', 'flow'),
  '@page { size: A4 portrait; margin: 8mm; }',
  'A4 monthly keeps page margin for multi-page flow',
)
assertEq(
  invoicePageCss('A5', 'flow'),
  '@page { size: A5 portrait; margin: 6mm; }',
  'A5 monthly keeps compact page margin',
)
assertEq(invoicePageCss('A4'), '@page { size: A4 portrait; margin: 0; }', 'default mode is fill')

console.log('invoice-paper.selftest: all checks passed')
