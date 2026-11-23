/**
 * Analytics counts must follow the day sheet, bills, and hallmark ledger.
 * Run: npx --yes tsx scripts/analytics-metrics.selftest.ts
 */
import { OTHER_SERVICE_FUND_SOURCE } from '../server/src/otherServices.ts'
import {
  addIsoDays,
  buildAnalytics,
  chartTickValue,
  chartValueY,
  rangeForPreset,
  type AnalyticsInput,
} from '../src/utils/analyticsMetrics.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`[analytics] ${msg}`)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`[analytics] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const base: AnalyticsInput = {
  from: '2026-11-01',
  to: '2026-11-02',
  partyId: '',
  shift: 'All',
  parties: [
    { id: 'p1', name: 'Sharma Jewellers', groupName: 'City' },
    { id: 'p2', name: 'Mehta', groupName: '' },
  ],
  requests: [
    {
      requestNo: 'HM-1',
      partyId: 'p1',
      partyName: 'Sharma Jewellers',
      pieces: 1,
      weight: 1,
      date: '2026-11-02',
      night: 'Day',
      status: 'Billed',
      jobCardNo: 'JC-1',
    },
    {
      requestNo: 'HM-2',
      partyId: 'p2',
      partyName: 'Mehta',
      pieces: 8,
      weight: 3.5,
      date: '2026-11-02',
      night: 'Night',
      status: 'Pending',
    },
    {
      requestNo: 'HM-REJ',
      partyId: 'p1',
      partyName: 'Sharma Jewellers',
      pieces: 50,
      weight: 9,
      date: '2026-11-02',
      status: 'Pending',
    },
  ],
  roughSheets: [
    {
      id: 'rs1',
      partyId: 'p1',
      partyName: 'Sharma Jewellers',
      pic: 10,
      rejectPic: 1,
      weight: 4.25,
      shift: 'Day',
      date: '2026-11-02',
      requestNo: 'HM-1',
      jobCardNo: '1_JC-1',
      status: 'Accepted',
    },
    {
      id: 'rs2',
      partyId: 'p1',
      partyName: 'Sharma Jewellers',
      pic: 5,
      rejectPic: 0,
      weight: 2,
      shift: 'Night',
      date: '2026-11-02',
      requestNo: 'HM-1',
      jobCardNo: 'JC-2',
      status: 'Accepted',
    },
    {
      id: 'rs3',
      partyId: 'p1',
      partyName: 'Sharma Jewellers',
      pic: 99,
      weight: 1,
      shift: 'Day',
      date: '2026-11-02',
      requestNo: 'HM-REJ',
      status: 'Rejected',
    },
    {
      id: 'rs4',
      partyId: 'p1',
      partyName: 'Sharma Jewellers',
      pic: 3,
      weight: 0.5,
      shift: '',
      date: '2026-11-01',
      requestNo: '',
      jobCardNo: 'JC-ORPHAN',
      status: 'Accepted',
    },
  ],
  invoices: [
    {
      id: 'inv-old',
      invoiceNo: 'SMG-1',
      partyName: 'Sharma Jewellers',
      partyId: 'p1',
      requestNo: 'HM-OLD',
      total: 1000,
      date: '2026-10-01',
      lines: [{ hm: 4 }],
    },
    {
      id: 'inv-new',
      invoiceNo: 'SMG-2',
      partyName: 'Sharma Jewellers',
      partyId: 'p1',
      requestNo: 'HM-1',
      total: 400,
      tax: 72,
      date: '2026-11-02',
      lines: [{ hm: 12 }, { hm: 2 }],
    },
    {
      id: 'inv-cn',
      invoiceNo: 'CN-26-27/1',
      partyName: 'Sharma Jewellers',
      requestNo: 'HM-1',
      total: 50,
      date: '2026-11-02',
      lines: [{ hm: 9 }],
    },
  ],
  monthlyInvoices: [
    {
      id: 'm1',
      invoiceNo: 'M-1',
      partyId: 'p1',
      partyName: 'Sharma Jewellers',
      date: '2026-11-02',
      requestNos: ['HM-1', 'HM-ONLY-MONTH'],
      amount: 500,
      tax: 90,
      total: 590,
      lines: [
        { requestNo: 'HM-1', articlesHm: 14, amount: 400 },
        { requestNo: 'HM-ONLY-MONTH', articlesHm: 2, amount: 100 },
      ],
    },
  ],
  funds: [
    {
      date: '2026-11-02',
      amount: 300,
      tdsAmount: 50,
      partyId: 'p1',
      partyName: 'Sharma Jewellers',
      source: 'Sharma Jewellers',
      voucherNo: '12',
    },
    {
      date: '2026-11-02',
      amount: 500,
      partyName: 'Sharma Jewellers',
      source: OTHER_SERVICE_FUND_SOURCE,
      voucherNo: 'RC-OS-000001',
    },
  ],
}

const all = buildAnalytics(base)

assertEq(all.pieces, 26, 'day sheet 10+5+3 plus Mehta request 8, not the rejected row')
assertEq(all.dayPieces, 10, 'day shift from the sheet')
assertEq(all.nightPieces, 13, 'sheet night 5 plus request night 8')
assertEq(all.unshiftedPieces, 3, 'blank shift stays unshifted')
assertEq(all.rejected, 1, 'reject pic')
assertEq(all.weight, 10.25, 'weights of counted lines')
assertEq(all.jobCards, 3, '1_JC-1 and JC-1 are one card, plus JC-2 and orphan')
assertEq(all.requests, 2, 'HM-1 and the Mehta request; rejected-only request is out')
assertEq(all.openRequests, 1, 'Mehta is still pending')
assertEq(all.hallmarked, 16, 'bill HM 14 plus monthly-only 2; credit note ignored')
assertEq(all.billed, 518, '400 plus uncovered monthly share 118')
assertEq(all.bills, 2, 'one per-request bill and one monthly bill')
assertEq(all.received, 300, 'hallmark cash only')
assertEq(all.tds, 50, 'tds kept separate from cash')
assertEq(all.outstanding, 1168, '1000+400+118 - 350 settlement; other-service cash ignored')
assertEq(all.chartUnit, 'day', 'short range is daily')
assertEq(all.chart.length, 2, '1 Nov and 2 Nov')
assertEq(all.chart[0].value, 3, '1 Nov orphan pieces')
assertEq(all.chart[1].value, 23, '2 Nov sheet pieces plus Mehta')
assertEq(all.groups.length, 1, 'one group')
assertEq(all.groups[0].pieces, 18, 'group pieces')
assertEq(all.parties.length, 2, 'both parties have activity')

const dayOnly = buildAnalytics({ ...base, shift: 'Day' })
assertEq(dayOnly.pieces, 10, 'shift filter keeps day pieces')
assertEq(dayOnly.billed, 518, 'shift filter does not change billed amount')
assertEq(dayOnly.hallmarked, 16, 'shift filter does not change hallmarked pieces')
assertEq(dayOnly.unshiftedPieces, 3, 'unshifted count is still reported')

const oneParty = buildAnalytics({ ...base, partyId: 'p2' })
assertEq(oneParty.pieces, 8, 'party filter uses the request when it has no day-sheet line')
assertEq(oneParty.nightPieces, 8, 'request.night is the shift')
assertEq(oneParty.billed, 0, 'other party bills stay out')
assertEq(oneParty.outstanding, 0, 'no dues for Mehta')

const noDoubleMonthly = buildAnalytics({
  ...base,
  monthlyInvoices: [
    {
      ...base.monthlyInvoices[0],
      lines: [{ requestNo: 'HM-1', articlesHm: 14, amount: 400 }],
      requestNos: ['HM-1'],
      amount: 400,
      tax: 72,
      total: 472,
    },
  ],
})
assertEq(noDoubleMonthly.billed, 400, 'monthly bill is not added on top of the same request')
assertEq(noDoubleMonthly.hallmarked, 14, 'monthly HM is not added twice')

const oldBillOnly = buildAnalytics({
  ...base,
  invoices: [
    {
      id: 'old-lines-missing',
      invoiceNo: 'SMG-9',
      partyName: 'Sharma Jewellers',
      partyId: 'p1',
      requestNo: 'HM-1',
      total: 200,
      date: '2026-11-02',
    },
  ],
  monthlyInvoices: [],
  funds: [],
})
assertEq(oldBillOnly.hallmarked, 14, 'bill without lines uses pic minus reject')

assertEq(rangeForPreset('today', '2026-11-02', '2026-04-01', '2027-03-31').from, '2026-11-02', 'today from')
assertEq(rangeForPreset('7', '2026-11-02', '2026-04-01', '2027-03-31').from, '2026-10-27', '7 days includes today')
assertEq(addIsoDays('2026-11-02', -6), '2026-10-27', 'add days across month')
assertEq(rangeForPreset('month', '2026-11-02', '2026-04-01', '2027-03-31').from, '2026-11-01', 'month starts on the 1st')
assertEq(rangeForPreset('year', '2026-11-02', '2026-04-01', '2027-03-31').from, '2026-04-01', 'year starts at period')
assertEq(rangeForPreset('year', '2026-11-02', '2026-04-01', '2027-03-31').to, '2026-11-02', 'year ends today')

const year = buildAnalytics({
  ...base,
  from: '2026-04-01',
  to: '2026-11-02',
})
assertEq(year.chartUnit, 'month', 'long range is monthly')
assert(year.chart.length > 6, 'monthly buckets cover the range')
assertEq(chartTickValue(437, 0), 0, 'chart zero is the bottom tick')
assertEq(chartTickValue(437, 1), 437, 'chart max is the top tick')
assertEq(chartValueY(0, 437, 22, 280), 302, 'zero value sits on the bottom')
assertEq(chartValueY(437, 437, 22, 280), 22, 'max value sits on the top')

console.log('analytics-metrics.selftest ok')
