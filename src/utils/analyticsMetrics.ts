/**
 * Analytics figures for the centre dashboard.
 *
 * Pieces, weight, rejects, and job cards come from the day sheet
 * (rough sheet lines). One request often has several lines, so request.pieces
 * is only a fallback when that request has no day-sheet line.
 * Hallmarked pieces and billed amount come from bills.
 * Cash, TDS, and outstanding follow the hallmark ledger (other-service
 * receipts are not hallmark money). A monthly bill is added only for
 * requests that have no per-request bill, so the same job is not counted twice.
 */
import { isOtherServiceFund } from '../data/otherServices'
import { calcPartyBalance, normPartyName } from '../../server/src/invoicePaymentStatus.ts'

export type AnalyticsShift = 'All' | 'Day' | 'Night'
export type AnalyticsPreset = 'today' | '7' | '15' | 'month' | 'year'

export type AnalyticsParty = {
  id: string
  name: string
  groupName?: string
}

export type AnalyticsRequest = {
  requestNo: string
  partyId: string
  partyName: string
  pieces: number
  weight: number
  date: string
  night?: string
  status: string
  jobCardNo?: string
}

export type AnalyticsRough = {
  id: string
  partyId: string
  partyName: string
  pic: number
  rejectPic?: number
  weight: number
  shift?: string
  date: string
  requestNo?: string
  jobCardNo?: string
  status?: string
}

export type AnalyticsInvoiceLine = {
  hm?: number
}

export type AnalyticsInvoice = {
  id: string
  invoiceNo: string
  partyName: string
  partyId?: string
  requestNo?: string
  total: number
  tax?: number
  amount?: number
  date: string
  invoiceDateTime?: string
  lines?: AnalyticsInvoiceLine[]
  status?: string
}

export type AnalyticsMonthlyLine = {
  requestNo: string
  articlesHm?: number
  amount?: number
}

export type AnalyticsMonthly = {
  id: string
  invoiceNo: string
  partyId?: string
  partyName: string
  date: string
  invoiceDateTime?: string
  requestNos?: string[]
  lines?: AnalyticsMonthlyLine[]
  amount?: number
  tax?: number
  total: number
}

export type AnalyticsFund = {
  date: string
  amount: number
  tdsAmount?: number
  partyId?: string
  partyName?: string
  source?: string
  voucherNo?: string
}

export type AnalyticsInput = {
  from: string
  to: string
  partyId: string
  shift: AnalyticsShift
  requests: AnalyticsRequest[]
  roughSheets: AnalyticsRough[]
  invoices: AnalyticsInvoice[]
  monthlyInvoices: AnalyticsMonthly[]
  funds: AnalyticsFund[]
  parties: AnalyticsParty[]
}

export type DayPoint = { date: string; label: string; value: number }

export type PartyActivity = {
  id: string
  name: string
  groupName: string
  pieces: number
  rejected: number
  hallmarked: number
  billed: number
}

export type GroupActivity = {
  name: string
  parties: number
  pieces: number
  hallmarked: number
  billed: number
}

export type AnalyticsSnapshot = {
  from: string
  to: string
  pieces: number
  dayPieces: number
  nightPieces: number
  unshiftedPieces: number
  rejected: number
  weight: number
  hallmarked: number
  jobCards: number
  requests: number
  openRequests: number
  bills: number
  billed: number
  received: number
  tds: number
  /** Bills minus hallmark receipts up to `to`. Negative means advance. */
  outstanding: number
  chart: DayPoint[]
  chartUnit: 'day' | 'month'
  piecesByDay: Record<string, number>
  parties: PartyActivity[]
  groups: GroupActivity[]
}

const OPEN_STATUS = new Set(['Pending', 'In Progress', 'Assayed'])

function num(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function money(value: number) {
  return Number((num(value) || 0).toFixed(2))
}

/** Date-only prefix. Invalid text is ignored so it cannot become "today". */
export function businessYmd(raw: string | undefined | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw || '').trim())
  return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
}

export function localTodayIso(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addIsoDays(iso: string, days: number): string {
  const [y, m, d] = businessYmd(iso).split('-').map(Number)
  if (!y || !m || !d) return ''
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return localTodayIso(dt)
}

export function rangeForPreset(
  preset: AnalyticsPreset,
  today: string,
  yearStart: string,
  yearEnd: string,
): { from: string; to: string } {
  const day = businessYmd(today) || localTodayIso()
  if (preset === 'today') return { from: day, to: day }
  if (preset === '7') return { from: addIsoDays(day, -6), to: day }
  if (preset === '15') return { from: addIsoDays(day, -14), to: day }
  if (preset === 'month') return { from: `${day.slice(0, 7)}-01`, to: day }
  const start = businessYmd(yearStart) || day
  const end = businessYmd(yearEnd) || day
  if (day < start) return { from: start, to: start }
  if (day > end) return { from: start, to: end }
  return { from: start, to: day }
}

export function orderedRange(from: string, to: string): { from: string; to: string } {
  const a = businessYmd(from)
  const b = businessYmd(to)
  if (!a || !b) return { from: a, to: b }
  return a <= b ? { from: a, to: b } : { from: b, to: a }
}

/** Day / Night as stored on the day sheet or request. Remarks are not a shift. */
export function normalizeShift(raw: string | undefined | null): 'Day' | 'Night' | '' {
  const value = String(raw || '').trim().toLowerCase()
  if (value === 'night' || value === 'n' || value === 'night shift') return 'Night'
  if (value === 'day' || value === 'd' || value === 'day shift') return 'Day'
  return ''
}

function jobKey(raw: string | undefined): string {
  const value = String(raw || '').trim()
  if (!value) return ''
  const lot = /^\d+\s*[_\-/]\s*(.+)$/.exec(value)
  return (lot ? lot[1] : value).trim().toLowerCase()
}

function isCreditNote(invoiceNo: string | undefined) {
  return /^CN(?:\b|[-/])/i.test(String(invoiceNo || '').trim())
}

type PieceLine = {
  date: string
  partyId: string
  partyName: string
  requestNo: string
  jobCardNo: string
  shift: 'Day' | 'Night' | ''
  pic: number
  reject: number
  weight: number
  requestStatus: string
}

function buildPieceLines(requests: AnalyticsRequest[], roughSheets: AnalyticsRough[]): PieceLine[] {
  const active = roughSheets.filter((row) => row.status !== 'Rejected')
  const byRequest = new Map<string, AnalyticsRough[]>()
  const orphans: AnalyticsRough[] = []
  const rejectedRequestNos = new Set<string>()

  for (const row of roughSheets) {
    const requestNo = String(row.requestNo || '').trim()
    if (row.status === 'Rejected' && requestNo) rejectedRequestNos.add(requestNo)
  }
  for (const row of active) {
    const requestNo = String(row.requestNo || '').trim()
    if (!requestNo) {
      orphans.push(row)
      continue
    }
    const list = byRequest.get(requestNo) || []
    list.push(row)
    byRequest.set(requestNo, list)
  }

  const usedOrphans = new Set<string>()
  const seenRequests = new Set<string>()
  const lines: PieceLine[] = []

  const pushRough = (row: AnalyticsRough, request: AnalyticsRequest | undefined, requestNo: string) => {
    const date = businessYmd(row.date) || businessYmd(request?.date)
    if (!date) return
    lines.push({
      date,
      partyId: row.partyId || request?.partyId || '',
      partyName: row.partyName || request?.partyName || '',
      requestNo,
      jobCardNo: String(row.jobCardNo || request?.jobCardNo || '').trim(),
      shift: normalizeShift(row.shift) || normalizeShift(request?.night),
      pic: num(row.pic),
      reject: Math.max(0, num(row.rejectPic)),
      weight: num(row.weight),
      requestStatus: request?.status || '',
    })
  }

  for (const request of requests) {
    const requestNo = String(request.requestNo || '').trim()
    if (requestNo) seenRequests.add(requestNo)
    const numbered = requestNo ? byRequest.get(requestNo) || [] : []
    const requestDay = businessYmd(request.date)
    const legacy = orphans.filter((row) => {
      if (usedOrphans.has(row.id)) return false
      return row.partyId === request.partyId && businessYmd(row.date) === requestDay && requestDay !== ''
    })
    for (const row of legacy) usedOrphans.add(row.id)
    const related = [...numbered, ...legacy]
    if (related.length > 0) {
      for (const row of related) pushRough(row, request, requestNo)
      continue
    }
    if (requestNo && rejectedRequestNos.has(requestNo)) continue
    const date = requestDay
    if (!date) continue
    lines.push({
      date,
      partyId: request.partyId,
      partyName: request.partyName,
      requestNo,
      jobCardNo: String(request.jobCardNo || '').trim(),
      shift: normalizeShift(request.night),
      pic: num(request.pieces),
      reject: 0,
      weight: num(request.weight),
      requestStatus: request.status,
    })
  }

  for (const [requestNo, rows] of byRequest) {
    if (seenRequests.has(requestNo)) continue
    for (const row of rows) pushRough(row, undefined, requestNo)
  }
  for (const row of orphans) {
    if (usedOrphans.has(row.id)) continue
    pushRough(row, undefined, '')
  }
  return lines
}

function inDate(date: string, from: string, to: string) {
  if (!date || !from || !to) return false
  return date >= from && date <= to
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  let cursor = from
  let guard = 0
  while (cursor && cursor <= to && guard < 4000) {
    days.push(cursor)
    cursor = addIsoDays(cursor, 1)
    guard += 1
  }
  return days
}

function dayLabel(iso: string, spansMonth: boolean) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (!spansMonth) return String(d)
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function monthLabel(ym: string, spansYear: boolean) {
  const [y, m] = ym.split('-').map(Number)
  const dt = new Date(y, m - 1, 1)
  return dt.toLocaleDateString('en-IN', spansYear ? { month: 'short', year: '2-digit' } : { month: 'short' })
}

function chartFor(lines: PieceLine[], from: string, to: string): { chart: DayPoint[]; chartUnit: 'day' | 'month' } {
  const days = eachDay(from, to)
  if (days.length === 0) return { chart: [], chartUnit: 'day' }
  const byDay = new Map<string, number>()
  for (const line of lines) byDay.set(line.date, (byDay.get(line.date) || 0) + line.pic)
  if (days.length <= 42) {
    const spansMonth = from.slice(0, 7) !== to.slice(0, 7)
    return {
      chartUnit: 'day',
      chart: days.map((date) => ({
        date,
        label: dayLabel(date, spansMonth),
        value: byDay.get(date) || 0,
      })),
    }
  }
  const months: string[] = []
  let cursor = from.slice(0, 7)
  const endMonth = to.slice(0, 7)
  let guard = 0
  while (cursor <= endMonth && guard < 240) {
    months.push(cursor)
    const [y, m] = cursor.split('-').map(Number)
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    cursor = next
    guard += 1
  }
  const spansYear = months[0]?.slice(0, 4) !== months[months.length - 1]?.slice(0, 4)
  return {
    chartUnit: 'month',
    chart: months.map((ym) => ({
      date: ym,
      label: monthLabel(ym, spansYear),
      value: lines.reduce((sum, line) => (line.date.slice(0, 7) === ym ? sum + line.pic : sum), 0),
    })),
  }
}

function partyOf(parties: AnalyticsParty[], partyId: string): AnalyticsParty | null {
  if (!partyId) return null
  return parties.find((party) => party.id === partyId) || null
}

function matchesParty(
  party: AnalyticsParty | null,
  row: { partyId?: string; partyName?: string; source?: string },
) {
  if (!party) return true
  if (row.partyId && row.partyId === party.id) return true
  const name = normPartyName(party.name)
  if (!name) return false
  return normPartyName(row.partyName) === name || normPartyName(row.source) === name
}

function invoiceDate(invoice: { date?: string; invoiceDateTime?: string }) {
  return businessYmd(invoice.date) || businessYmd(invoice.invoiceDateTime)
}

function coveredRequestNos(invoices: AnalyticsInvoice[]) {
  const covered = new Set<string>()
  for (const invoice of invoices) {
    if (isCreditNote(invoice.invoiceNo)) continue
    const requestNo = String(invoice.requestNo || '').trim()
    if (requestNo) covered.add(requestNo)
  }
  return covered
}

function monthlyExtra(invoice: AnalyticsMonthly, covered: Set<string>) {
  const lines = invoice.lines || []
  const extraLines = lines.filter((line) => !covered.has(String(line.requestNo || '').trim()))
  if (lines.length > 0) {
    if (extraLines.length === 0) return null
    const hm = extraLines.reduce((sum, line) => sum + Math.max(0, num(line.articlesHm)), 0)
    if (extraLines.length === lines.length) return { total: money(invoice.total), hm }
    const extraTaxable = extraLines.reduce((sum, line) => sum + num(line.amount), 0)
    const base = num(invoice.amount)
    const ratio = base > 0 ? extraTaxable / base : extraLines.length / lines.length
    return { total: money(extraTaxable + num(invoice.tax) * ratio), hm }
  }
  const requestNos = (invoice.requestNos || []).map((no) => String(no || '').trim()).filter(Boolean)
  if (requestNos.length === 0) return { total: money(invoice.total), hm: 0 }
  if (requestNos.some((no) => covered.has(no))) return null
  return { total: money(invoice.total), hm: 0 }
}

function hallmarkedOnInvoice(
  invoice: AnalyticsInvoice,
  roughByRequest: Map<string, AnalyticsRough[]>,
  requestByNo: Map<string, AnalyticsRequest>,
) {
  if (invoice.lines && invoice.lines.length > 0) {
    return invoice.lines.reduce((sum, line) => sum + Math.max(0, num(line.hm)), 0)
  }
  const requestNo = String(invoice.requestNo || '').trim()
  const rough = roughByRequest.get(requestNo) || []
  const active = rough.filter((row) => row.status !== 'Rejected')
  if (active.length > 0) {
    return active.reduce((sum, row) => sum + Math.max(0, num(row.pic) - num(row.rejectPic)), 0)
  }
  const request = requestByNo.get(requestNo)
  return request ? Math.max(0, num(request.pieces)) : 0
}

function paymentInvoices(rows: Array<{ id: string; partyName: string; date: string; invoiceNo: string; total: number }>) {
  return rows.map((row) => ({
    id: row.id,
    partyName: row.partyName,
    date: row.date,
    invoiceNo: row.invoiceNo,
    total: money(row.total),
    status: 'Unpaid' as const,
  }))
}

function outstandingTill(
  invoices: AnalyticsInvoice[],
  monthly: AnalyticsMonthly[],
  funds: AnalyticsFund[],
  party: AnalyticsParty | null,
  end: string,
) {
  const covered = coveredRequestNos(invoices)
  const billRows: Array<{ id: string; partyName: string; date: string; invoiceNo: string; total: number }> = []
  for (const invoice of invoices) {
    if (isCreditNote(invoice.invoiceNo)) continue
    const date = invoiceDate(invoice)
    if (!date || date > end) continue
    if (!matchesParty(party, invoice)) continue
    billRows.push({
      id: invoice.id,
      partyName: invoice.partyName,
      date,
      invoiceNo: invoice.invoiceNo,
      total: num(invoice.total),
    })
  }
  for (const invoice of monthly) {
    const date = invoiceDate(invoice)
    if (!date || date > end) continue
    if (!matchesParty(party, invoice)) continue
    const extra = monthlyExtra(invoice, covered)
    if (!extra || extra.total === 0) continue
    billRows.push({
      id: `monthly-${invoice.id}`,
      partyName: invoice.partyName,
      date,
      invoiceNo: invoice.invoiceNo,
      total: extra.total,
    })
  }

  const fundRows = funds
    .filter((fund) => !isOtherServiceFund(fund))
    .filter((fund) => {
      const date = businessYmd(fund.date)
      return date && date <= end && matchesParty(party, fund)
    })
    .map((fund) => ({
      amount: num(fund.amount),
      tdsAmount: num(fund.tdsAmount),
      partyName: String(fund.partyName || fund.source || '').trim(),
      source: fund.source,
      voucherNo: fund.voucherNo,
    }))

  const names = new Set<string>()
  for (const row of billRows) {
    const name = normPartyName(row.partyName)
    if (name) names.add(name)
  }
  for (const fund of fundRows) {
    const name = normPartyName(fund.partyName)
    if (name) names.add(name)
  }

  let total = 0
  const bills = paymentInvoices(billRows)
  for (const name of names) {
    const sample =
      billRows.find((row) => normPartyName(row.partyName) === name)?.partyName ||
      fundRows.find((fund) => normPartyName(fund.partyName) === name)?.partyName ||
      name
    total += calcPartyBalance(bills, fundRows, sample)
  }
  return money(total)
}

/** Y position in the performance chart. 0 sits on the bottom, max on the top. */
export function chartValueY(value: number, max: number, top: number, innerH: number) {
  const safe = max > 0 ? max : 1
  const clamped = Math.min(safe, Math.max(0, value))
  return top + innerH - (clamped / safe) * innerH
}

/** Axis tick. t=0 is the bottom label (0), t=1 is the top label (max). */
export function chartTickValue(max: number, t: number) {
  const safe = max > 0 ? max : 1
  return safe * t
}

export function buildAnalytics(input: AnalyticsInput): AnalyticsSnapshot {
  const range = orderedRange(input.from, input.to)
  const from = range.from
  const to = range.to
  const party = partyOf(input.parties, input.partyId)
  const partyMissing = Boolean(input.partyId) && !party
  const lines = partyMissing ? [] : buildPieceLines(input.requests, input.roughSheets)
  const forParty = lines.filter((line) => matchesParty(party, line))
  const inRange = forParty.filter((line) => inDate(line.date, from, to))
  const unshiftedPieces = inRange
    .filter((line) => line.shift === '')
    .reduce((sum, line) => sum + line.pic, 0)
  const filtered =
    input.shift === 'All' ? inRange : inRange.filter((line) => line.shift === input.shift)

  const pieces = filtered.reduce((sum, line) => sum + line.pic, 0)
  const rejected = filtered.reduce((sum, line) => sum + line.reject, 0)
  const weight = Number(filtered.reduce((sum, line) => sum + line.weight, 0).toFixed(3))
  const dayPieces = filtered.filter((line) => line.shift === 'Day').reduce((sum, line) => sum + line.pic, 0)
  const nightPieces = filtered.filter((line) => line.shift === 'Night').reduce((sum, line) => sum + line.pic, 0)

  const jobCards = new Set(filtered.map((line) => jobKey(line.jobCardNo)).filter(Boolean)).size
  const requestNos = new Set(filtered.map((line) => line.requestNo).filter(Boolean))
  const openRequests = new Set(
    filtered
      .filter((line) => line.requestNo && OPEN_STATUS.has(line.requestStatus))
      .map((line) => line.requestNo),
  ).size

  const requestByNo = new Map<string, AnalyticsRequest>()
  for (const request of input.requests) {
    const requestNo = String(request.requestNo || '').trim()
    if (requestNo && !requestByNo.has(requestNo)) requestByNo.set(requestNo, request)
  }
  const roughByRequest = new Map<string, AnalyticsRough[]>()
  for (const row of input.roughSheets) {
    const requestNo = String(row.requestNo || '').trim()
    if (!requestNo) continue
    const list = roughByRequest.get(requestNo) || []
    list.push(row)
    roughByRequest.set(requestNo, list)
  }

  const covered = coveredRequestNos(input.invoices)
  let hallmarked = 0
  let billed = 0
  let bills = 0
  const hallmarkedByParty = new Map<string, number>()
  const billedByParty = new Map<string, number>()

  const addPartyMoney = (name: string, hm: number, amount: number) => {
    const key = normPartyName(name)
    if (!key) return
    hallmarkedByParty.set(key, (hallmarkedByParty.get(key) || 0) + hm)
    billedByParty.set(key, money((billedByParty.get(key) || 0) + amount))
  }

  if (!partyMissing && from && to) {
    for (const invoice of input.invoices) {
      if (isCreditNote(invoice.invoiceNo)) continue
      const date = invoiceDate(invoice)
      if (!inDate(date, from, to) || !matchesParty(party, invoice)) continue
      const hm = hallmarkedOnInvoice(invoice, roughByRequest, requestByNo)
      const total = money(invoice.total)
      hallmarked += hm
      billed = money(billed + total)
      bills += 1
      addPartyMoney(invoice.partyName, hm, total)
    }
    for (const invoice of input.monthlyInvoices) {
      const date = invoiceDate(invoice)
      if (!inDate(date, from, to) || !matchesParty(party, invoice)) continue
      const extra = monthlyExtra(invoice, covered)
      if (!extra) continue
      hallmarked += extra.hm
      billed = money(billed + extra.total)
      bills += 1
      addPartyMoney(invoice.partyName, extra.hm, extra.total)
    }
  }

  let received = 0
  let tds = 0
  if (!partyMissing && from && to) {
    for (const fund of input.funds) {
      if (isOtherServiceFund(fund)) continue
      const date = businessYmd(fund.date)
      if (!inDate(date, from, to) || !matchesParty(party, fund)) continue
      received = money(received + num(fund.amount))
      tds = money(tds + Math.max(0, num(fund.tdsAmount)))
    }
  }

  const outstanding =
    partyMissing || !to
      ? 0
      : outstandingTill(input.invoices, input.monthlyInvoices, input.funds, party, to)

  const piecesByDay: Record<string, number> = {}
  for (const line of forParty) {
    if (input.shift !== 'All' && line.shift !== input.shift) continue
    piecesByDay[line.date] = (piecesByDay[line.date] || 0) + line.pic
  }

  const { chart, chartUnit } = from && to ? chartFor(filtered, from, to) : { chart: [], chartUnit: 'day' as const }

  const partyRows = new Map<string, PartyActivity>()
  const ensureParty = (id: string, name: string) => {
    const known =
      input.parties.find((item) => id && item.id === id) ||
      input.parties.find((item) => name && normPartyName(item.name) === normPartyName(name))
    const key = known?.id || id || normPartyName(name)
    if (!key) return null
    const existing =
      partyRows.get(key) ||
      (name
        ? [...partyRows.values()].find((row) => normPartyName(row.name) === normPartyName(name))
        : undefined)
    if (existing) return existing
    const row: PartyActivity = {
      id: known?.id || id || key,
      name: known?.name || name || 'Unknown party',
      groupName: known?.groupName || '',
      pieces: 0,
      rejected: 0,
      hallmarked: 0,
      billed: 0,
    }
    partyRows.set(key, row)
    return row
  }

  for (const line of filtered) {
    const row = ensureParty(line.partyId, line.partyName)
    if (!row) continue
    row.pieces += line.pic
    row.rejected += line.reject
  }
  for (const [nameKey, hm] of hallmarkedByParty) {
    const sample = input.parties.find((item) => normPartyName(item.name) === nameKey)
    const row = ensureParty(sample?.id || '', sample?.name || nameKey)
    if (row) row.hallmarked += hm
  }
  for (const [nameKey, amount] of billedByParty) {
    const sample = input.parties.find((item) => normPartyName(item.name) === nameKey)
    const row = ensureParty(sample?.id || '', sample?.name || nameKey)
    if (row) row.billed = money(row.billed + amount)
  }

  const parties = [...partyRows.values()]
    .filter((row) => row.pieces || row.rejected || row.hallmarked || row.billed)
    .sort((a, b) => b.pieces - a.pieces || a.name.localeCompare(b.name))

  const groupMap = new Map<string, GroupActivity>()
  for (const item of input.parties) {
    const name = String(item.groupName || '').trim()
    if (!name) continue
    if (party && item.id !== party.id) continue
    const row = groupMap.get(name) || { name, parties: 0, pieces: 0, hallmarked: 0, billed: 0 }
    row.parties += 1
    groupMap.set(name, row)
  }
  for (const row of parties) {
    if (!row.groupName) continue
    const group = groupMap.get(row.groupName)
    if (!group) continue
    group.pieces += row.pieces
    group.hallmarked += row.hallmarked
    group.billed = money(group.billed + row.billed)
  }
  const groups = [...groupMap.values()].sort((a, b) => b.pieces - a.pieces || a.name.localeCompare(b.name))

  return {
    from,
    to,
    pieces,
    dayPieces,
    nightPieces,
    unshiftedPieces,
    rejected,
    weight,
    hallmarked,
    jobCards,
    requests: requestNos.size,
    openRequests,
    bills,
    billed,
    received,
    tds,
    outstanding,
    chart,
    chartUnit,
    piecesByDay,
    parties,
    groups,
  }
}
