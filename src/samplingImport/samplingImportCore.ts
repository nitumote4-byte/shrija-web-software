/**
 * Read-only Manak Sampling Details extraction and QM row matching.
 * Fixture values stay in tests. This module never invents a job number.
 */
import { matchItemMasterName } from '../utils/itemCategoryMatch.ts'

export const SAMPLING_IMPORT_SOURCE = 'shrija-sampling-import'
export const SAMPLING_IMPORT_VERSION = 1

export type SamplesStatus = 'Yes' | 'No'

export type ManakSamplingRow = {
  rowKey: string
  rowNumber: string
  itemType: string
  materialType: string
  samplingMethod: string
  tagId: string
  samples: SamplesStatus
  weight: string
  quantity: string
}

export type SamplingExtractOk = {
  ok: true
  requestNumber: string
  jobNumber: string
  rows: ManakSamplingRow[]
}

export type SamplingExtractResult = SamplingExtractOk | { ok: false; error: string }

export type ShrijaSamplingRow = {
  id: string
  requestNo: string
  item: string
  purity: string
  samplingMethod: string
  pic: number
  weight: number
  jobCardNo: string
  sampleTagId: string
  jobCardSaved: boolean
  date: string
  shift: string
  partyName: string
}

export type SamplingProposalStatus =
  | 'ready'
  | 'job_only'
  | 'unchanged'
  | 'conflict'
  | 'ambiguous'
  | 'unmatched'
  | 'duplicate_tag'

export type SamplingCandidate = {
  id: string
  requestNo: string
  item: string
  purity: string
  samplingMethod: string
  pic: number
  weight: number
  jobCardNo: string
  sampleTagId: string
  date: string
  shift: string
  partyName: string
}

export type SamplingProposal = {
  rowKey: string
  rowNumber: string
  itemType: string
  materialType: string
  samplingMethod: string
  samples: SamplesStatus
  tagId: string
  status: SamplingProposalStatus
  message: string
  candidates: SamplingCandidate[]
  selectedId: string | null
  proposedJobNumber: string
  proposedTagId: string
  assignTag: boolean
  existingJobCardNo: string
  existingSampleTagId: string
  existingItem: string
  willWrite: boolean
}

export type SamplingMatchOk = {
  ok: true
  requestNumber: string
  jobNumber: string
  storedRequestNo: string
  proposals: SamplingProposal[]
}

export type SamplingMatchResult =
  | SamplingMatchOk
  | { ok: false; error: string; code: string }

type HeaderField =
  | 'itemType'
  | 'materialType'
  | 'samplingMethod'
  | 'tagId'
  | 'samples'
  | 'weight'
  | 'quantity'
  | 'rowNumber'
  | 'requestNumber'
  | 'jobNumber'

const HEADER_ALIASES: { field: HeaderField; names: string[] }[] = [
  { field: 'itemType', names: ['item type', 'item category', 'item name', 'item'] },
  { field: 'materialType', names: ['material type', 'material', 'metal'] },
  { field: 'samplingMethod', names: ['sampling method', 'method'] },
  { field: 'tagId', names: ['tag id', 'tagid', 'sample tag id', 'sample tag'] },
  { field: 'samples', names: ['samples', 'sample status', 'samples status'] },
  { field: 'weight', names: ['weight', 'wt', 'gross weight', 'item weight'] },
  { field: 'quantity', names: ['quantity', 'qty', 'pic', 'pcs', 'pieces'] },
  { field: 'rowNumber', names: ['sr no', 's no', 'sl no', 'serial no', 'serial', '#'] },
  { field: 'requestNumber', names: ['request number', 'request no'] },
  { field: 'jobNumber', names: ['job number', 'job no'] },
]

const REQUEST_LABELS = ['request number', 'request no']
const JOB_LABELS = ['job number', 'job no']
const REJECT_VALUES = new Set([
  'yes',
  'no',
  'select',
  'job',
  'job number',
  'job no',
  'request',
  'request number',
  'request no',
  'item',
  'item type',
  'tag',
  'tag id',
  'samples',
  'sample',
  'material',
  'method',
  'gold',
  'silver',
  'na',
  'n/a',
  '-',
  '—',
])

export function cleanSamplingText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sameRequestNo(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = cleanSamplingText(left).toLowerCase()
  const b = cleanSamplingText(right).toLowerCase()
  return Boolean(a) && a === b
}

export function isAcceptableSamplingCode(value: string, minLength: number): boolean {
  const text = cleanSamplingText(value)
  if (!text || REJECT_VALUES.has(text.toLowerCase())) return false
  if (text.length < minLength || text.length > 40) return false
  return /^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(text)
}

function normHeader(value: string): string {
  const raw = cleanSamplingText(value)
  if (raw === '#') return '#'
  return raw
    .toLowerCase()
    .replace(/[.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fieldForHeader(value: string): HeaderField | null {
  const header = normHeader(value)
  if (!header) return null
  let match: HeaderField | null = null
  let matchLen = -1
  for (const group of HEADER_ALIASES) {
    for (const name of group.names) {
      if (header === name && name.length > matchLen) {
        match = group.field
        matchLen = name.length
      }
    }
  }
  return match
}

function ownText(el: Element): string {
  let out = ''
  for (const node of el.childNodes) {
    if (node.nodeType === 3) out += node.textContent || ''
  }
  return cleanSamplingText(out)
}

function isHidden(el: Element): boolean {
  let cur: Element | null = el
  while (cur) {
    if (cur.hasAttribute('hidden')) return true
    const style = cur.ownerDocument.defaultView?.getComputedStyle(cur)
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return true
    cur = cur.parentElement
  }
  return false
}

function controlValue(el: Element): string {
  const tag = el.tagName
  if (tag === 'SELECT') {
    const select = el as HTMLSelectElement
    const option = select.selectedOptions[0]
    return cleanSamplingText(option?.textContent || select.value)
  }
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    return cleanSamplingText((el as HTMLInputElement).value)
  }
  return ''
}

function elementValue(el: Element): string {
  const direct = controlValue(el)
  if (direct) return direct
  const text = cleanSamplingText(el.textContent || '')
  if (text) return text
  const field = el.querySelector('input, textarea, select')
  return field ? controlValue(field) : ''
}

function takeCode(raw: string, minLength: number): string {
  const text = cleanSamplingText(raw)
  if (isAcceptableSamplingCode(text, minLength)) return text
  const token = text.split(' ')[0] || ''
  if (isAcceptableSamplingCode(token, minLength)) return token
  return ''
}

function readInline(text: string, labels: string[]): string {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`^${escaped}\\s*[:\\-]\\s*(.+)$`, 'i').exec(text)
    if (match?.[1]) return cleanSamplingText(match[1])
  }
  return ''
}

function valueAfterLabel(el: Element): string {
  const next = el.nextElementSibling
  if (next && !isHidden(next)) {
    const text = elementValue(next)
    if (text) return text
  }
  const cell = el.closest('td, th')
  const row = el.closest('tr')
  if (cell && row) {
    const cells = [...row.children]
    const index = cells.indexOf(cell)
    const following = index >= 0 ? cells[index + 1] : null
    if (following && !isHidden(following)) return elementValue(following)
  }
  return ''
}

function collectLabeled(doc: Document, skip: Element | null, labels: string[], minLength: number): string[] {
  const found = new Set<string>()
  for (const el of doc.querySelectorAll('td, th, label, span, div, dt, dd, p, b, strong, font, li')) {
    if (skip?.contains(el)) continue
    if (el.closest('script, style, noscript, template')) continue
    if (isHidden(el)) continue
    const text = ownText(el)
    if (!text) continue
    const inline = readInline(text, labels)
    if (inline) {
      const code = takeCode(inline, minLength)
      if (code) found.add(code)
      continue
    }
    if (!labels.includes(normHeader(text))) continue
    const code = takeCode(valueAfterLabel(el), minLength)
    if (code) found.add(code)
  }
  return [...found]
}

function decodeManakQueryCode(raw: string | null | undefined, minLength: number): string {
  const text = cleanSamplingText(raw)
  if (!text) return ''
  try {
    if (typeof globalThis.atob === 'function') {
      const decoded = cleanSamplingText(globalThis.atob(text))
      if (isAcceptableSamplingCode(decoded, minLength)) return decoded
    }
  } catch {
    /* Not base64. Plain query values are checked below. */
  }
  return isAcceptableSamplingCode(text, minLength) ? text : ''
}

/**
 * Manak Sampling Details often hides Request Number while keeping it in the URL
 * as request_no (base64). Job Number must NEVER come from the URL: Manak's
 * job_no query value is frequently not the Job Number shown on the page.
 * Never read receipt, licence, voucher, or any other field here.
 */
export function collectManakSamplingUrlCodes(doc: Document): { requestNumber: string; jobNumber: string } {
  const empty = { requestNumber: '', jobNumber: '' }
  const href = cleanSamplingText(doc.URL || doc.location?.href || '')
  if (!href) return empty
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return empty
  }
  if (!/BIS_SamplingDetails/i.test(url.pathname)) return empty
  if (!/(^|\.)manakonline\.in$/i.test(url.hostname) && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    return empty
  }
  return {
    requestNumber: decodeManakQueryCode(url.searchParams.get('request_no'), 5),
    jobNumber: '',
  }
}

function parseSamples(value: string): SamplesStatus | null {
  const text = cleanSamplingText(value).toLowerCase()
  if (text === 'yes') return 'Yes'
  if (text === 'no') return 'No'
  return null
}

type HeaderRead = {
  map: Map<HeaderField, number>
  duplicate: boolean
  complete: boolean
}

function readHeader(row: HTMLTableRowElement): HeaderRead {
  const map = new Map<HeaderField, number>()
  let duplicate = false
  for (let index = 0; index < row.cells.length; index += 1) {
    const field = fieldForHeader(row.cells[index]?.textContent || '')
    if (!field) continue
    if (map.has(field)) duplicate = true
    map.set(field, index)
  }
  return {
    map,
    duplicate,
    complete: map.has('itemType') && map.has('tagId') && map.has('samples'),
  }
}

function cellSpan(cell: Element): { colspan: number; rowspan: number } {
  return {
    colspan: Number(cell.getAttribute('colspan') || '1') || 1,
    rowspan: Number(cell.getAttribute('rowspan') || '1') || 1,
  }
}

function rowHasMergedCells(row: HTMLTableRowElement): boolean {
  for (const cell of row.cells) {
    const span = cellSpan(cell)
    if (span.colspan > 1 || span.rowspan > 1) return true
  }
  return false
}

/**
 * Manak puts a Lot Number banner across the sampling grid. That rowspan/colspan
 * is not item data. Skip it. Keep rejecting merged cells on real item rows.
 */
function isLotOrGroupBanner(row: HTMLTableRowElement, map: Map<HeaderField, number>): boolean {
  if (!rowHasMergedCells(row)) return false
  const itemType = cellText(row.cells, map.get('itemType'))
  const tagId = cellText(row.cells, map.get('tagId'))
  const samplesRaw = cellText(row.cells, map.get('samples'))
  const materialType = cellText(row.cells, map.get('materialType'))
  const samplingMethod = cellText(row.cells, map.get('samplingMethod'))
  if (itemType || tagId || parseSamples(samplesRaw) || materialType || samplingMethod) return false
  const whole = cleanSamplingText(row.textContent || '').toLowerCase()
  return (
    whole.length === 0 ||
    /^lot\s*number\b/.test(whole) ||
    /\b\d+\s*items?\b/.test(whole) ||
    /\b\d+\s*samples?\b/.test(whole)
  )
}

function cellText(cells: HTMLCollectionOf<HTMLTableCellElement>, index: number | undefined): string {
  if (index == null || index < 0 || !cells[index]) return ''
  return elementValue(cells[index])
}

function chooseCode(
  outside: string[],
  column: string | { error: string },
  label: string,
  minLength: number,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof column !== 'string') return { ok: false, error: column.error }
  const values = new Set([...outside, column].map((value) => cleanSamplingText(value)).filter(Boolean))
  if (values.size > 1) {
    return { ok: false, error: `Conflicting ${label} values are on this page. Import stopped.` }
  }
  const value = [...values][0] || ''
  if (!isAcceptableSamplingCode(value, minLength)) {
    return {
      ok: false,
      error: `${label} was not found on this page. Import stopped. It was not taken from another field.`,
    }
  }
  return { ok: true, value }
}

export function extractSamplingDetails(doc: Document): SamplingExtractResult {
  const wrongPage =
    'This page is not View Sampling Details, or the sampling table has changed. Import stopped.'
  const tables = [...doc.querySelectorAll('table')]
  const found: { table: HTMLTableElement; headerIndex: number; map: Map<HeaderField, number> }[] = []

  for (const node of tables) {
    const table = node as HTMLTableElement
    for (let index = 0; index < table.rows.length; index += 1) {
      const header = readHeader(table.rows[index])
      if (header.duplicate && header.complete) {
        return { ok: false, error: 'The sampling table has duplicate columns. Import stopped.' }
      }
      if (!header.complete || header.duplicate) continue
      found.push({ table, headerIndex: index, map: header.map })
      break
    }
  }

  if (found.length === 0) return { ok: false, error: wrongPage }
  if (found.length > 1) {
    return { ok: false, error: 'More than one sampling table is on this page. Import stopped.' }
  }

  const { table, headerIndex, map } = found[0]
  if (rowHasMergedCells(table.rows[headerIndex])) {
    return { ok: false, error: 'The sampling table uses merged cells and cannot be read safely. Import stopped.' }
  }

  const rows: ManakSamplingRow[] = []
  for (let index = headerIndex + 1; index < table.rows.length; index += 1) {
    const tr = table.rows[index]
    if (isLotOrGroupBanner(tr, map)) continue
    if (rowHasMergedCells(tr)) {
      return { ok: false, error: 'The sampling table uses merged cells and cannot be read safely. Import stopped.' }
    }
    const itemType = cellText(tr.cells, map.get('itemType'))
    const tagId = cellText(tr.cells, map.get('tagId'))
    const samplesRaw = cellText(tr.cells, map.get('samples'))
    const materialType = cellText(tr.cells, map.get('materialType'))
    const samplingMethod = cellText(tr.cells, map.get('samplingMethod'))
    const weight = cellText(tr.cells, map.get('weight'))
    const quantity = cellText(tr.cells, map.get('quantity'))
    const rowNumberRaw = cellText(tr.cells, map.get('rowNumber'))
    if (!itemType && !tagId && !samplesRaw && !materialType && !samplingMethod) continue

    const samples = parseSamples(samplesRaw)
    if (!samples) {
      return {
        ok: false,
        error: `A sampling row has Samples "${samplesRaw || '(blank)'}" instead of Yes or No. Import stopped.`,
      }
    }
    if (!itemType) {
      return { ok: false, error: 'A sampling row has no Item Type. Import stopped.' }
    }
    if (samples === 'Yes' && !cleanSamplingText(tagId)) {
      return {
        ok: false,
        error: `Item "${itemType}" is Samples Yes but Tag ID is missing. Import stopped.`,
      }
    }
    if (cleanSamplingText(tagId) && !isAcceptableSamplingCode(tagId, 1)) {
      return { ok: false, error: `Tag ID "${tagId}" is not a usable identifier. Import stopped.` }
    }

    const rowNumber = cleanSamplingText(rowNumberRaw) || String(rows.length + 1)
    const domId = cleanSamplingText(tr.getAttribute('data-id') || tr.getAttribute('data-row-id') || '')
    let rowKey = ''
    if (domId) {
      if (!/^[A-Za-z0-9:_./-]{1,80}$/.test(domId)) {
        return { ok: false, error: 'A sampling row identifier is not stable. Import stopped.' }
      }
      rowKey = `id:${domId}`
    } else if (/^[A-Za-z0-9:_./-]{1,40}$/.test(rowNumber)) {
      rowKey = `row:${rowNumber}`
    } else {
      return { ok: false, error: 'A sampling row number is not stable. Import stopped.' }
    }
    if (rows.some((row) => row.rowKey === rowKey)) {
      return { ok: false, error: 'Sampling row identifiers are not unique. Import stopped.' }
    }

    rows.push({
      rowKey,
      rowNumber,
      itemType: cleanSamplingText(itemType),
      materialType: cleanSamplingText(materialType),
      samplingMethod: cleanSamplingText(samplingMethod),
      tagId: cleanSamplingText(tagId),
      samples,
      weight: cleanSamplingText(weight),
      quantity: cleanSamplingText(quantity),
    })
  }

  if (rows.length === 0) {
    return { ok: false, error: 'The sampling table has no item rows. Import stopped.' }
  }
  if (rows.length > 100) {
    return { ok: false, error: 'The sampling table has too many rows to import safely. Import stopped.' }
  }

  const columnValues = collectRowColumns(table, headerIndex, map)
  if ('error' in columnValues) return { ok: false, error: columnValues.error }

  const urlCodes = collectManakSamplingUrlCodes(doc)
  // Job Number: page label / table column only. Never URL job_no.
  // Request Number: page label first; URL request_no only if the page omitted it.
  const labeledRequests = collectLabeled(doc, table, REQUEST_LABELS, 5)
  const labeledJobs = collectLabeled(doc, table, JOB_LABELS, 3)
  const requestPick = chooseCode(
    labeledRequests.length > 0 ? labeledRequests : urlCodes.requestNumber ? [urlCodes.requestNumber] : [],
    columnValues.requestNumber,
    'Request Number',
    5,
  )
  if (!requestPick.ok) return requestPick
  const jobPick = chooseCode(labeledJobs, columnValues.jobNumber, 'Job Number', 3)
  if (!jobPick.ok) return jobPick
  if (requestPick.value.toLowerCase() === jobPick.value.toLowerCase()) {
    return {
      ok: false,
      error: 'Request Number and Job Number are the same value. Import stopped.',
    }
  }

  return {
    ok: true,
    requestNumber: requestPick.value,
    jobNumber: jobPick.value,
    rows,
  }
}

function collectRowColumns(
  table: HTMLTableElement,
  headerIndex: number,
  map: Map<HeaderField, number>,
): { requestNumber: string; jobNumber: string } | { error: string } {
  const requestValues = new Set<string>()
  const jobValues = new Set<string>()
  for (let index = headerIndex + 1; index < table.rows.length; index += 1) {
    const cells = table.rows[index].cells
    const itemType = cellText(cells, map.get('itemType'))
    const tagId = cellText(cells, map.get('tagId'))
    const samplesRaw = cellText(cells, map.get('samples'))
    if (!itemType && !tagId && !samplesRaw) continue
    const requestNumber = takeCode(cellText(cells, map.get('requestNumber')), 5)
    const jobNumber = takeCode(cellText(cells, map.get('jobNumber')), 3)
    if (requestNumber) requestValues.add(requestNumber)
    if (jobNumber) jobValues.add(jobNumber)
  }
  if (requestValues.size > 1) {
    return { error: 'The sampling table has more than one Request Number. Import stopped.' }
  }
  if (jobValues.size > 1) {
    return { error: 'The sampling table has more than one Job Number. Import stopped.' }
  }
  return {
    requestNumber: [...requestValues][0] || '',
    jobNumber: [...jobValues][0] || '',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = cleanSamplingText(value)
  if (text.length > max) return null
  return text
}

export function parseSamplingExtract(value: unknown): SamplingExtractResult {
  if (!isRecord(value) || value.ok !== true) {
    return { ok: false, error: 'Sampling details were missing or invalid. Import stopped.' }
  }
  const requestNumber = readString(value.requestNumber, 40)
  const jobNumber = readString(value.jobNumber, 40)
  if (!requestNumber || !isAcceptableSamplingCode(requestNumber, 5)) {
    return { ok: false, error: 'Request Number was not found on this page. Import stopped.' }
  }
  if (!jobNumber || !isAcceptableSamplingCode(jobNumber, 3)) {
    return { ok: false, error: 'Job Number was not found on this page. Import stopped.' }
  }
  if (requestNumber.toLowerCase() === jobNumber.toLowerCase()) {
    return { ok: false, error: 'Request Number and Job Number are the same value. Import stopped.' }
  }
  if (!Array.isArray(value.rows) || value.rows.length === 0 || value.rows.length > 100) {
    return { ok: false, error: 'Sampling rows were missing or invalid. Import stopped.' }
  }
  const rows: ManakSamplingRow[] = []
  for (const raw of value.rows) {
    if (!isRecord(raw)) return { ok: false, error: 'A sampling row was invalid. Import stopped.' }
    const rowKey = readString(raw.rowKey, 80)
    const rowNumber = readString(raw.rowNumber, 40)
    const itemType = readString(raw.itemType, 80)
    const materialType = readString(raw.materialType, 80)
    const samplingMethod = readString(raw.samplingMethod, 40)
    const tagId = readString(raw.tagId, 40)
    const samples = raw.samples === 'Yes' || raw.samples === 'No' ? raw.samples : null
    const weight = readString(raw.weight, 40)
    const quantity = readString(raw.quantity, 40)
    if (!rowKey || !rowNumber || !itemType || materialType == null || samplingMethod == null || tagId == null) {
      return { ok: false, error: 'A sampling row was incomplete. Import stopped.' }
    }
    if (!samples || weight == null || quantity == null) {
      return { ok: false, error: 'A sampling row was incomplete. Import stopped.' }
    }
    if (!/^[A-Za-z0-9:_./-]{1,80}$/.test(rowKey)) {
      return { ok: false, error: 'A sampling row identifier is not stable. Import stopped.' }
    }
    if (samples === 'Yes' && !tagId) {
      return { ok: false, error: `Item "${itemType}" is Samples Yes but Tag ID is missing. Import stopped.` }
    }
    if (tagId && !isAcceptableSamplingCode(tagId, 1)) {
      return { ok: false, error: `Tag ID "${tagId}" is not a usable identifier. Import stopped.` }
    }
    rows.push({
      rowKey,
      rowNumber,
      itemType,
      materialType,
      samplingMethod,
      tagId,
      samples,
      weight,
      quantity,
    })
  }
  if (new Set(rows.map((row) => row.rowKey)).size !== rows.length) {
    return { ok: false, error: 'Sampling row identifiers are not unique. Import stopped.' }
  }
  return { ok: true, requestNumber, jobNumber, rows }
}

function itemsMatch(manakItem: string, shrijaItem: string): boolean {
  const left = cleanSamplingText(manakItem)
  const right = cleanSamplingText(shrijaItem)
  if (!left || !right) return false
  if (matchItemMasterName(left, [right])) return true
  if (matchItemMasterName(right, [left])) return true
  return false
}

function metalFromMaterial(material: string): 'gold' | 'silver' | 'platinum' | '' {
  const text = material.toLowerCase()
  if (!text) return ''
  if (text.includes('silver')) return 'silver'
  if (text.includes('platinum')) return 'platinum'
  if (text.includes('gold')) return 'gold'
  return ''
}

function metalFromPurity(purity: string): 'gold' | 'silver' | 'platinum' | '' {
  const text = purity.toLowerCase()
  if (!text) return ''
  if (text.includes('silver') || text.includes('925')) return 'silver'
  if (text.includes('platinum')) return 'platinum'
  if (text.includes('gold') || text.includes('k') || /\d/.test(text)) return 'gold'
  return ''
}

function metalsAgree(material: string, purity: string): boolean | null {
  const left = metalFromMaterial(material)
  const right = metalFromPurity(purity)
  if (!left || !right) return null
  return left === right
}

function parseMeasure(raw: string): number | null {
  const text = cleanSamplingText(raw)
    .replace(/,/g, '')
    .replace(/\s*(grams?|gms?|g|mg|pcs|pc|pic|pieces?)$/i, '')
    .trim()
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

function measuresAgree(raw: string, actual: number, integer: boolean): boolean | null {
  const value = parseMeasure(raw)
  if (value == null) return null
  if (!(actual > 0)) return null
  if (integer && !Number.isInteger(value)) return null
  return Math.abs(value - actual) < 0.001
}

function methodsAgree(manakMethod: string, shrijaMethod: string): boolean | null {
  const left = cleanSamplingText(manakMethod).toLowerCase()
  const right = cleanSamplingText(shrijaMethod).toLowerCase()
  if (!left || !right) return null
  return left === right
}

function toCandidate(row: ShrijaSamplingRow): SamplingCandidate {
  return {
    id: row.id,
    requestNo: row.requestNo,
    item: row.item,
    purity: row.purity,
    samplingMethod: row.samplingMethod,
    pic: row.pic,
    weight: row.weight,
    jobCardNo: cleanSamplingText(row.jobCardNo),
    sampleTagId: cleanSamplingText(row.sampleTagId),
    date: row.date,
    shift: row.shift,
    partyName: row.partyName,
  }
}

function classifySelected(
  manak: ManakSamplingRow,
  row: ShrijaSamplingRow,
  jobNumber: string,
): Pick<
  SamplingProposal,
  | 'status'
  | 'message'
  | 'proposedTagId'
  | 'assignTag'
  | 'existingJobCardNo'
  | 'existingSampleTagId'
  | 'existingItem'
> {
  const existingJobCardNo = cleanSamplingText(row.jobCardNo)
  const existingSampleTagId = cleanSamplingText(row.sampleTagId)
  const existingItem = row.item
  if (manak.samples === 'No') {
    if (existingJobCardNo === jobNumber) {
      return {
        status: 'unchanged',
        message: 'Samples is No. Job Number already matches, so Sample Tag ID was left unchanged.',
        proposedTagId: '',
        assignTag: false,
        existingJobCardNo,
        existingSampleTagId,
        existingItem,
      }
    }
    if (existingJobCardNo) {
      return {
        status: 'conflict',
        message: `Samples is No. Existing Job Number ${existingJobCardNo} differs from ${jobNumber}.`,
        proposedTagId: '',
        assignTag: false,
        existingJobCardNo,
        existingSampleTagId,
        existingItem,
      }
    }
    return {
      status: 'job_only',
      message: 'Samples is No, so only Job Number will be filled. Sample Tag ID will not be set.',
      proposedTagId: '',
      assignTag: false,
      existingJobCardNo,
      existingSampleTagId,
      existingItem,
    }
  }

  const proposedTagId = cleanSamplingText(manak.tagId)
  const jobSame = existingJobCardNo === jobNumber
  const tagSame = existingSampleTagId === proposedTagId
  if (jobSame && tagSame) {
    return {
      status: 'unchanged',
      message: 'Job Number and Sample Tag ID already match this sampling row.',
      proposedTagId,
      assignTag: false,
      existingJobCardNo,
      existingSampleTagId,
      existingItem,
    }
  }
  if ((existingJobCardNo === '' || jobSame) && (existingSampleTagId === '' || tagSame)) {
    return {
      status: 'ready',
      message: 'Unique match. Empty Job Number or Sample Tag ID will be filled.',
      proposedTagId,
      assignTag: true,
      existingJobCardNo,
      existingSampleTagId,
      existingItem,
    }
  }
  const parts: string[] = []
  if (existingJobCardNo && !jobSame) parts.push(`Job Number ${existingJobCardNo} → ${jobNumber}`)
  if (existingSampleTagId && !tagSame) parts.push(`Sample Tag ID ${existingSampleTagId} → ${proposedTagId}`)
  return {
    status: 'conflict',
    message: `Existing value differs (${parts.join('; ')}). Confirm before overwrite.`,
    proposedTagId,
    assignTag: true,
    existingJobCardNo,
    existingSampleTagId,
    existingItem,
  }
}

export function matchSamplingImport(
  extractedInput: unknown,
  rows: readonly ShrijaSamplingRow[],
  requests: readonly { requestNo?: string }[],
  options?: {
    resolutions?: readonly { rowKey?: string; shrijaId?: string }[]
    overwriteRowKeys?: readonly string[]
  },
): SamplingMatchResult {
  const extracted = parseSamplingExtract(extractedInput)
  if (!extracted.ok) return { ok: false, error: extracted.error, code: 'INVALID_SOURCE' }

  const requestHits = requests.filter((request) => sameRequestNo(request.requestNo, extracted.requestNumber))
  if (requestHits.length > 1) {
    return {
      ok: false,
      error:
        'More than one Shrija request uses this Request Number. Import stopped instead of choosing one.',
      code: 'DUPLICATE_REQUEST',
    }
  }

  const pool = rows.filter((row) => sameRequestNo(row.requestNo, extracted.requestNumber))
  if (pool.length === 0) {
    return {
      ok: false,
      error:
        'No QM Request List row matches this Request Number in the current centre and working period.',
      code: 'NO_SHRIJA_ROWS',
    }
  }

  const resolutionMap = new Map<string, string>()
  for (const entry of options?.resolutions || []) {
    const rowKey = cleanSamplingText(entry?.rowKey)
    const shrijaId = cleanSamplingText(entry?.shrijaId)
    if (!rowKey || !shrijaId) continue
    if (resolutionMap.has(rowKey)) {
      return {
        ok: false,
        error: 'Each Manak row was confirmed more than once. Import stopped.',
        code: 'BAD_RESOLUTION',
      }
    }
    resolutionMap.set(rowKey, shrijaId)
  }
  const overwrite = new Set((options?.overwriteRowKeys || []).map((key) => cleanSamplingText(key)).filter(Boolean))

  const drafts: SamplingProposal[] = extracted.rows.map((manak) => {
    const candidates = pool.filter((row) => {
      if (!itemsMatch(manak.itemType, row.item)) return false
      if (metalsAgree(manak.materialType, row.purity) === false) return false
      if (measuresAgree(manak.weight, Number(row.weight) || 0, false) === false) return false
      if (measuresAgree(manak.quantity, Number(row.pic) || 0, true) === false) return false
      if (methodsAgree(manak.samplingMethod, row.samplingMethod) === false) return false
      return true
    })
    const candidateViews = candidates.map(toCandidate)
    const base = {
      rowKey: manak.rowKey,
      rowNumber: manak.rowNumber,
      itemType: manak.itemType,
      materialType: manak.materialType,
      samplingMethod: manak.samplingMethod,
      samples: manak.samples,
      tagId: manak.tagId,
      candidates: candidateViews,
      proposedJobNumber: extracted.jobNumber,
      willWrite: false,
    }
    if (candidates.length === 0) {
      return {
        ...base,
        status: 'unmatched' as const,
        message: `No QM row matches Item Type "${manak.itemType}" with the same material, weight, quantity, and sampling method.`,
        selectedId: null,
        proposedTagId: manak.samples === 'Yes' ? manak.tagId : '',
        assignTag: false,
        existingJobCardNo: '',
        existingSampleTagId: '',
        existingItem: '',
      }
    }

    let selected: ShrijaSamplingRow | null = null
    if (candidates.length === 1) {
      selected = candidates[0]
    } else {
      const wanted = resolutionMap.get(manak.rowKey)
      selected = wanted ? candidates.find((row) => row.id === wanted) || null : null
    }
    if (candidates.length > 1 && !selected) {
      const wanted = resolutionMap.get(manak.rowKey)
      return {
        ...base,
        status: 'ambiguous' as const,
        message: wanted
          ? 'The selected Shrija row is not a safe match for this Manak row.'
          : `Item Type "${manak.itemType}" matches ${candidates.length} QM rows. Choose the row before import.`,
        selectedId: null,
        proposedTagId: manak.samples === 'Yes' ? manak.tagId : '',
        assignTag: false,
        existingJobCardNo: '',
        existingSampleTagId: '',
        existingItem: '',
      }
    }
    if (!selected) {
      return {
        ...base,
        status: 'unmatched' as const,
        message: 'No QM row was selected.',
        selectedId: null,
        proposedTagId: '',
        assignTag: false,
        existingJobCardNo: '',
        existingSampleTagId: '',
        existingItem: '',
      }
    }
    const classified = classifySelected(manak, selected, extracted.jobNumber)
    return {
      ...base,
      ...classified,
      selectedId: selected.id,
    }
  })

  const selectedCounts = new Map<string, number>()
  for (const proposal of drafts) {
    if (!proposal.selectedId) continue
    selectedCounts.set(proposal.selectedId, (selectedCounts.get(proposal.selectedId) || 0) + 1)
  }
  for (const [selectedId, count] of selectedCounts) {
    if (count < 2) continue
    const claimants = drafts.filter((proposal) => proposal.selectedId === selectedId)
    const yesKeepers = claimants.filter((proposal) => proposal.samples === 'Yes')
    const keeper = yesKeepers.length === 1 ? yesKeepers[0] : null
    for (const proposal of claimants) {
      if (keeper && proposal.rowKey === keeper.rowKey) continue
      proposal.status = keeper ? 'unmatched' : 'ambiguous'
      proposal.willWrite = false
      proposal.assignTag = false
      proposal.selectedId = null
      proposal.message = keeper
        ? `Item Type "${proposal.itemType}" already matches the Samples Yes QM row. No extra QM row is available for this Manak row.`
        : 'Several Manak rows match the same QM row. Choose a one-to-one mapping.'
    }
  }

  const tagOwners = new Map<string, string[]>()
  for (const proposal of drafts) {
    if (!proposal.selectedId || !proposal.assignTag || !proposal.proposedTagId) continue
    const owners = tagOwners.get(proposal.proposedTagId) || []
    owners.push(proposal.rowKey)
    tagOwners.set(proposal.proposedTagId, owners)
  }
  for (const proposal of drafts) {
    if (!proposal.selectedId || !proposal.assignTag || !proposal.proposedTagId) continue
    const shared = (tagOwners.get(proposal.proposedTagId) || []).length > 1
    const taken = rows.some(
      (row) => row.id !== proposal.selectedId && cleanSamplingText(row.sampleTagId) === proposal.proposedTagId,
    )
    if (!shared && !taken) continue
    proposal.status = 'duplicate_tag'
    proposal.assignTag = false
    proposal.willWrite = false
    proposal.message = shared
      ? `Tag ID ${proposal.proposedTagId} is repeated on more than one Samples Yes row.`
      : `Tag ID ${proposal.proposedTagId} is already used on another QM row.`
  }

  for (const proposal of drafts) {
    if (proposal.status === 'ambiguous' || proposal.status === 'unmatched' || proposal.status === 'duplicate_tag') {
      proposal.willWrite = false
      continue
    }
    if (proposal.status === 'unchanged') {
      proposal.willWrite = false
      continue
    }
    if (proposal.status === 'conflict') {
      proposal.willWrite = overwrite.has(proposal.rowKey)
      if (!proposal.willWrite) {
        proposal.message = `${proposal.message} Overwrite was not confirmed.`
      }
      continue
    }
    proposal.willWrite = proposal.status === 'ready' || proposal.status === 'job_only'
  }

  return {
    ok: true,
    requestNumber: extracted.requestNumber,
    jobNumber: extracted.jobNumber,
    storedRequestNo: cleanSamplingText(requestHits[0]?.requestNo) || pool[0].requestNo,
    proposals: drafts,
  }
}
