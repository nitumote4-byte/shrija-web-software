/**
 * Party Excel/CSV import maps columns by header name, not position.
 * Run: npx --yes tsx scripts/party-import.selftest.ts
 */
import {
  decodePartyImportBytes,
  parsePartyImportBytes,
  parsePartyImportText,
} from '../src/utils/partyImport.ts'

const STATES = [
  { name: 'Bihar', code: '10' },
  { name: 'Maharashtra', code: '27' },
]

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const GOLDSHARK_HEADER =
  'Date,Party Name,Address,Contact No,GSTNO,CMI NO,IGST,Skip Minim,Skip Rejec,Skip Cuttin,State,State Code,Discount,Min. Bill C,Transactio,Group'

{
  const csv = [
    GOLDSHARK_HEADER,
    '9/1/2026,ALI JEWELLERS,TOWER CHOWK,LAL BAGH,,10ACBPA1816H1ZL,5584582,Unchecked,Unchecked,Checked,Checked,Bihar,10,0,Unchecked,Cash,',
    '9/2/2026,MUNNESHWAR JW,BARA,BAZAR DARBHANGA,9876543210,10ABBFAD228LIZ3,5390147614,Unchecked,Unchecked,Checked,Checked,Bihar,10,0,Unchecked,Cash,',
    '9/3/2026,NEW RAM CHANDRA PRASAD,NSS BUILDING,AMRUTESHWAR SOCEITY,0612-2262808,2275342,10AAAAA0000A1Z5,1234567,Checked,Unchecked,Checked,Checked,Maharasht,27,0,Unchecked,Bank,',
  ].join('\n')

  const parsed = parsePartyImportText(csv, STATES)
  assert(!parsed.error, parsed.error || 'goldshark csv should parse')
  assertEq(parsed.rows.length, 3, 'goldshark csv row count')

  const ali = parsed.rows[0]
  assertEq(ali.name, 'ALI JEWELLERS', 'date column must not become party name')
  assertEq(ali.address, 'TOWER CHOWK, LAL BAGH', 'address commas stay in address')
  assertEq(ali.phone, '', 'empty contact stays empty, not an address fragment')
  assertEq(ali.gstin, '10ACBPA1816H1ZL', 'GSTNO maps to gstin')
  assertEq(ali.licenseNo, '5584582', 'CMI NO maps to license')
  assertEq(ali.state, 'Bihar', 'state name')
  assertEq(ali.stateCode, '10', 'state code')
  assertEq(ali.transactionType, 'Cash', 'transaction')
  assertEq(ali.igstApplicable, false, 'IGST unchecked')
  assertEq(ali.skipMinBill, false, 'skip minimum unchecked')
  assertEq(ali.skipRejectedPics, true, 'skip rejected checked')
  assertEq(ali.skipCutting, true, 'skip cutting checked')

  const munneshwar = parsed.rows[1]
  assertEq(munneshwar.name, 'MUNNESHWAR JW', 'second party name')
  assertEq(munneshwar.address, 'BARA, BAZAR DARBHANGA', 'second address')
  assertEq(munneshwar.phone, '9876543210', 'contact is phone, not address')
  assertEq(munneshwar.gstin, '10ABBFAD228LIZ3', 'second GST')

  const ram = parsed.rows[2]
  assertEq(ram.name, 'NEW RAM CHANDRA PRASAD', 'third party name')
  assertEq(ram.phone, '0612-2262808, 2275342', 'contact numbers with commas stay in contact')
  assertEq(ram.state, 'Maharashtra', 'truncated Maharasht resolves to Maharashtra')
  assertEq(ram.stateCode, '27', 'Maharashtra code')
  assertEq(ram.transactionType, 'Bank', 'Bank transaction')
  assertEq(ram.igstApplicable, true, 'IGST checked')
}

{
  const tsv = [
    GOLDSHARK_HEADER.replace(/,/g, '\t'),
    '9/9/2026\tALI JEWELLERS\tTOWER CHOWK,LAL BAGH\t\t10ACBPA1816H1ZL\t5584582\tUnchecked\tUnchecked\tChecked\tChecked\tBihar\t10\t0\tUnchecked\tCash\t',
  ].join('\n')
  const parsed = parsePartyImportText(tsv, STATES)
  assertEq(parsed.rows[0]?.name, 'ALI JEWELLERS', 'tsv name')
  assertEq(parsed.rows[0]?.address, 'TOWER CHOWK,LAL BAGH', 'tsv address keeps comma')
  assertEq(parsed.rows[0]?.gstin, '10ACBPA1816H1ZL', 'tsv gst')
}

{
  const quoted = [
    GOLDSHARK_HEADER,
    '9/9/2026,ALI JEWELLERS,"TOWER CHOWK, LAL BAGH",,10ACBPA1816H1ZL,5584582,Unchecked,Unchecked,Checked,Checked,Bihar,10,0,Unchecked,Cash,',
  ].join('\n')
  const parsed = parsePartyImportText(quoted, STATES)
  assertEq(parsed.rows[0]?.name, 'ALI JEWELLERS', 'quoted csv name')
  assertEq(parsed.rows[0]?.address, 'TOWER CHOWK, LAL BAGH', 'quoted address')
}

{
  const template = [
    'Party Name,Address,Contact No,GST Number,License Number,State,Transaction Type',
    'Demo Jewellers,MG Road, Pune,9876543210,27AAAAA0000A1Z5,LIC-2001,Maharashtra,Cash',
  ].join('\n')
  const parsed = parsePartyImportText(template, STATES)
  assertEq(parsed.rows[0]?.name, 'Demo Jewellers', 'template name')
  assertEq(parsed.rows[0]?.address, 'MG Road, Pune', 'template address commas')
  assertEq(parsed.rows[0]?.phone, '9876543210', 'template phone')
  assertEq(parsed.rows[0]?.gstin, '27AAAAA0000A1Z5', 'template gst')
  assertEq(parsed.rows[0]?.licenseNo, 'LIC-2001', 'template license')
  assertEq(parsed.rows[0]?.state, 'Maharashtra', 'template state')
  assertEq(parsed.rows[0]?.transactionType, 'Cash', 'template txn')
}

{
  const html = `
    <table>
      <tr><th>Date</th><th>Party Name</th><th>Address</th><th>Contact No</th><th>GSTNO</th><th>CMI NO</th><th>State</th><th>Transaction</th></tr>
      <tr><td>9/1/2026</td><td>ALI JEWELLERS</td><td>TOWER CHOWK, LAL BAGH</td><td></td><td>10ACBPA1816H1ZL</td><td>5584582</td><td>Bihar</td><td>Cash</td></tr>
    </table>
  `
  const parsed = parsePartyImportText(html, STATES)
  assertEq(parsed.rows[0]?.name, 'ALI JEWELLERS', 'html table name')
  assertEq(parsed.rows[0]?.address, 'TOWER CHOWK, LAL BAGH', 'html table address')
  assertEq(parsed.rows[0]?.licenseNo, '5584582', 'html table cmi')
}

{
  const csv = [
    GOLDSHARK_HEADER,
    '9/1/2026,BAD GST PARTY,BARA BAZAR,,NOT-A-GST,99,Unchecked,Unchecked,Checked,Checked,Bihar,10,0,Unchecked,Cash,',
  ].join('\n')
  const parsed = parsePartyImportText(csv, STATES)
  assertEq(parsed.rows[0]?.name, 'BAD GST PARTY', 'invalid gst still imports name')
  assertEq(parsed.rows[0]?.gstin, '', 'invalid gstin stored blank')
}

{
  const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])
  const parsed = parsePartyImportBytes(zip, STATES)
  assert(parsed.error, 'xlsx zip should error')
  assert(/csv/i.test(parsed.error || ''), 'xlsx error asks for csv')
}

{
  const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])
  const parsed = parsePartyImportBytes(ole, STATES)
  assert(parsed.error, 'binary xls should error')
}

{
  const csv = 'Date,Party Name,Address\n9/1/2026,ALI JEWELLERS,TOWER CHOWK'
  const utf16 = new Uint8Array(2 + csv.length * 2)
  utf16[0] = 0xff
  utf16[1] = 0xfe
  for (let i = 0; i < csv.length; i++) utf16[2 + i * 2] = csv.charCodeAt(i)
  const decoded = decodePartyImportBytes(utf16)
  assert('text' in decoded, 'utf16 decodes')
  const parsed = parsePartyImportBytes(utf16, STATES)
  assertEq(parsed.rows[0]?.name, 'ALI JEWELLERS', 'utf16 name')
}

console.log('party-import.selftest: all checks passed')
