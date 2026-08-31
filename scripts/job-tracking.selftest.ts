/**
 * Live Job Tracking — maps existing request/assay/billing records
 * onto the dashboard timeline. Does not invent statuses or timestamps.
 * Run: npx --yes tsx scripts/job-tracking.selftest.ts
 */
import type {
  FireAssay,
  HallmarkRequest,
  Invoice,
  MonthlyInvoice,
  PendingRoughRequest,
  RoughSheetEntry,
} from '../src/data/store.ts'
import {
  buildJobTrack,
  findRequestByNumber,
  formatTrackingInstant,
  formatTrackingUpdated,
  listTrackedJobs,
  progressFromCompleted,
  type JobTrackingSnapshot,
} from '../src/utils/jobTracking.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`[job-tracking] ${msg}`)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(
      `[job-tracking] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    )
  }
}

function req(
  partial: Partial<HallmarkRequest> & Pick<HallmarkRequest, 'id' | 'requestNo' | 'status'>,
): HallmarkRequest {
  return {
    partyId: 'p1',
    partyName: 'Rajesh Jewellers',
    categoryId: 'c1',
    categoryName: '22K Jewellery',
    pieces: 10,
    weight: 20,
    purity: '916',
    source: 'Manual',
    date: '2026-08-12',
    remarks: '',
    ...partial,
  }
}

function snapshot(
  partial: Partial<JobTrackingSnapshot> & { requests: HallmarkRequest[] },
): JobTrackingSnapshot {
  return {
    roughSheets: [] as RoughSheetEntry[],
    pendingRough: [] as PendingRoughRequest[],
    fireAssays: [] as FireAssay[],
    invoices: [] as Invoice[],
    monthlyInvoices: [] as MonthlyInvoice[],
    ...partial,
  }
}

assertEq(progressFromCompleted(0), 0, '0 stages → 0%')
assertEq(progressFromCompleted(1), 20, '1 stage → 20%')
assertEq(progressFromCompleted(2), 40, '2 stages → 40%')
assertEq(progressFromCompleted(3), 60, '3 stages → 60%')
assertEq(progressFromCompleted(4), 80, '4 stages → 80%')
assertEq(progressFromCompleted(5), 80, '5 stages (delivery remaining) stays 80%')
assertEq(progressFromCompleted(6), 100, '6 stages → 100%')

assertEq(findRequestByNumber([], ''), null, 'empty query')
assertEq(findRequestByNumber([], '   '), null, 'whitespace query')

const catalog = [
  req({ id: 'r1', requestNo: 'HM-2026-001', status: 'Pending' }),
  req({ id: 'r2', requestNo: 'REQ-2026-00081', status: 'Delivered', date: '2026-07-04' }),
]
assertEq(findRequestByNumber(catalog, 'hm-2026-001')?.id, 'r1', 'case-insensitive exact')
assertEq(findRequestByNumber(catalog, 'REQ-2026-00081')?.id, 'r2', 'historical number')
assertEq(findRequestByNumber(catalog, 'REQ-2026-99999'), null, 'unknown number')
assertEq(findRequestByNumber(catalog, '00081')?.id, 'r2', 'unique suffix')

assertEq(formatTrackingInstant(''), 'Not available', 'blank timestamp')
assertEq(formatTrackingInstant(null), 'Not available', 'null timestamp')
assertEq(formatTrackingInstant('not-a-date'), 'Not available', 'invalid timestamp')
assert(!formatTrackingInstant('2026-08-12').includes('•'), 'date-only has no invented clock')
assert(formatTrackingInstant('2026-08-12T10:42:00').includes('•'), 'datetime keeps clock')

assertEq(formatTrackingUpdated('2026-08-31', new Date(2026, 7, 31)), 'Today', 'today date-only')
assert(formatTrackingUpdated('2026-07-04', new Date(2026, 7, 31)) !== 'Today', 'historical is not Today')

const pending = buildJobTrack(
  req({ id: 'p', requestNo: 'HM-P', status: 'Pending' }),
  snapshot({ requests: [] }),
)
assertEq(pending.stages[0].state, 'completed', 'received complete for existing request')
assertEq(pending.stages[1].state, 'current', 'pending request waits on data saved')
assertEq(pending.currentStageId, 'saved', 'current = data saved')
assertEq(pending.progressPercent, 20, 'received only = 20%')
assertEq(pending.stages[1].pendingLabel, 'PENDING', 'current stage labelled pending')
assertEq(pending.status, 'Pending', 'real status preserved')

const inProgress = buildJobTrack(
  req({ id: 'ip', requestNo: 'HM-IP', status: 'In Progress' }),
  snapshot({
    requests: [],
    roughSheets: [
      {
        id: 'rs',
        partyId: 'p1',
        partyName: 'Rajesh Jewellers',
        item: 'Ring',
        pic: 1,
        weight: 2,
        purity: '916',
        sampleWeight: 0.2,
        sampleQty: 1,
        samplingMethod: 'Drill',
        cml: '',
        status: 'Accepted',
        shift: 'Day',
        date: '2026-08-12',
        address: '',
        requestNo: 'HM-IP',
        jobCardNo: 'JC-9',
        jobCardSaved: true,
      },
    ],
  }),
)
assertEq(inProgress.stages[1].state, 'completed', 'in progress → data saved')
assertEq(inProgress.stages[2].state, 'current', 'in progress → fire assay current')
assertEq(inProgress.progressPercent, 40, 'two complete → 40%')
assertEq(inProgress.jobCardNo, 'JC-9', 'job card from rough sheet')
assert(inProgress.stages[1].timestampLabel.includes('Aug'), 'saved date from rough sheet')

const assayed = buildJobTrack(
  req({ id: 'a', requestNo: 'HM-A', status: 'Assayed' }),
  snapshot({
    requests: [],
    fireAssays: [
      {
        id: 'fa',
        assayNo: 'FA-1',
        requestNo: 'HM-A',
        partyName: 'Rajesh Jewellers',
        sampleWeight: 0.2,
        purityFound: 916,
        declaredPurity: '916',
        status: 'Completed',
        date: '2026-08-13',
        analyst: 'Lab Tech 1',
        assayType: 'Manual',
      },
    ],
  }),
)
assertEq(assayed.currentStageId, 'billing', 'assayed → billing current')
assertEq(assayed.stages[2].state, 'completed', 'assay completed')
assertEq(assayed.stages[3].state, 'current', 'billing is current')
assertEq(assayed.stages[3].pendingLabel, 'PENDING', 'billing pending label')
assertEq(assayed.stages[4].pendingLabel, 'WAITING FOR BILLING', 'payment waits on billing')
assertEq(assayed.analyst, 'Lab Tech 1', 'analyst from fire assay')
assertEq(assayed.progressPercent, 60, 'three complete → 60%')

const billed = buildJobTrack(
  req({ id: 'b', requestNo: 'HM-B', status: 'Billed' }),
  snapshot({
    requests: [],
    invoices: [
      {
        id: 'inv',
        invoiceNo: 'INV-1',
        partyName: 'Rajesh Jewellers',
        requestNo: 'HM-B',
        amount: 100,
        tax: 18,
        total: 118,
        status: 'Unpaid',
        date: '2026-08-13',
        invoiceDateTime: '2026-08-13T15:20:00',
      },
    ],
  }),
)
assertEq(billed.currentStageId, 'payment', 'billed unpaid → payment current')
assertEq(billed.stages[3].state, 'completed', 'billing complete')
assertEq(billed.stages[4].state, 'current', 'payment current')
assertEq(billed.stages[5].pendingLabel, 'WAITING FOR PAYMENT', 'delivery waits on payment')
assertEq(billed.progressPercent, 80, 'four complete → 80%')
assert(billed.stages[3].timestampLabel.includes('•'), 'billing datetime kept')
assertEq(billed.stages[4].timestampLabel, 'Pending', 'unpaid has no payment timestamp')

const paid = buildJobTrack(
  req({ id: 'pay', requestNo: 'HM-PAY', status: 'Billed' }),
  snapshot({
    requests: [],
    invoices: [
      {
        id: 'inv2',
        invoiceNo: 'INV-2',
        partyName: 'Rajesh Jewellers',
        requestNo: 'HM-PAY',
        amount: 100,
        tax: 18,
        total: 118,
        status: 'Paid',
        date: '2026-08-13',
        updatedAt: '2026-08-14T11:05:00',
      },
    ],
  }),
)
assertEq(paid.currentStageId, 'delivery', 'paid → delivery current')
assertEq(paid.stages[4].state, 'completed', 'payment complete')
assertEq(paid.stages[5].state, 'current', 'delivery current')
assertEq(paid.stages[5].timestampLabel, 'Pending', 'no delivery timestamp invented')
assertEq(paid.progressPercent, 80, 'delivery remaining stays 80%')

const delivered = buildJobTrack(
  req({ id: 'd', requestNo: 'REQ-2026-00081', status: 'Delivered', date: '2026-07-04' }),
  snapshot({
    requests: [],
    invoices: [
      {
        id: 'inv3',
        invoiceNo: 'INV-3',
        partyName: 'Rajesh Jewellers',
        requestNo: 'REQ-2026-00081',
        amount: 50,
        tax: 9,
        total: 59,
        status: 'Paid',
        date: '2026-07-04',
      },
    ],
  }),
)
assertEq(
  delivered.stages.every((s) => s.state === 'completed'),
  true,
  'delivered → all stages complete',
)
assertEq(delivered.progressPercent, 100, 'delivered = 100%')
assertEq(delivered.currentStageLabel, 'Delivery', 'last stage remains Delivery')
assertEq(delivered.stages[5].timestampLabel, 'Not available', 'missing delivery time is Not available')

const listed = listTrackedJobs(
  snapshot({
    requests: [
      req({ id: 'old', requestNo: 'OLD-1', status: 'Delivered', date: '2026-01-01' }),
      req({ id: 'new', requestNo: 'NEW-1', status: 'Pending', date: '2026-08-20' }),
      req({ id: 'mid', requestNo: 'MID-1', status: 'Billed', date: '2026-08-10' }),
    ],
  }),
  8,
)
assertEq(listed[0].id, 'new', 'active jobs first')
assertEq(listed[listed.length - 1].id, 'old', 'delivered jobs last')
assert(listed.length <= 8, 'dashboard list is capped')

const billedEarly = buildJobTrack(
  req({ id: 'be', requestNo: 'HM-BE', status: 'In Progress' }),
  snapshot({
    requests: [],
    invoices: [
      {
        id: 'inv-be',
        invoiceNo: 'INV-BE',
        partyName: 'Rajesh Jewellers',
        requestNo: 'HM-BE',
        amount: 10,
        tax: 0,
        total: 10,
        status: 'Unpaid',
        date: '2026-08-13',
      },
    ],
  }),
)
assertEq(billedEarly.stages[2].state, 'completed', 'invoice implies earlier assay stage on the timeline')
assertEq(billedEarly.currentStageId, 'payment', 'unpaid invoice → payment current')
assertEq(billedEarly.status, 'In Progress', 'real request status is unchanged')

console.log('job-tracking selftest: ok')
