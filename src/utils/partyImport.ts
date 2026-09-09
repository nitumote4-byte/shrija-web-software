import { normalizePartyGstin, validatePartyGstin } from './partyGstin'

export type StateOption = { name: string; code: string }

export type PartyImportRow = {
  name: string
  address: string
  phone: string
  gstin: string
  licenseNo: string
  state: string
  stateCode: string
  transactionType: 'Cash' | 'Credit' | 'Bank'
  groupName: string
  skipMinBill: boolean
  skipRejectedPics: boolean
  skipCutting: boolean
  igstApplicable: boolean
  discount: number
  minBillCalc: boolean
}

export type PartyImportResult = {
  rows: PartyImportRow[]
  skipped: number
  error?: string
}

type Field =
  | 'date'
  | 'name'
  | 'address'
  | 'phone'
  | 'gstin'
  | 'licenseNo'
  | 'igstApplicable'
  | 'skipMinBill'
  | 'skipRejectedPics'
  | 'skipCutting'
  | 'state'
  | 'stateCode'
  | 'discount'
  | 'minBillCalc'
  | 'transactionType'
  | 'groupName'

type Col = { field: Field | 'unknown'; raw: string }

const FIELD_ALIASES: { field: Field; aliases: string[] }[] = [
  { field: 'stateCode', aliases: ['statecode', 'statecd'] },
  { field: 'transactionType', aliases: ['transactiontype', 'transaction', 'transactio', 'txn'] },
  { field: 'skipMinBill', aliases: ['skipminimum', 'skipminim', 'skipminbill'] },
  { field: 'skipRejectedPics', aliases: ['skiprejected', 'skiprejec', 'skipreject'] },
  { field: 'skipCutting', aliases: ['skipcutting', 'skipcuttin'] },
  { field: 'minBillCalc', aliases: ['minbillcalc', 'minbillc', 'minbill'] },
  { field: 'igstApplicable', aliases: ['igstapplicable', 'igst'] },
  { field: 'licenseNo', aliases: ['cmino', 'cmlno', 'licensenumber', 'licencenumber', 'licenseno', 'licenceno', 'license', 'licence'] },
  { field: 'gstin', aliases: ['gstnumber', 'gstno', 'gstin', 'gst'] },
  { field: 'phone', aliases: ['contactno', 'contact', 'phone', 'mobile'] },
  { field: 'name', aliases: ['partyname', 'name', 'party'] },
  { field: 'address', aliases: ['address'] },
  { field: 'state', aliases: ['state'] },
  { field: 'discount', aliases: ['discount'] },
  { field: 'groupName', aliases: ['groupname', 'group'] },
  { field: 'date', aliases: ['date'] },
]

const GOLDSHARK_FIELDS: Field[] = [
  'date',
  'name',
  'address',
  'phone',
  'gstin',
  'licenseNo',
  'igstApplicable',
  'skipMinBill',
  'skipRejectedPics',
  'skipCutting',
  'state',
  'stateCode',
  'discount',
  'minBillCalc',
  'transactionType',
  'groupName',
]

const TEMPLATE_FIELDS: Field[] = [
  'name',
  'address',
  'phone',
  'gstin',
  'licenseNo',
  'state',
  'transactionType',
]

function compactHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function mapHeader(raw: string): Field | 'unknown' {
  const h = compactHeader(raw)
  if (!h) return 'unknown'
  for (const { field, aliases } of FIELD_ALIASES) {
    for (const alias of aliases) {
      if (h === alias) return field
      if (h.length >= 8 && alias.startsWith(h)) return field
      if (alias.length >= 8 && h.startsWith(alias)) return field
    }
  }
  return 'unknown'
}

function looksLikeDate(value: string): boolean {
  const v = value.trim()
  return (
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(v) ||
    /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(v)
  )
}

function looksLikeGstin(value: string): boolean {
  return /^[0-9]{2}[A-Z0-9]{13}$/i.test(value.trim())
}

function looksLikeBool(value: string): boolean {
  return /^(checked|unchecked|true|false|yes|no)$/i.test(value.trim())
}

function looksLikePhone(value: string): boolean {
  const t = value.trim().replace(/[\s()-]/g, '')
  if (!t) return false
  return /^\+?\d{6,15}$/.test(t)
}

function looksLikeCmi(value: string): boolean {
  return /^\d{4,14}$/.test(value.trim())
}

function parseBool(value: string, fallback: boolean): boolean {
  const v = value.trim().toLowerCase()
  if (!v) return fallback
  if (['checked', 'true', 'yes', '1'].includes(v)) return true
  if (['unchecked', 'false', 'no', '0'].includes(v)) return false
  return fallback
}

function parseTxn(value: string): 'Cash' | 'Credit' | 'Bank' {
  const v = value.trim().toLowerCase()
  if (v === 'credit') return 'Credit'
  if (v === 'bank') return 'Bank'
  return 'Cash'
}

export function resolveImportedState(
  name: string,
  code: string,
  states: readonly StateOption[],
): { name: string; code: string } {
  const rawName = name.trim()
  const rawCode = code.trim()
  const padded = rawCode.replace(/\D/g, '').padStart(2, '0')
  const byCode = rawCode
    ? states.find((s) => s.code === rawCode || s.code === padded)
    : undefined
  const needle = rawName.toLowerCase()
  const byName = needle
    ? states.find((s) => s.name.toLowerCase() === needle) ||
      states.find((s) => s.name.toLowerCase().startsWith(needle) && needle.length >= 5) ||
      states.find((s) => needle.startsWith(s.name.toLowerCase().slice(0, 8)))
    : undefined
  if (byName && byCode && byName.code !== byCode.code) return byName
  if (byName) return { name: byName.name, code: byName.code }
  if (byCode) return { name: byCode.name, code: byCode.code }
  return { name: rawName, code: rawCode }
}

function stripTags(html: string): string {
  return html
    .replace(/&nbsp;/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parseHtmlTable(text: string): string[][] | null {
  if (!/<table[\s>]/i.test(text) || !/<tr[\s>]/i.test(text)) return null
  const rows: string[][] = []
  for (const rowMatch of text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      stripTags(c[1]),
    )
    if (cells.some((c) => c)) rows.push(cells)
  }
  return rows.length >= 2 ? rows : null
}

function parseSpreadsheetMl(text: string): string[][] | null {
  if (!/<Workbook\b/i.test(text) || !/<Row\b/i.test(text)) return null
  const rows: string[][] = []
  for (const rowMatch of text.matchAll(/<Row\b[^>]*>([\s\S]*?)<\/Row>/gi)) {
    const cells: string[] = []
    for (const cellMatch of rowMatch[1].matchAll(/<Cell\b([^>]*)>([\s\S]*?)<\/Cell>/gi)) {
      const indexAttr = /ss:Index="(\d+)"/i.exec(cellMatch[1])
      if (indexAttr) {
        const index = Number(indexAttr[1])
        while (cells.length < index - 1) cells.push('')
      }
      const data = /<Data\b[^>]*>([\s\S]*?)<\/Data>/i.exec(cellMatch[2])
      cells.push(stripTags(data ? data[1] : cellMatch[2]))
    }
    if (cells.some((c) => c)) rows.push(cells)
  }
  return rows.length >= 2 ? rows : null
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  cells.push(cur.trim())
  return cells
}

function splitRecords(text: string): string[] {
  const lines: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      cur += ch
      continue
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      if (cur.trim()) lines.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) lines.push(cur)
  return lines
}

function detectDelimiter(headerLine: string): string {
  if (headerLine.includes('\t') && headerLine.split('\t').length >= 3) return '\t'
  const commas = (headerLine.match(/,/g) || []).length
  const semis = (headerLine.match(/;/g) || []).length
  return semis > commas ? ';' : ','
}

function mappedFieldCount(cols: Col[]): number {
  return cols.filter((c) => c.field !== 'unknown').length
}

function colsFromFields(fields: Field[]): Col[] {
  return fields.map((field) => ({ field, raw: field }))
}

function detectColumns(headerCells: string[], sampleCells: string[]): Col[] {
  const mapped = headerCells.map((raw) => ({ field: mapHeader(raw), raw }))
  if (mappedFieldCount(mapped) >= 2) return mapped

  if (looksLikeDate(sampleCells[0] || headerCells[0] || '')) {
    return colsFromFields(GOLDSHARK_FIELDS)
  }
  return colsFromFields(TEMPLATE_FIELDS)
}

function findBoolRun(cells: string[]): number {
  for (let i = 0; i <= cells.length - 4; i++) {
    if (
      looksLikeBool(cells[i]) &&
      looksLikeBool(cells[i + 1]) &&
      looksLikeBool(cells[i + 2]) &&
      looksLikeBool(cells[i + 3])
    ) {
      return i
    }
  }
  return -1
}

function splitAddressAndPhone(parts: string[]): { address: string; phone: string } {
  const cells = [...parts]
  if (cells.length && cells[cells.length - 1] === '') {
    cells.pop()
    return { address: cells.join(', ').replace(/,\s*,/g, ',').trim(), phone: '' }
  }
  const phones: string[] = []
  while (cells.length && looksLikePhone(cells[cells.length - 1])) {
    phones.unshift(cells.pop() as string)
  }
  return {
    address: cells.join(', ').replace(/,\s*,/g, ',').trim(),
    phone: phones.join(', '),
  }
}

function assign(out: Partial<Record<Field, string>>, field: Field | 'unknown', value: string) {
  if (field === 'unknown' || field === 'date') return
  if (out[field] == null || out[field] === '') out[field] = value
}

function mappingLooksWrong(cells: string[], mapped: Partial<Record<Field, string>>): boolean {
  if (looksLikeDate((mapped.name ?? '').trim())) return true
  const gstInRow = cells.find(looksLikeGstin)
  if (gstInRow && !looksLikeGstin((mapped.gstin ?? '').trim())) return true
  const phone = (mapped.phone ?? '').trim()
  if (phone && !looksLikePhone(phone) && /[a-z]/i.test(phone)) return true
  return false
}

function zipRow(cols: Col[], cells: string[]): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {}
  const padded = [...cells]
  while (padded.length < cols.length) padded.push('')
  const extra = padded.length - cols.length
  if (extra === 0) {
    const simple: Partial<Record<Field, string>> = {}
    cols.forEach((col, i) => assign(simple, col.field, padded[i] ?? ''))
    if (!mappingLooksWrong(padded, simple)) return simple
  }

  const gstCell = padded.findIndex(looksLikeGstin)
  const gstCol = cols.findIndex((c) => c.field === 'gstin')
  if (gstCell >= 0 && gstCol >= 0) {
    const leadingCols = cols.slice(0, gstCol)
    const trailingCols = cols.slice(gstCol)
    const leadingCells = padded.slice(0, gstCell)
    const trailingCells = padded.slice(gstCell)
    const leading = alignLeading(leadingCols, leadingCells)
    trailingCols.forEach((col, i) => assign(out, col.field, trailingCells[i] ?? ''))
    Object.assign(out, leading)
    return out
  }

  const boolAt = findBoolRun(padded)
  const boolCol = cols.findIndex((c) => c.field === 'igstApplicable')
  if (boolAt >= 0 && boolCol >= 0) {
    const before = padded.slice(0, boolAt)
    let licenseNo = ''
    let gstin = ''
    const rest = [...before]
    if (rest.length && looksLikeCmi(rest[rest.length - 1])) {
      licenseNo = rest.pop() as string
    }
    if (rest.length && (looksLikeGstin(rest[rest.length - 1]) || rest[rest.length - 1] === '')) {
      gstin = rest.pop() as string
    }
    const gstCol = cols.findIndex((c) => c.field === 'gstin')
    const leadingEnd = gstCol >= 0 ? gstCol : boolCol
    const leading = alignLeading(cols.slice(0, leadingEnd), rest)
    Object.assign(out, leading)
    assign(out, 'gstin', gstin)
    assign(out, 'licenseNo', licenseNo)
    cols.slice(boolCol).forEach((col, i) => assign(out, col.field, padded[boolAt + i] ?? ''))
    return out
  }

  const addressCol = cols.findIndex((c) => c.field === 'address')
  if (addressCol >= 0) {
    const before = padded.slice(0, addressCol)
    const afterCount = cols.length - addressCol - 1
    const middle = padded.slice(addressCol, padded.length - afterCount)
    const after = padded.slice(padded.length - afterCount)
    before.forEach((value, i) => assign(out, cols[i]?.field ?? 'unknown', value))
    const { address, phone } = splitAddressAndPhone(middle)
    assign(out, 'address', address)
    if (cols[addressCol + 1]?.field === 'phone') assign(out, 'phone', phone)
    cols.slice(addressCol + 1).forEach((col, i) => assign(out, col.field, after[i] ?? ''))
    return out
  }

  cols.forEach((col, i) => assign(out, col.field, padded[i] ?? ''))
  return out
}

function alignLeading(cols: Col[], cells: string[]): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {}
  if (cols.length === 0) return out

  let offset = 0
  if (cols[0]?.field === 'date') offset = 1
  if (cols.some((c) => c.field === 'name')) {
    assign(out, 'name', cells[offset] ?? '')
    offset += 1
  }
  const restCells = cells.slice(offset)
  const hasAddr = cols.some((c) => c.field === 'address')
  const hasPhone = cols.some((c) => c.field === 'phone')
  if (hasAddr && hasPhone) {
    const split = splitAddressAndPhone(restCells)
    assign(out, 'address', split.address)
    assign(out, 'phone', split.phone)
  } else if (hasAddr) {
    assign(out, 'address', restCells.join(', '))
  } else {
    cols.slice(offset).forEach((col, i) => assign(out, col.field, restCells[i] ?? ''))
  }
  return out
}

function toPartyRow(
  mapped: Partial<Record<Field, string>>,
  states: readonly StateOption[],
): PartyImportRow | null {
  const name = (mapped.name ?? '').trim()
  if (!name || looksLikeDate(name)) return null
  const address = (mapped.address ?? '').trim()
  if (!address) return null

  const rawGst = (mapped.gstin ?? '').trim()
  const gstin = validatePartyGstin(rawGst) ? '' : normalizePartyGstin(rawGst)
  const resolved = resolveImportedState(mapped.state ?? '', mapped.stateCode ?? '', states)

  return {
    name,
    address,
    phone: (mapped.phone ?? '').trim(),
    gstin,
    licenseNo: (mapped.licenseNo ?? '').trim(),
    state: resolved.name,
    stateCode: resolved.code,
    transactionType: parseTxn(mapped.transactionType ?? ''),
    groupName: (mapped.groupName ?? '').trim(),
    skipMinBill: parseBool(mapped.skipMinBill ?? '', false),
    skipRejectedPics: parseBool(mapped.skipRejectedPics ?? '', true),
    skipCutting: parseBool(mapped.skipCutting ?? '', true),
    igstApplicable: parseBool(mapped.igstApplicable ?? '', false),
    discount: Number(mapped.discount ?? 0) || 0,
    minBillCalc: parseBool(mapped.minBillCalc ?? '', false),
  }
}

function matrixToResult(matrix: string[][], states: readonly StateOption[]): PartyImportResult {
  if (matrix.length < 2) return { rows: [], skipped: 0, error: 'File has no data rows' }

  const headerCells = matrix[0].map((c) => c.replace(/^\uFEFF/, '').trim())
  const dataRows = matrix.slice(1)
  const cols = detectColumns(headerCells, dataRows[0] || [])
  const headerIsData = mappedFieldCount(headerCells.map((raw) => ({ field: mapHeader(raw), raw }))) < 2
  const records = headerIsData ? matrix : dataRows

  const rows: PartyImportRow[] = []
  let skipped = 0
  for (const cells of records) {
    const party = toPartyRow(zipRow(cols, cells), states)
    if (!party) {
      skipped += 1
      continue
    }
    rows.push(party)
  }
  return { rows, skipped }
}

function delimitedToMatrix(text: string): string[][] {
  const records = splitRecords(text.replace(/^\uFEFF/, ''))
  if (!records.length) return []
  const delimiter = detectDelimiter(records[0])
  return records.map((line) => splitDelimitedLine(line, delimiter))
}

export function parsePartyImportText(text: string, states: readonly StateOption[]): PartyImportResult {
  const trimmed = text.trim()
  if (!trimmed) return { rows: [], skipped: 0, error: 'File has no data rows' }

  const html = parseHtmlTable(trimmed)
  if (html) return matrixToResult(html, states)

  const xml = parseSpreadsheetMl(trimmed)
  if (xml) return matrixToResult(xml, states)

  return matrixToResult(delimitedToMatrix(trimmed), states)
}

export function decodePartyImportBytes(bytes: Uint8Array): { text: string } | { error: string } {
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return {
      error:
        'This is an Excel .xlsx file. In Excel use File → Save As → CSV UTF-8 (.csv), then import that CSV.',
    }
  }
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf) {
    return {
      error:
        'This is a binary Excel .xls file. In Excel use File → Save As → CSV UTF-8 (.csv), then import that CSV.',
    }
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes) }
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes) }
  }
  if (bytes.length >= 4 && bytes[1] === 0x00 && bytes[3] === 0x00) {
    return { text: new TextDecoder('utf-16le').decode(bytes) }
  }
  return { text: new TextDecoder('utf-8').decode(bytes) }
}

export function parsePartyImportBytes(
  bytes: Uint8Array,
  states: readonly StateOption[],
): PartyImportResult {
  const decoded = decodePartyImportBytes(bytes)
  if ('error' in decoded) return { rows: [], skipped: 0, error: decoded.error }
  return parsePartyImportText(decoded.text, states)
}

export const PARTY_IMPORT_TEMPLATE_HEADER = [
  'Date',
  'Party Name',
  'Address',
  'Contact No',
  'GSTNO',
  'CMI NO',
  'IGST',
  'Skip Minimum',
  'Skip Rejected',
  'Skip Cutting',
  'State',
  'State Code',
  'Discount',
  'Min. Bill Calc',
  'Transaction',
  'Group',
].join(',')

export const PARTY_IMPORT_TEMPLATE_SAMPLE = [
  '',
  'Demo Jewellers',
  '"MG Road, Pune"',
  '9876543210',
  '27AAAAA0000A1Z5',
  'LIC-2001',
  'Unchecked',
  'Unchecked',
  'Checked',
  'Checked',
  'Maharashtra',
  '27',
  '0',
  'Unchecked',
  'Cash',
  '',
].join(',')
