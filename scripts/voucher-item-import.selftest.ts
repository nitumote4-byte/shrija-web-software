/**
 * Run: npx --yes tsx scripts/voucher-item-import.selftest.ts
 */
import {
  matchItemMasterName,
  unmatchedItemCategoryMessage,
} from '../src/utils/itemCategoryMatch.ts'
import { parseVoucherText } from '../src/utils/voucherReader.ts'

const MASTER_WITH_PENDENT = ['Locket', 'Necklace', 'Pendent', 'Bangles']
const MASTER_WITH_PENDANT_ONLY = ['Locket', 'Necklace', 'Pendant', 'Bangles']
const MASTER_NO_PENDENT = ['Locket', 'Necklace', 'Bangles']

const AHC_TEXT = `
AHC UID Receipt Voucher
Request Number: 118596676
Receipt Number: 28407906
Item Category: pendent
Quantity: 61
Total Item Category Weight: 270.23
Declared Purity: 22K916
Received Quantity by AHC: 61
Observed Item Category Weight: 270.23
`

const MULTI_TEXT = `
Request Number: 118596676
Receipt Number: 28407906
Item Category: Necklace
Quantity: 10
Total Item Category Weight: 50.00
Declared Purity: 22K916
Item Category: pendent
Quantity: 61
Total Item Category Weight: 270.23
Declared Purity: 22K916
`

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

// Matching
assertEq(matchItemMasterName('pendent', MASTER_WITH_PENDENT), 'Pendent', 'exact pendent')
assertEq(matchItemMasterName('PENDENT', MASTER_WITH_PENDENT), 'Pendent', 'case PENDENT')
assertEq(matchItemMasterName('  pendent  ', MASTER_WITH_PENDENT), 'Pendent', 'trim pendent')
assertEq(matchItemMasterName('pendent', MASTER_WITH_PENDANT_ONLY), 'Pendant', 'spelling variant')
assertEq(matchItemMasterName('pendent', MASTER_NO_PENDENT), null, 'unmatched pendent')
assertEq(matchItemMasterName('Lock', MASTER_WITH_PENDENT), null, 'no substring Lock→Locket')
assertEq(matchItemMasterName('', MASTER_WITH_PENDENT), null, 'empty item')
assert(
  unmatchedItemCategoryMessage('Pendent').includes("Voucher item 'Pendent'"),
  'unmatched message',
)

// AHC label parse — test voucher
const parsed = parseVoucherText(
  AHC_TEXT,
  'AHC_UID_Voucher_5390090114_53118596676.pdf',
)
assertEq(parsed.lines.length, 1, 'single row')
assertEq(parsed.lines[0].item.toLowerCase(), 'pendent', 'item is pendent not Locket')
assert(parsed.lines[0].item.toLowerCase() !== 'locket', 'must not be Locket')
assertEq(parsed.lines[0].pic, '61', 'quantity')
assertEq(parsed.lines[0].weight, '270.23', 'weight')
assertEq(parsed.lines[0].purity, '22K916', 'purity')
assertEq(parsed.lines[0].requestNo, '118596676', 'request no')
assertEq(parsed.lines[0].receiptNo, '28407906', 'receipt from voucher not filename UID')

const matched = matchItemMasterName(parsed.lines[0].item, MASTER_WITH_PENDENT)
assertEq(matched, 'Pendent', 'imported pendent → Item Master Pendent')

// Structured row without labels
const structured = parseVoucherText('pendent 61 270.23 22K916', 'voucher.pdf')
assertEq(structured.lines[0].item.toLowerCase(), 'pendent', 'structured pendent')
assert(structured.lines[0].item.toLowerCase() !== 'locket', 'structured not Locket')

// Multiple rows
const multi = parseVoucherText(MULTI_TEXT, 'multi.pdf')
assertEq(multi.lines.length, 2, 'two rows')
assertEq(multi.lines[0].item.toLowerCase(), 'necklace', 'row1 necklace')
assertEq(multi.lines[1].item.toLowerCase(), 'pendent', 'row2 pendent')
assertEq(multi.lines[0].pic, '10', 'row1 pic')
assertEq(multi.lines[1].pic, '61', 'row2 pic')
assertEq(matchItemMasterName(multi.lines[0].item, MASTER_WITH_PENDENT), 'Necklace', 'row1 match')
assertEq(matchItemMasterName(multi.lines[1].item, MASTER_WITH_PENDENT), 'Pendent', 'row2 match')

// Empty / missing category
const missing = parseVoucherText(
  'Request Number: 118596676\nReceipt Number: 28407906\nQuantity: 61\nWeight: 270.23',
  'empty-item.pdf',
)
assert(
  !missing.lines.some((l) => l.item.toLowerCase() === 'locket'),
  'missing category must not become Locket',
)

console.log('voucher item import selftest passed')
