/**
 * Read-only mapping of existing request / assay / billing / payment records
 * onto the Dashboard Live Job Tracking timeline.
 *
 * Does not mutate store data or invent workflow statuses.
 */
import { matchesRequestNo, normalizeRequestNo } from '../data/requestBillingDeletion'
import type {
  FireAssay,
  HallmarkRequest,
  Invoice,
  MonthlyInvoice,
  PendingRoughRequest,
  RoughSheetEntry,
} from '../data/store'

export const TRACKING_STAGE_IDS = [
  'received',
  'saved',
  'assay',
  'billing',
  'payment',
  'delivery',
] as const

export type TrackingStageId = (typeof TRACKING_STAGE_IDS)[number]

export type TrackingStageState = 'completed' | 'current' | 'pending'

export type TrackingStageDef = {
  id: TrackingStageId
  label: string
}

export const TRACKING_STAGES: TrackingStageDef[] = [
  { id: 'received', label: 'Request Received' },
  { id: 'saved', label: 'Data Saved' },
  { id: 'assay', label: 'Fire Assay Completed' },
  { id: 'billing', label: 'Billing' },
  { id: 'payment', label: 'Payment' },
  { id: 'delivery', label: 'Delivery' },
]

export type JobTrackingSnapshot = {
  requests: HallmarkRequest[]
  roughSheets: RoughSheetEntry[]
  pendingRough: PendingRoughRequest[]
  fireAssays: FireAssay[]
  invoices: Invoice[]
  monthlyInvoices: MonthlyInvoice[]
}

export type TrackedStage = {
  id: TrackingStageId
  label: string
  state: TrackingStageState
  timestamp: string | null
  timestampLabel: string
  pendingLabel: string | null
}

export type JobTrackView = {
  requestId: string
  requestNo: string
  /** Existing HallmarkRequest.status — not a parallel status system. */
  status: HallmarkRequest['status']
  currentStageId: TrackingStageId
  currentStageLabel: string
  requestDate: string | null
  lastUpdated: string | null
  lastUpdatedLabel: string
  partyName: string
  jobCardNo: string
  source: HallmarkRequest['source'] | ''
  analyst: string
  progressPercent: number
  completedCount: number
  stages: TrackedStage[]
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const HAS_CLOCK = /T\d{2}:\d{2}|\s\d{2}:\d{2}/

const ASSAY_DONE_STATUSES: HallmarkRequest['status'][] = [
  'Assayed',
  'Hallmarked',
  'Billed',
  'Delivered',
]
const BILLED_STATUSES: HallmarkRequest['status'][] = ['Billed', 'Delivered']

export function parseTrackingInstant(raw?: string | null): { ms: number; hasTime: boolean } | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const dateOnly = DATE_ONLY.exec(s)
  if (dateOnly) {
    const y = Number(dateOnly[1])
    const m = Number(dateOnly[2])
    const d = Number(dateOnly[3])
    const dt = new Date(y, m - 1, d)
    if (Number.isNaN(dt.getTime())) return null
    return { ms: dt.getTime(), hasTime: false }
  }
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return null
  return { ms: dt.getTime(), hasTime: HAS_CLOCK.test(s) }
}

function formatDateEn(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTimeEn(d: Date) {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function isSameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Display a real timestamp. Never invents a clock time for date-only values. */
export function formatTrackingInstant(raw?: string | null): string {
  const parsed = parseTrackingInstant(raw)
  if (!parsed) return 'Not available'
  const d = new Date(parsed.ms)
  if (!parsed.hasTime) return formatDateEn(d)
  return `${formatDateEn(d)} • ${formatTimeEn(d)}`
}

export function formatTrackingUpdated(raw?: string | null, now = new Date()): string {
  const parsed = parseTrackingInstant(raw)
  if (!parsed) return 'Not available'
  const d = new Date(parsed.ms)
  if (isSameLocalDay(d, now)) {
    return parsed.hasTime ? `Today ${formatTimeEn(d)}` : 'Today'
  }
  return formatTrackingInstant(raw)
}

function latestRaw(values: Array<string | null | undefined>): string | null {
  let best: string | null = null
  let bestMs = -Infinity
  for (const raw of values) {
    const parsed = parseTrackingInstant(raw)
    if (!parsed) continue
    if (parsed.ms >= bestMs) {
      bestMs = parsed.ms
      best = String(raw).trim()
    }
  }
  return best
}

function related<T extends { requestNo?: string }>(rows: T[], requestNo: string): T[] {
  return rows.filter((row) => matchesRequestNo(row.requestNo, requestNo))
}

function invoicePaid(inv: Invoice | undefined) {
  return inv?.status === 'Paid'
}

export function findRequestByNumber(
  requests: HallmarkRequest[],
  query: string,
): HallmarkRequest | null {
  const q = normalizeRequestNo(query)
  if (!q) return null
  const exact = requests.find((r) => matchesRequestNo(r.requestNo, q))
  if (exact) return exact
  const unique = requests.filter((r) => normalizeRequestNo(r.requestNo).endsWith(q))
  return unique.length === 1 ? unique[0] : null
}

export function listTrackedJobs(snapshot: JobTrackingSnapshot, limit = 8): HallmarkRequest[] {
  const active: HallmarkRequest[] = []
  const done: HallmarkRequest[] = []
  for (const req of snapshot.requests) {
    if (req.status === 'Delivered') done.push(req)
    else active.push(req)
  }
  const byDate = (a: HallmarkRequest, b: HallmarkRequest) =>
    String(b.date || '').localeCompare(String(a.date || ''))
  active.sort(byDate)
  done.sort(byDate)
  return [...active, ...done].slice(0, Math.max(0, limit))
}

function dataSaved(
  req: HallmarkRequest,
  rough: RoughSheetEntry[],
  pending: PendingRoughRequest[],
) {
  if (req.status !== 'Pending') return true
  if (rough.length > 0) return true
  if (pending.some((row) => row.status === 'Saved' || Boolean(row.jobCardNo))) return true
  if (rough.some((row) => row.jobCardSaved || Boolean(row.jobCardNo))) return true
  return false
}

function assayCompleted(req: HallmarkRequest, assays: FireAssay[]) {
  if (ASSAY_DONE_STATUSES.includes(req.status)) return true
  return assays.some((a) => a.status === 'Completed')
}

function billingCompleted(
  req: HallmarkRequest,
  invoices: Invoice[],
  monthly: MonthlyInvoice[],
) {
  if (BILLED_STATUSES.includes(req.status)) return true
  if (invoices.length > 0) return true
  return monthly.some((inv) =>
    (inv.requestNos || []).some((no) => matchesRequestNo(no, req.requestNo)),
  )
}

function coveringMonthly(req: HallmarkRequest, monthly: MonthlyInvoice[]) {
  return monthly.filter((inv) =>
    (inv.requestNos || []).some((no) => matchesRequestNo(no, req.requestNo)),
  )
}

function paymentCompleted(
  req: HallmarkRequest,
  invoices: Invoice[],
  monthly: MonthlyInvoice[],
) {
  if (req.status === 'Delivered') return true
  if (invoices.length > 0) return invoices.every((inv) => invoicePaid(inv))
  const cover = coveringMonthly(req, monthly)
  if (cover.length > 0) return cover.every((inv) => inv.status === 'Paid')
  return false
}

export function progressFromCompleted(completedCount: number, stageCount = TRACKING_STAGES.length) {
  if (completedCount <= 0) return 0
  if (completedCount >= stageCount) return 100
  return Math.min(completedCount * 20, 80)
}

function pendingCopy(
  state: TrackingStageState,
  id: TrackingStageId,
  currentId: TrackingStageId,
): string | null {
  if (state === 'completed') return null
  if (state === 'current') return 'PENDING'
  if (id === 'delivery' && currentId === 'payment') return 'WAITING FOR PAYMENT'
  if (id === 'payment' && currentId === 'billing') return 'WAITING FOR BILLING'
  if (id === 'billing' && currentId === 'assay') return 'WAITING FOR FIRE ASSAY'
  if (id === 'assay' && currentId === 'saved') return 'WAITING FOR DATA SAVED'
  if (id === 'saved' && currentId === 'received') return 'WAITING FOR RECEIPT'
  return 'PENDING'
}

export function buildJobTrack(req: HallmarkRequest, snapshot: JobTrackingSnapshot): JobTrackView {
  const rough = related(snapshot.roughSheets, req.requestNo)
  const pending = related(snapshot.pendingRough, req.requestNo)
  const assays = related(snapshot.fireAssays, req.requestNo)
  const invoices = related(snapshot.invoices, req.requestNo)
  const monthly = coveringMonthly(req, snapshot.monthlyInvoices)

  const delivered = req.status === 'Delivered'
  const billed = billingCompleted(req, invoices, monthly) || delivered
  const paid = paymentCompleted(req, invoices, monthly) || delivered
  const assayDone = assayCompleted(req, assays) || billed
  const saved = dataSaved(req, rough, pending) || assayDone

  const completedFlags: Record<TrackingStageId, boolean> = {
    received: true,
    saved,
    assay: assayDone,
    billing: billed,
    payment: paid,
    delivery: delivered,
  }

  let currentIndex = TRACKING_STAGE_IDS.findIndex((id) => !completedFlags[id])
  const allDone = currentIndex < 0
  if (allDone) currentIndex = TRACKING_STAGE_IDS.length - 1

  const currentId = TRACKING_STAGE_IDS[currentIndex]

  const receivedAt = req.date || null
  const savedAt = latestRaw([
    ...pending.filter((p) => p.status === 'Saved').map((p) => p.date),
    ...rough.map((r) => r.date),
  ])
  const assayAt = latestRaw(assays.filter((a) => a.status === 'Completed').map((a) => a.date))
  const billingAt = latestRaw([
    ...invoices.map((inv) => inv.invoiceDateTime || inv.date),
    ...monthly.map((inv) => inv.invoiceDateTime || inv.date),
  ])
  const paymentAt = latestRaw([
    ...invoices.filter((inv) => invoicePaid(inv)).map((inv) => inv.updatedAt || inv.invoiceDateTime || inv.date),
    ...monthly.filter((inv) => inv.status === 'Paid').map((inv) => inv.updatedAt || inv.invoiceDateTime || inv.date),
  ])
  const deliveryAt = null

  const stamps: Record<TrackingStageId, string | null> = {
    received: receivedAt,
    saved: saved ? savedAt : null,
    assay: assayDone ? assayAt : null,
    billing: billed ? billingAt : null,
    payment: paid ? paymentAt : null,
    delivery: delivered ? deliveryAt : null,
  }

  const completedCount = TRACKING_STAGE_IDS.filter((id) => completedFlags[id]).length
  const stages: TrackedStage[] = TRACKING_STAGES.map((def, index) => {
    const done = completedFlags[def.id]
    const state: TrackingStageState = done
      ? 'completed'
      : index === currentIndex
        ? 'current'
        : 'pending'
    const timestamp = done ? stamps[def.id] : null
    return {
      id: def.id,
      label: def.label,
      state,
      timestamp,
      timestampLabel: done
        ? timestamp
          ? formatTrackingInstant(timestamp)
          : 'Not available'
        : 'Pending',
      pendingLabel: pendingCopy(state, def.id, currentId),
    }
  })

  const lastUpdated = latestRaw([
    req.date,
    req.sentToMainAt,
    req.returnedToOscAt,
    savedAt,
    assayAt,
    billingAt,
    paymentAt,
    ...assays.map((a) => a.date),
    ...invoices.map((inv) => inv.updatedAt || inv.invoiceDateTime || inv.date),
  ])

  const jobCardNo =
    rough.find((r) => r.jobCardNo)?.jobCardNo ||
    pending.find((p) => p.jobCardNo)?.jobCardNo ||
    req.jobCardNo ||
    ''

  const analyst = assays.find((a) => a.analyst)?.analyst || ''

  return {
    requestId: req.id,
    requestNo: req.requestNo,
    status: req.status,
    currentStageId: currentId,
    currentStageLabel: TRACKING_STAGES[currentIndex].label,
    requestDate: receivedAt,
    lastUpdated,
    lastUpdatedLabel: formatTrackingUpdated(lastUpdated),
    partyName: req.partyName || '',
    jobCardNo,
    source: req.source || '',
    analyst,
    progressPercent: progressFromCompleted(completedCount),
    completedCount,
    stages,
  }
}

export function buildJobTracks(snapshot: JobTrackingSnapshot, limit = 8): JobTrackView[] {
  return listTrackedJobs(snapshot, limit).map((req) => buildJobTrack(req, snapshot))
}
