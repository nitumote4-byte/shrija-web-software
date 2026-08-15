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
const MASTER_WITH_MIX = ['Locket', 'Necklace', 'Mix Ornaments', 'Bangles']
const MASTER_WITH_MIXED = ['Locket', 'Necklace', 'Mixed Ornaments', 'Bangles']

/** Reference voucher — labelled layout */
const MIX_LABELLED = `
AHC UID Receipt Voucher
Request Number: 118566870
Receipt Number: 28358861
Item Category: Mix Ornaments
Quantity: 4
Total Item Category Weight: 10.62
Declared Purity: 18K750
Received Quantity by AHC: 4
Observed Item Category Weight: 10.62
`

/** Reference voucher — table layout (header row followed by value row) */
const MIX_TABLE = `AHC UID Receipt Voucher
Request Number 118566870 Receipt Number 28358861
Item Category Quantity Total Item Category Weight Declared Purity Received Quantity by AHC Observed Item Category Weight
Mix Ornaments 4 10.62 18K750 4 10.62
`

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

/** Verbatim pdf.js text of the real AHC Receipt Voucher PDFs (single-line table). */
const REAL_PENDENT_VOUCHER =
  'AHC Receipt Voucher  AHC Name   :   S M G ASSAYING & 13/08/2026 Request 118596676 Request Number License Validity   20/06/2026 Jeweller Address : GSTN PAN Number Net Weight Jeweller   270.23   Material Type   Gold Bara Bazar ,Darbhanga, Receipt Number   28407906 Observed Net weight   270.23 Receipt   13/08/2026 Jeweller Name   ALANKAR   Licence No.   5390090114 Item Category   Quantity   Tot. Item Category Weight Declared Purity   Received Quantity by AHC Observed Item Category Weight(Gms) pendent   61   270.23   22K916   61   270.23 AHC Receiving Remarks   well in condition'

const REAL_MIX_VOUCHER =
  'AHC Receipt Voucher  AHC Name   :   S M G ASSAYING & 11/08/2026 Request 118566870 Request Number License Validity   16/09/2026 Jeweller Address : GSTN PAN Number Net Weight Jeweller   10.62   Material Type   Gold HOSPITAL CHOWK TAJPUR,, Receipt Number   28358861 Observed Net weight   10.62 Receipt   11/08/2026 Jeweller Name   SWARNKAR   Licence No.   5390279421 Item Category   Quantity   Tot. Item Category Weight Declared Purity   Received Quantity by AHC Observed Item Category Weight(Gms) Mix Ornaments   4   10.62   18K750   4   10.62 AHC Receiving Remarks   well in condition'

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

// Mapping — Mix Ornaments (exact, case, whitespace, plural/spelling alias)
assertEq(matchItemMasterName('Mix Ornaments', MASTER_WITH_MIX), 'Mix Ornaments', 'exact mix')
assertEq(matchItemMasterName('mix ornaments', MASTER_WITH_MIX), 'Mix Ornaments', 'case mix')
assertEq(matchItemMasterName('  MIX   ORNAMENTS ', MASTER_WITH_MIX), 'Mix Ornaments', 'spaces mix')
assertEq(matchItemMasterName('Mix Ornament', MASTER_WITH_MIX), 'Mix Ornaments', 'plural mix')
assertEq(matchItemMasterName('Mix Ornaments', MASTER_WITH_MIXED), 'Mixed Ornaments', 'alias mix')
assertEq(matchItemMasterName('Mix Ornaments', MASTER_NO_PENDENT), null, 'unmatched mix stays null')
assertEq(matchItemMasterName('Ornaments', MASTER_WITH_MIX), null, 'no partial word match')

// Reference voucher — labelled layout
const mixLabelled = parseVoucherText(MIX_LABELLED, 'AHC_UID_Voucher_53_118566870.pdf')
assertEq(mixLabelled.lines.length, 1, 'mix labelled single row')
assertEq(mixLabelled.lines[0].item, 'Mix Ornaments', 'labelled item = Mix Ornaments')
assertEq(mixLabelled.lines[0].pic, '4', 'labelled pic')
assertEq(mixLabelled.lines[0].weight, '10.62', 'labelled weight')
assertEq(mixLabelled.lines[0].purity, '18K750', 'labelled purity')
assertEq(mixLabelled.lines[0].requestNo, '118566870', 'labelled request no')
assertEq(mixLabelled.lines[0].receiptNo, '28358861', 'labelled receipt no')
assertEq(
  matchItemMasterName(mixLabelled.lines[0].item, MASTER_WITH_MIX),
  'Mix Ornaments',
  'labelled item maps to Item Master Mix Ornaments',
)

// Reference voucher — table layout (previously produced header junk / Locket)
const mixTable = parseVoucherText(MIX_TABLE, 'AHC_UID_Voucher_53_118566870.pdf')
assertEq(mixTable.lines.length, 1, 'mix table single row')
assertEq(mixTable.lines[0].item, 'Mix Ornaments', 'table item = Mix Ornaments (no header words)')
assert(!/locket/i.test(mixTable.lines[0].item), 'table item must not be Locket')
assertEq(mixTable.lines[0].pic, '4', 'table pic')
assertEq(mixTable.lines[0].weight, '10.62', 'table weight')
assertEq(mixTable.lines[0].purity, '18K750', 'table purity')
assertEq(mixTable.lines[0].requestNo, '118566870', 'table request no')
assertEq(mixTable.lines[0].receiptNo, '28358861', 'table receipt no')

// pendent / pendant never map to Locket, in either Item Master spelling
assertEq(matchItemMasterName('pendant', MASTER_WITH_PENDENT), 'Pendent', 'pendant → Pendent')
assertEq(matchItemMasterName('  PenDent ', MASTER_WITH_PENDANT_ONLY), 'Pendant', 'messy pendent')
for (const master of [MASTER_WITH_PENDENT, MASTER_WITH_PENDANT_ONLY, MASTER_NO_PENDENT]) {
  for (const voucherItem of ['pendent', 'pendant', 'PENDENT', '  pendent  ']) {
    const hit = matchItemMasterName(voucherItem, master)
    assert(hit !== 'Locket', `${voucherItem} must never map to Locket`)
  }
}

// ——— Real AHC voucher PDFs (single-line header + value columns) ———
const realPendent = parseVoucherText(
  REAL_PENDENT_VOUCHER,
  'AHC_UID_Voucher_5390090114_53_118596676.pdf',
)
assertEq(realPendent.lines.length, 1, 'real pendent single row')
assertEq(realPendent.lines[0].item, 'pendent', 'real item = pendent (not Tot. Item Category)')
assertEq(realPendent.lines[0].pic, '61', 'real pendent pic')
assertEq(realPendent.lines[0].weight, '270.23', 'real pendent weight')
assertEq(realPendent.lines[0].purity, '22K916', 'real pendent purity (not RECEIVED)')
assertEq(realPendent.lines[0].requestNo, '118596676', 'real pendent request no')
assertEq(realPendent.lines[0].receiptNo, '28407906', 'real pendent receipt no')
assertEq(
  matchItemMasterName(realPendent.lines[0].item, MASTER_WITH_PENDENT),
  'Pendent',
  'real pendent maps to Item Master Pendent',
)
assert(
  matchItemMasterName(realPendent.lines[0].item, MASTER_WITH_PENDENT) !== 'Locket',
  'real pendent must never map to Locket',
)

const realMix = parseVoucherText(
  REAL_MIX_VOUCHER,
  'AHC_UID_Voucher_5390279421_53_118566870.pdf',
)
assertEq(realMix.lines.length, 1, 'real mix single row')
assertEq(realMix.lines[0].item, 'Mix Ornaments', 'real item = Mix Ornaments')
assertEq(realMix.lines[0].pic, '4', 'real mix pic')
assertEq(realMix.lines[0].weight, '10.62', 'real mix weight')
assertEq(realMix.lines[0].purity, '18K750', 'real mix purity')
assertEq(realMix.lines[0].requestNo, '118566870', 'real mix request no')
assertEq(realMix.lines[0].receiptNo, '28358861', 'real mix receipt no')
assertEq(
  matchItemMasterName(realMix.lines[0].item, MASTER_WITH_MIX),
  'Mix Ornaments',
  'real mix maps to Item Master Mix Ornaments',
)

// Two item rows in one real-format voucher stay separate
const realTwoRows = parseVoucherText(
  REAL_MIX_VOUCHER.replace(
    'Mix Ornaments   4   10.62   18K750   4   10.62',
    'Mix Ornaments   4   10.62   18K750   4   10.62 pendent   61   270.23   22K916   61   270.23',
  ),
  'AHC_UID_Voucher_two_rows.pdf',
)
assertEq(realTwoRows.lines.length, 2, 'real format two rows')
assertEq(realTwoRows.lines[0].item, 'Mix Ornaments', 'two rows: row1 item')
assertEq(realTwoRows.lines[1].item, 'pendent', 'two rows: row2 item')
assertEq(realTwoRows.lines[1].pic, '61', 'two rows: row2 pic')
assertEq(realTwoRows.lines[1].purity, '22K916', 'two rows: row2 purity')

console.log('voucher item import selftest passed')
