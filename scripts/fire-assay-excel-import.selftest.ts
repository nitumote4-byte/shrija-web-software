/**
 * Fire Assay Excel/.xlsx upload must read cell values, not OOXML internals.
 * Run: npx --yes tsx scripts/fire-assay-excel-import.selftest.ts
 */
import { deflateRawSync } from 'node:zlib'
import { mapFireAssaySheet, parseFireAssaySpreadsheet } from '../src/utils/fireAssayExcelImport.ts'
import { parseSpreadsheetBytes } from '../src/utils/xlsxMatrix.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]!
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
  }
  return (c ^ 0xffffffff) >>> 0
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function le16(n: number): Uint8Array {
  return Uint8Array.of(n & 255, (n >>> 8) & 255)
}

function le32(n: number): Uint8Array {
  return Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255)
}

function zipFiles(files: { name: string; data: Uint8Array; deflate?: boolean }[]): Uint8Array {
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name)
    const payload = file.deflate ? new Uint8Array(deflateRawSync(file.data)) : file.data
    const method = file.deflate ? 8 : 0
    const crc = crc32(file.data)
    const local = concat([
      le32(0x04034b50),
      le16(20),
      le16(0),
      le16(method),
      le16(0),
      le16(0),
      le32(crc),
      le32(payload.length),
      le32(file.data.length),
      le16(nameBytes.length),
      le16(0),
      nameBytes,
      payload,
    ])
    locals.push(local)
    centrals.push(
      concat([
        le32(0x02014b50),
        le16(20),
        le16(20),
        le16(0),
        le16(method),
        le16(0),
        le16(0),
        le32(crc),
        le32(payload.length),
        le32(file.data.length),
        le16(nameBytes.length),
        le16(0),
        le16(0),
        le16(0),
        le16(0),
        le32(0),
        le32(offset),
        nameBytes,
      ]),
    )
    offset += local.length
  }
  const central = concat(centrals)
  const eocd = concat([
    le32(0x06054b50),
    le16(0),
    le16(0),
    le16(files.length),
    le16(files.length),
    le32(central.length),
    le32(offset),
    le16(0),
  ])
  return concat([...locals, central, eocd])
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function inlineCell(ref: string, value: string, type?: 'n' | 'inlineStr'): string {
  if (!value) return `<c r="${ref}"/>`
  if (type === 'n' || /^-?\d+(\.\d+)?$/.test(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`
}

function sheetXml(rows: string[][], cols: string[]): string {
  const body = rows
    .map(
      (row, ri) =>
        `<row r="${ri + 1}">${row
          .map((value, ci) => inlineCell(`${cols[ci]}${ri + 1}`, value))
          .join('')}</row>`,
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
}

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']

const USER_HEADER = [
  'Sample Draw',
  'Job Card No',
  'Sample W',
  'Silver',
  'Lead',
  '',
  'Wt. of Gold',
  'Fineness',
  'Mean Fineness',
]

const USER_ROWS = [
  USER_HEADER,
  ['', 'CG1', '149.653', '342.80', '4.0', '', '149.736', 'Copper 1', '13.693'],
  ['333.692', '1_127794264', '163.346', '374.20', '4.0', '', '150.154', '918.887', '0.0'],
  ['333.692', '1_127794264', '163.197', '374.20', '4.0', '', '150.018', '918.896', '918.891'],
  ['337.296', '1_127793417', '163.648', '374.20', '4.0', '', '150.203', '917.493', '0.0'],
  ['337.296', '1_127793417', '163.747', '374.20', '4.0', '', '150.298', '917.519', '917.506'],
  ['', 'CG2', '149.625', '342.70', '4.0', '', '149.655', 'Copper 2', '13.721'],
]

function xlsxWithSheets(sheets: { name: string; rows: string[][] }[], deflate = false): Uint8Array {
  const workbookSheets = sheets
    .map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')
  const rels = sheets
    .map(
      (s, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join('')
  const files = [
    {
      name: 'xl/workbook.xml',
      data: utf8(
        `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
      ),
      deflate,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: utf8(
        `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`,
      ),
      deflate,
    },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: utf8(sheetXml(s.rows, COLS)),
      deflate,
    })),
  ]
  return zipFiles(files)
}

{
  const csv = USER_ROWS.map((r) => r.join(',')).join('\n')
  const parsed = await parseFireAssaySpreadsheet(utf8(csv))
  assert(!parsed.error, parsed.error || 'csv should parse')
  assertEq(parsed.rows.length, 4, 'csv job rows (CG skipped)')
  assertEq(parsed.rows[0]?.sampleDrawn, '333.692', 'sample drawn from col A, not XML')
  assertEq(parsed.rows[0]?.jobCardNo, '1_127794264', 'job card')
  assertEq(parsed.rows[0]?.sampleWeight, '163.346', 'sample weight from Sample W, not Sample Draw')
  assertEq(parsed.rows[0]?.wotgcaa, '150.154', 'empty column F does not steal gold weight')
  assertEq(parsed.rows[0]?.fineness, '918.887', 'fineness')
  assertEq(parsed.rows[1]?.meanFineness, '918.891', 'pair mean stays on second row')
  assertEq(parsed.cg1?.weight, '149.653', 'CG1 weight')
  assertEq(parsed.cg1?.copper, '13.693', 'Copper 1 label + mean → copper')
  assertEq(parsed.cg1?.wotgcaa, '149.736', 'CG1 gold cornet')
  assertEq(parsed.cg2?.copper, '13.721', 'CG2 copper')
  assert(
    parsed.rows.every((r) => !r.sampleDrawn.includes('<') && !r.sampleWeight.includes('<')),
    'csv cells are not XML',
  )
}

{
  const mapped = mapFireAssaySheet({
    name: 'Fire Assay Data',
    rows: [['Fire Assay 2026-09-01'], ...USER_ROWS],
  })
  assertEq(mapped.rows[0]?.jobCardNo, '1_127794264', 'title row above headers is skipped')
  assertEq(mapped.cg1?.copper, '13.693', 'CG still extracted after title row')
}

{
  const template = [
    'Sample Drawn / Button Weight,Job Card No,Sample Weight,Silver,Lead,Weight Of The Gold Cornet After Assaying,Fineness In PPT,Mean Fineness In PPT',
    '330.310,1_8080132061,163.655,373.3,4.0,150.135,,',
  ].join('\n')
  const parsed = await parseFireAssaySpreadsheet(utf8(template))
  assertEq(parsed.rows[0]?.sampleDrawn, '330.310', 'template sample drawn')
  assertEq(parsed.rows[0]?.sampleWeight, '163.655', 'template sample weight')
  assertEq(parsed.rows[0]?.wotgcaa, '150.135', 'template gold cornet')
}

{
  const bytes = xlsxWithSheets(
    [
      { name: 'Fire Assay Data', rows: USER_ROWS },
      { name: 'Specific Data', rows: [['Ignore'], ['nope']] },
    ],
    false,
  )
  const parsed = await parseFireAssaySpreadsheet(bytes)
  assert(!parsed.error, parsed.error || 'stored xlsx should parse')
  assertEq(parsed.sheetName, 'Fire Assay Data', 'prefer Fire Assay Data sheet')
  assertEq(parsed.rows.length, 4, 'xlsx job rows')
  assertEq(parsed.rows[0]?.sampleDrawn, '333.692', 'xlsx sample drawn is a number, not Relationships XML')
  assertEq(parsed.rows[0]?.sampleWeight, '163.346', 'xlsx sample weight')
  assertEq(parsed.rows[0]?.wotgcaa, '150.154', 'xlsx gold weight despite empty F')
  assertEq(parsed.cg1?.silver, '342.80', 'xlsx CG1 silver')
  assertEq(parsed.cg2?.weight, '149.625', 'xlsx CG2 weight')
}

{
  const bytes = xlsxWithSheets([{ name: 'Fire Assay Data', rows: USER_ROWS }], true)
  const parsed = await parseFireAssaySpreadsheet(bytes)
  assert(!parsed.error, parsed.error || 'deflated xlsx should parse')
  assertEq(parsed.rows[3]?.fineness, '917.519', 'deflate inflate reads cell values')
  assertEq(parsed.rows[3]?.meanFineness, '917.506', 'deflate pair mean')
}

{
  const bytes = xlsxWithSheets([{ name: 'Fire Assay Data', rows: USER_ROWS }])
  const asText = new TextDecoder('latin1').decode(bytes)
  assert(/<Relationships|<styleSheet|<a:theme|PK/.test(asText), 'latin1 view of xlsx contains zip/xml internals')
  const parsed = await parseFireAssaySpreadsheet(bytes)
  assert(!parsed.rows.some((r) => /xmlns|Relationships|styleSheet/.test(r.sampleDrawn + r.sampleWeight)))
  assertEq(parsed.rows[0]?.sampleDrawn, '333.692', 'zip magic path wins over XML-as-text')
}

{
  const xmlText = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship/></Relationships>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>'
  const parsed = await parseFireAssaySpreadsheet(utf8(xmlText))
  assert(parsed.error, 'office xml text must error instead of filling sample weight')
  assert(/xlsx|csv/i.test(parsed.error || ''), 'error tells user to upload xlsx/csv')
}

{
  const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])
  const parsed = await parseSpreadsheetBytes(ole)
  assert(parsed.error, 'xls ole errors')
}

{
  const shared = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Sample Draw</t></si><si><t>Job Card No</t></si><si><t>Sample W</t></si><si><t>1_999</t></si></sst>`
  const sheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
    <row r="2"><c r="A2"><v>330.1</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>160.2</v></c></row>
  </sheetData></worksheet>`
  const bytes = zipFiles([
    { name: 'xl/sharedStrings.xml', data: utf8(shared) },
    { name: 'xl/worksheets/sheet1.xml', data: utf8(sheet) },
  ])
  const parsed = await parseFireAssaySpreadsheet(bytes)
  assertEq(parsed.rows[0]?.jobCardNo, '1_999', 'shared strings job card')
  assertEq(parsed.rows[0]?.sampleDrawn, '330.1', 'shared-string sheet numeric drawn')
  assertEq(parsed.rows[0]?.sampleWeight, '160.2', 'shared-string sheet sample weight')
}

console.log('fire-assay-excel-import.selftest: ok')
