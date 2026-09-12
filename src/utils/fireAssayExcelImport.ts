import {
  looksLikeOfficeXml,
  parseSpreadsheetBytes,
  type SpreadsheetSheet,
} from './xlsxMatrix'

export type FireAssayImportRow = {
  sampleDrawn: string
  jobCardNo: string
  sampleWeight: string
  silver: string
  lead: string
  wotgcaa: string
  fineness: string
  meanFineness: string
}

export type FireAssayImportCg = {
  which: 1 | 2
  weight: string
  silver: string
  lead: string
  wotgcaa: string
  copper: string
}

export type FireAssayImportResult = {
  rows: FireAssayImportRow[]
  cg1?: FireAssayImportCg
  cg2?: FireAssayImportCg
  sheetName?: string
  error?: string
}

type Field =
  | 'sampleDrawn'
  | 'jobCardNo'
  | 'sampleWeight'
  | 'silver'
  | 'lead'
  | 'wotgcaa'
  | 'fineness'
  | 'meanFineness'
  | 'copper'

const FIELD_ALIASES: { field: Field; aliases: string[] }[] = [
  { field: 'sampleDrawn', aliases: ['sampledrawnbuttonweight', 'sampledrawnbuttonwt', 'sampledrawnbutton', 'sampledrawn', 'sampledraw', 'buttonweight', 'buttonwt'] },
  { field: 'sampleWeight', aliases: ['sampleweight', 'samplewt', 'samplew'] },
  { field: 'jobCardNo', aliases: ['jobcardnumber', 'jobcardno', 'jobcard', 'jobno'] },
  { field: 'meanFineness', aliases: ['meanfinenessinppt', 'meanfineness'] },
  { field: 'fineness', aliases: ['finenessinppt', 'fineness'] },
  { field: 'wotgcaa', aliases: ['weightofthegoldcornetafterassaying', 'wtofgoldcornetafterassay', 'wtofgoldcornet', 'wtofgold', 'wotgcaa', 'goldcornet'] },
  { field: 'silver', aliases: ['silver'] },
  { field: 'lead', aliases: ['lead'] },
  { field: 'copper', aliases: ['copper'] },
]

function compactHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function mapHeader(raw: string): Field | null {
  const h = compactHeader(raw)
  if (!h) return null
  for (const { field, aliases } of FIELD_ALIASES) {
    if (aliases.includes(h)) return field
  }
  return null
}

function isCgJob(value: string): 1 | 2 | null {
  const v = value.replace(/\s+/g, '').toUpperCase()
  if (/^(CG|CHECKGOLD)1$/.test(v) || /^COPPER1$/.test(v)) return 1
  if (/^(CG|CHECKGOLD)2$/.test(v) || /^COPPER2$/.test(v)) return 2
  return null
}

function looksLikeCopperLabel(value: string): boolean {
  return /copper/i.test(value) && !/^\d/.test(value.trim())
}

function matrixHasOfficeXml(rows: string[][]): boolean {
  for (const row of rows.slice(0, 8)) {
    for (const cell of row.slice(0, 8)) {
      if (looksLikeOfficeXml(cell)) return true
    }
  }
  return false
}

function headerMap(row: string[]): Map<Field, number> | null {
  const map = new Map<Field, number>()
  row.forEach((cell, i) => {
    const field = mapHeader(cell)
    if (field && !map.has(field)) map.set(field, i)
  })
  const mapped = map.size
  if (mapped >= 3 && map.has('jobCardNo')) return map
  return null
}

function positionalMap(row: string[]): Map<Field, number> {
  const order: Field[] = [
    'sampleDrawn',
    'jobCardNo',
    'sampleWeight',
    'silver',
    'lead',
    'wotgcaa',
    'fineness',
    'meanFineness',
  ]
  const map = new Map<Field, number>()
  let slot = 0
  row.forEach((cell, i) => {
    if (!String(cell).trim() && slot < 5) return
    const field = order[slot]
    if (!field) return
    map.set(field, i)
    slot += 1
  })
  return map
}

function cellAt(row: string[], map: Map<Field, number>, field: Field): string {
  const i = map.get(field)
  if (i == null) return ''
  return String(row[i] ?? '').trim()
}

function toRow(row: string[], map: Map<Field, number>): FireAssayImportRow {
  const sampleWeight = cellAt(row, map, 'sampleWeight')
  const sampleDrawn = cellAt(row, map, 'sampleDrawn')
  const wotgcaa = cellAt(row, map, 'wotgcaa')
  const fineness = cellAt(row, map, 'fineness')
  return {
    sampleDrawn,
    jobCardNo: cellAt(row, map, 'jobCardNo'),
    sampleWeight,
    silver: cellAt(row, map, 'silver'),
    lead: cellAt(row, map, 'lead') || '4.0',
    wotgcaa,
    fineness: looksLikeCopperLabel(fineness) ? '' : fineness,
    meanFineness: cellAt(row, map, 'meanFineness'),
  }
}

function toCg(which: 1 | 2, row: FireAssayImportRow, copperCell: string, finenessRaw: string): FireAssayImportCg {
  const copperFromLabel = looksLikeCopperLabel(finenessRaw) ? row.meanFineness : ''
  const copper = copperCell || copperFromLabel
  return {
    which,
    weight: row.sampleWeight || row.sampleDrawn,
    silver: row.silver,
    lead: row.lead,
    wotgcaa: row.wotgcaa,
    copper,
  }
}

function scoreSheet(sheet: SpreadsheetSheet): number {
  const name = sheet.name.toLowerCase()
  let score = 0
  if (/fire\s*assay|assay\s*data/i.test(sheet.name)) score += 50
  if (/specific/i.test(name)) score -= 20
  const header = headerMap(sheet.rows[0] || [])
  if (header) score += 20 + header.size
  const jobs = sheet.rows.filter((r) => /^\d+[_\-/]/.test((r[1] || r[0] || '').trim())).length
  score += jobs
  return score
}

function pickSheet(sheets: SpreadsheetSheet[]): SpreadsheetSheet | null {
  if (!sheets.length) return null
  return [...sheets].sort((a, b) => scoreSheet(b) - scoreSheet(a))[0] || null
}

export function mapFireAssaySheet(sheet: SpreadsheetSheet): FireAssayImportResult {
  const rowsIn = sheet.rows.filter((r) => r.some((c) => String(c).trim()))
  if (!rowsIn.length) return { rows: [], error: 'File has no data rows' }
  if (matrixHasOfficeXml(rowsIn)) {
    return {
      rows: [],
      error: 'Upload the Excel workbook (.xlsx) or a CSV export — internal XML was read instead of cell values.',
    }
  }

  let header: Map<Field, number> | null = null
  let headerIdx = -1
  for (let i = 0; i < rowsIn.length; i++) {
    const found = headerMap(rowsIn[i])
    if (found) {
      header = found
      headerIdx = i
      break
    }
  }
  const map = header || positionalMap(rowsIn[0])
  const data = header ? rowsIn.slice(headerIdx + 1) : rowsIn

  const rows: FireAssayImportRow[] = []
  let cg1: FireAssayImportCg | undefined
  let cg2: FireAssayImportCg | undefined

  for (const raw of data) {
    const mapped = toRow(raw, map)
    const cgWhich = isCgJob(mapped.jobCardNo)
    if (cgWhich) {
      const copper = cellAt(raw, map, 'copper')
      const finenessRaw = cellAt(raw, map, 'fineness')
      const cg = toCg(cgWhich, mapped, copper, finenessRaw)
      if (cgWhich === 1) cg1 = cg
      else cg2 = cg
      continue
    }
    if (!mapped.jobCardNo && !mapped.sampleWeight && !mapped.sampleDrawn && !mapped.wotgcaa) continue
    rows.push(mapped)
  }

  if (!rows.length && !cg1 && !cg2) return { rows: [], error: 'File has no data rows' }
  return { rows, cg1, cg2, sheetName: sheet.name }
}

export async function parseFireAssaySpreadsheet(bytes: Uint8Array): Promise<FireAssayImportResult> {
  const parsed = await parseSpreadsheetBytes(bytes)
  if (parsed.error) return { rows: [], error: parsed.error }
  const sheet = pickSheet(parsed.sheets)
  if (!sheet) return { rows: [], error: 'File has no data rows' }
  return mapFireAssaySheet(sheet)
}
