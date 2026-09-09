/**
 * Billing invoice amount-in-words + jurisdiction footer.
 * Run: npx --yes tsx scripts/amount-in-words.selftest.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  amountInIndianWords,
  integerToIndianWords,
  jurisdictionFooter,
} from '../src/utils/amountInWords.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const root = path.dirname(fileURLToPath(import.meta.url))

// --- 1. Normal Grand Total ---
assertEq(
  amountInIndianWords(12500),
  'Rupees Twelve Thousand Five Hundred Only',
  'normal 12500',
)
assertEq(
  amountInIndianWords(12500.0),
  'Rupees Twelve Thousand Five Hundred Only',
  'normal 12500.00',
)

// --- 2. Large Grand Total ---
assertEq(
  amountInIndianWords(12500000),
  'Rupees One Crore Twenty Five Lakh Only',
  'large 1.25 crore',
)
assertEq(
  amountInIndianWords(9999999),
  'Rupees Ninety Nine Lakh Ninety Nine Thousand Nine Hundred Ninety Nine Only',
  'large 99,99,999',
)

// --- 3. Decimal / paise ---
assertEq(
  amountInIndianWords(12500.5),
  'Rupees Twelve Thousand Five Hundred and Fifty Paise Only',
  'paise .50',
)
assertEq(
  amountInIndianWords(200.09),
  'Rupees Two Hundred and Nine Paise Only',
  'paise .09',
)
assertEq(amountInIndianWords(0.75), 'Rupees and Seventy Five Paise Only', 'paise only')
assertEq(amountInIndianWords(0), 'Rupees Zero Only', 'zero')

// --- 4. Long amount-in-words ---
const longWords = amountInIndianWords(12345678.99)
assertEq(
  longWords,
  'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Ninety Nine Paise Only',
  'long words',
)
assert(longWords.length > 80, 'long amount-in-words is a wrapping-length string')

assertEq(integerToIndianWords(21), 'Twenty One', '21')
assertEq(integerToIndianWords(101), 'One Hundred One', '101')

// Same numeric Grand Total must produce matching words (no hardcoded amount)
const liveTotal = 3487.25
assert(
  amountInIndianWords(liveTotal).includes('Three Thousand Four Hundred Eighty Seven'),
  'words follow the given total',
)
assert(amountInIndianWords(liveTotal).includes('Twenty Five Paise'), 'paise follow the given total')

// --- 5 / 6. Company City jurisdiction (dynamic, not hardcoded) ---
assertEq(jurisdictionFooter('Darbhanga'), 'Subject to Darbhanga Jurisdiction', 'city Darbhanga')
assertEq(jurisdictionFooter('Madhubani'), 'Subject to Madhubani Jurisdiction', 'city Madhubani')
assertEq(jurisdictionFooter('Patna'), 'Subject to Patna Jurisdiction', 'future city')
assertEq(jurisdictionFooter('  '), 'Subject to Jurisdiction', 'blank city')
assertEq(jurisdictionFooter(undefined), 'Subject to Jurisdiction', 'missing city')

{
  const challan = readFileSync(path.join(root, '../src/components/InvoiceChallan.tsx'), 'utf8')
  assert(challan.includes('amountInIndianWords'), 'challan generates words from Grand Total')
  assert(challan.includes('view.grandTotal'), 'challan still uses existing grandTotal')
  assert(challan.includes('jurisdictionFooter'), 'challan uses dynamic jurisdiction')
  assert(challan.includes('Customer Signature'), 'left signature label')
  assert(challan.includes('Authorised Signatory'), 'right signature label')
  assert(!challan.includes('By Courier'), 'courier checkbox removed')
  assert(!challan.includes('By Hand'), 'hand checkbox removed')
  assert(
    challan.includes(
      'Customers are requested to kindly verify the weight of their jewellery along with all remnants before signing this invoice',
    ),
    'updated customer note wording',
  )
  assert(
    !challan.includes('Received the precious Metal'),
    'old received-metal note must be replaced',
  )
  assert(!/Darbhanga/.test(challan), 'challan must not hardcode Darbhanga')
  assert(!/Madhubani/.test(challan), 'challan must not hardcode Madhubani')
  const signatureSlice = challan.slice(
    challan.indexOf('invoice-sign-grid'),
    challan.indexOf('invoice-customer-note'),
  )
  assert(!signatureSlice.includes('<table'), 'do not add a signature table')
  assert(challan.includes('grandTotal: inv.total'), 'Grand Total still comes from inv.total')
}

console.log('amount-in-words.selftest: all checks passed')
