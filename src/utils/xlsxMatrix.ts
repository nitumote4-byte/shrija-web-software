/**
 * Read spreadsheet bytes into a string matrix.
 * Supports .xlsx (Office Open XML zip), SpreadsheetML, HTML tables, CSV, and TSV.
 */

export type SpreadsheetSheet = { name: string; rows: string[][] }

export type SpreadsheetParseResult = {
  sheets: SpreadsheetSheet[]
  error?: string
}

const ZIP_LOCAL = 0x04034b50
const ZIP_CENTRAL = 0x02014b50
const ZIP_EOCD = 0x06054b50

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8)
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  )
}

export function isZipBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
}

export function isOleCompoundBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
}

export function looksLikeOfficeXml(value: string): boolean {
  const v = value.trim()
  if (!v.startsWith('<')) return false
  return (
    /xmlns\s*=\s*"http:\/\/schemas\.(?:openxmlformats|microsoft)\.com/i.test(v) ||
    /<\s*(?:Relationships|styleSheet|Types|workbook|worksheet|sst|theme|a:theme)\b/i.test(v)
  )
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes)
}

export function decodeSpreadsheetText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes)
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes)
  }
  if (bytes.length >= 4 && bytes[1] === 0x00 && bytes[3] === 0x00) {
    return new TextDecoder('utf-16le').decode(bytes)
  }
  return decodeUtf8(bytes)
}

function unescapeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/gi, ' ')
}

function stripTags(html: string): string {
  return unescapeXml(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' '),
  ).trim()
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This browser cannot read compressed Excel files. Save as CSV UTF-8 and upload that.')
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function findEocd(bytes: Uint8Array): number {
  const min = Math.max(0, bytes.length - 65557)
  for (let i = bytes.length - 22; i >= min; i--) {
    if (u32(bytes, i) === ZIP_EOCD) return i
  }
  return -1
}

async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>()
  const eocd = findEocd(bytes)
  if (eocd < 0) throw new Error('not a zip archive')
  const count = u16(bytes, eocd + 10)
  let offset = u32(bytes, eocd + 16)
  for (let i = 0; i < count; i++) {
    if (u32(bytes, offset) !== ZIP_CENTRAL) throw new Error('zip directory damaged')
    const method = u16(bytes, offset + 10)
    const compact = u32(bytes, offset + 20)
    const nameLen = u16(bytes, offset + 28)
    const extraLen = u16(bytes, offset + 30)
    const commentLen = u16(bytes, offset + 32)
    const localOff = u32(bytes, offset + 42)
    const name = decodeUtf8(bytes.subarray(offset + 46, offset + 46 + nameLen)).replace(/\\/g, '/')
    const localNameLen = u16(bytes, localOff + 26)
    const localExtra = u16(bytes, localOff + 28)
    if (u32(bytes, localOff) !== ZIP_LOCAL) throw new Error('zip local header damaged')
    const dataStart = localOff + 30 + localNameLen + localExtra
    const packed = bytes.subarray(dataStart, dataStart + compact)
    offset += 46 + nameLen + extraLen + commentLen
    if (!name || name.endsWith('/')) continue
    if (method === 0) {
      files.set(name, packed.slice())
      continue
    }
    if (method !== 8) continue
    files.set(name, await inflateRaw(packed))
  }
  return files
}

function fileMap(files: Map<string, Uint8Array>): Map<string, string> {
  const out = new Map<string, string>()
  for (const [name, data] of files) {
    out.set(name.replace(/^\/+/, '').toLowerCase(), decodeUtf8(data).replace(/^\uFEFF/, ''))
  }
  return out
}

function attr(source: string, name: string): string {
  const re = new RegExp(`\\b${name}="([^"]*)"`, 'i')
  return re.exec(source)?.[1] || ''
}

function colRowFromRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim())
  if (!m) return null
  let col = 0
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64)
  return { col: col - 1, row: Number(m[2]) - 1 }
}

function innerText(xml: string, tag: string): string {
  const re = new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'i')
  const m = re.exec(xml)
  return m ? stripTags(m[1]) : ''
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = []
  const re = /<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/gi
  for (const m of xml.matchAll(re)) {
    const texts = [...m[1].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/gi)]
    out.push(texts.map((t) => unescapeXml(t[1]).replace(/\s+/g, ' ').trim()).join(''))
  }
  return out
}

function cellValue(inner: string, cellOpen: string, shared: string[]): string {
  const type = attr(cellOpen, 't').toLowerCase()
  if (type === 's') {
    const idx = Number(innerText(inner, 'v'))
    return Number.isFinite(idx) ? shared[idx] || '' : ''
  }
  if (type === 'inlinestr' || type === 'str') {
    const inline = innerText(inner, 't') || stripTags(inner)
    return inline
  }
  if (type === 'b') {
    const v = innerText(inner, 'v')
    return v === '1' || /^true$/i.test(v) ? 'TRUE' : 'FALSE'
  }
  return innerText(inner, 'v')
}

function parseSheetXml(xml: string, shared: string[]): string[][] {
  const grid: string[][] = []
  const rowRe = /<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/gi
  const cellRe = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/gi
  let rowIndex = 0
  for (const rowMatch of xml.matchAll(rowRe)) {
    const rowOpen = rowMatch[0].slice(0, rowMatch[0].indexOf('>') + 1)
    const hinted = Number(attr(rowOpen, 'r'))
    if (Number.isFinite(hinted) && hinted > 0) rowIndex = hinted - 1
    const cells: string[] = grid[rowIndex] ? [...grid[rowIndex]] : []
    let colCursor = 0
    for (const cellMatch of rowMatch[1].matchAll(cellRe)) {
      const open = cellMatch[1] || ''
      const inner = cellMatch[2] || ''
      const ref = colRowFromRef(attr(open, 'r'))
      const col = ref ? ref.col : colCursor
      while (cells.length <= col) cells.push('')
      cells[col] = cellValue(inner, open, shared)
      colCursor = col + 1
    }
    if (cells.some((c) => c)) grid[rowIndex] = cells
    rowIndex += 1
  }
  return grid.filter((row) => row && row.some((c) => String(c).trim()))
}

function parseWorkbookSheets(xml: string): { name: string; rid: string }[] {
  const out: { name: string; rid: string }[] = []
  const re = /<(?:\w+:)?sheet\b([^>]*)\/?>/gi
  for (const m of xml.matchAll(re)) {
    const open = m[1]
    const name = unescapeXml(attr(open, 'name') || 'Sheet')
    const rid = attr(open, 'r:id') || attr(open, 'id')
    if (rid) out.push({ name, rid })
  }
  return out
}

function parseRels(xml: string): Map<string, string> {
  const out = new Map<string, string>()
  const re = /<(?:\w+:)?Relationship\b([^>]*)\/?>/gi
  for (const m of xml.matchAll(re)) {
    const open = m[1]
    const id = attr(open, 'Id')
    let target = attr(open, 'Target').replace(/\\/g, '/')
    if (!id || !target) continue
    if (target.startsWith('/')) target = target.slice(1)
    if (!target.toLowerCase().startsWith('xl/')) target = `xl/${target.replace(/^\.\//, '')}`
    out.set(id, target.toLowerCase())
  }
  return out
}

async function parseXlsx(bytes: Uint8Array): Promise<SpreadsheetSheet[]> {
  const files = fileMap(await unzip(bytes))
  const shared = parseSharedStrings(files.get('xl/sharedstrings.xml') || '')
  const workbook = files.get('xl/workbook.xml') || ''
  const rels = parseRels(files.get('xl/_rels/workbook.xml.rels') || '')
  const listed = parseWorkbookSheets(workbook)
  const sheets: SpreadsheetSheet[] = []
  for (const item of listed) {
    const path = rels.get(item.rid)
    const xml = path ? files.get(path) : ''
    if (!xml) continue
    const rows = parseSheetXml(xml, shared)
    if (rows.length) sheets.push({ name: item.name, rows })
  }
  if (sheets.length) return sheets
  const fallback = [...files.entries()]
    .filter(([name]) => /xl\/worksheets\/[^/]+\.xml$/i.test(name))
    .sort(([a], [b]) => a.localeCompare(b))
  for (const [name, xml] of fallback) {
    const rows = parseSheetXml(xml, shared)
    if (rows.length) sheets.push({ name: name.split('/').pop() || 'Sheet', rows })
  }
  return sheets
}

function parseHtmlTable(text: string): string[][] | null {
  if (!/<table[\s>]/i.test(text) || !/<tr[\s>]/i.test(text)) return null
  const rows: string[][] = []
  for (const rowMatch of text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1]))
    if (cells.some((c) => c)) rows.push(cells)
  }
  return rows.length ? rows : null
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
  return rows.length ? rows : null
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

function detectDelimiter(line: string): string {
  const commas = (line.match(/,/g) || []).length
  const tabs = (line.match(/\t/g) || []).length
  const semis = (line.match(/;/g) || []).length
  if (tabs > commas && tabs >= semis) return '\t'
  if (semis > commas && semis > tabs) return ';'
  return ','
}

export function parseDelimitedMatrix(text: string): string[][] {
  const raw = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = raw.split('\n').filter((l) => l.trim())
  if (!lines.length) return []
  const delimiter = detectDelimiter(lines[0])
  return lines.map((line) => splitDelimitedLine(line, delimiter))
}

export function parseTextSpreadsheet(text: string): SpreadsheetSheet[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const html = parseHtmlTable(trimmed)
  if (html) return [{ name: 'Sheet1', rows: html }]
  const xml = parseSpreadsheetMl(trimmed)
  if (xml) return [{ name: 'Sheet1', rows: xml }]
  const rows = parseDelimitedMatrix(trimmed)
  return rows.length ? [{ name: 'Sheet1', rows }] : []
}

export async function parseSpreadsheetBytes(bytes: Uint8Array): Promise<SpreadsheetParseResult> {
  if (!bytes.length) return { sheets: [], error: 'File is empty' }
  if (isOleCompoundBytes(bytes)) {
    return {
      sheets: [],
      error: 'This is an old .xls file. In Excel use File → Save As → Excel Workbook (.xlsx) or CSV UTF-8, then upload that file.',
    }
  }
  if (isZipBytes(bytes)) {
    try {
      const sheets = await parseXlsx(bytes)
      if (!sheets.length) return { sheets: [], error: 'Excel file has no data rows' }
      return { sheets }
    } catch {
      return {
        sheets: [],
        error: 'Could not read this Excel file. Save it as .xlsx or CSV UTF-8 from Excel, then upload again.',
      }
    }
  }
  const text = decodeSpreadsheetText(bytes)
  if (looksLikeOfficeXml(text.slice(0, 400))) {
    return {
      sheets: [],
      error: 'This Excel file was not read as a workbook. Upload the .xlsx file, or save as CSV UTF-8 from Excel.',
    }
  }
  const sheets = parseTextSpreadsheet(text)
  if (!sheets.length) return { sheets: [], error: 'File has no data rows' }
  const firstCell = sheets[0]?.rows[0]?.[0] || ''
  if (looksLikeOfficeXml(firstCell)) {
    return {
      sheets: [],
      error: 'Upload the Excel workbook (.xlsx) or a CSV export — internal XML was read instead of cell values.',
    }
  }
  return { sheets }
}
