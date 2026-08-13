import { parseReceiveDetailPage } from './detailParse.js'
import { isQualityRequestRow, parseHtmlTables } from './parseTables.js'

const detailHtml = `
<html><body>
<table>
<tr><td>Jeweller Name</td><td>RAMESH SONI JEWELLERS</td></tr>
<tr><td>Request No</td><td>118347688</td></tr>
<tr><td>Item Category</td><td>Necklace</td></tr>
<tr><td>No. of Articles</td><td>12</td></tr>
<tr><td>Gross Weight</td><td>48.250</td></tr>
<tr><td>Declared Purity</td><td>916</td></tr>
</table>
</body></html>
`

const listStubHtml = `
<table>
<tr><th>S.No</th><th>Jeweller Address</th><th>Request Date</th></tr>
<tr><td>1</td><td>KUSHWAHA MARKET, MAIN ROAD</td><td>22-07-2026</td></tr>
</table>
<table>
<tr><th>Metal</th><th>Purity</th></tr>
<tr><td>Gold</td><td>100</td></tr>
</table>
`

const detail = parseReceiveDetailPage(
  detailHtml,
  'https://huid.manakonline.in/MANAK/AHCReceivingUIDJewellerRequest.do?eRequestId=MTE4MzQ3Njg4',
)
const listRows = parseHtmlTables(listStubHtml)

let failed = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg)
    failed++
  } else {
    console.log('OK:', msg)
  }
}

assert(Boolean(detail), 'detail parsed')
assert(detail?.requestNo === '118347688', `requestNo=${detail?.requestNo}`)
assert(detail?.pic === 12, `pic=${detail?.pic}`)
assert(detail?.weight === 48.25, `weight=${detail?.weight}`)
assert(isQualityRequestRow(detail!), 'detail is quality')
assert(listRows.length === 0, `list stubs rejected (got ${listRows.length})`)

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll parse self-tests passed')
