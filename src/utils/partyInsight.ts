import type { FundEntry, HallmarkRequest, Invoice, Party } from '../data/store'
import {
  computeInvoicePaymentStatuses,
  fundBelongsToParty,
  fundSettlementAmount,
} from '../../server/src/invoicePaymentStatus.ts'

const PENDING_JOB = new Set(['Pending', 'In Progress', 'Assayed', 'Hallmarked'])

export type PartyMonthBar = { key: string; label: string; jobs: number; billed: number }

export type PartyJobRow = {
  id: string
  date: string
  requestNo: string
  pieces: number
  weight: number
  status: string
}

export type PartyInvoiceRow = {
  id: string
  date: string
  invoiceNo: string
  total: number
  status: 'Paid' | 'Partial' | 'Unpaid'
}

export type PartyPaymentRow = {
  id: string
  date: string
  voucherNo: string
  amount: number
  mode: string
}

export type PartyInsight = {
  jobs: number
  pieces: number
  weight: number
  pendingJobs: number
  jobsThisMonth: number
  avgPerMonth: number
  billed: number
  received: number
  outstanding: number
  invoiceCount: number
  paid: number
  partial: number
  unpaid: number
  rankByJobs: number
  rankByBilling: number
  partyCount: number
  rating: number
  ratingLabel: string
  months: PartyMonthBar[]
  jobsRecent: PartyJobRow[]
  invoicesRecent: PartyInvoiceRow[]
  paymentsRecent: PartyPaymentRow[]
}

export type PartyRankRow = {
  id: string
  name: string
  jobs: number
  billed: number
  rank: number
}

function norm(name: string | undefined | null) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthOf(value: string) {
  if (!value) return ''
  if (/^\d{4}-\d{2}/.test(value)) return value.slice(0, 7)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return monthKey(parsed)
}

function recentMonths(now: Date, count: number): PartyMonthBar[] {
  const bars: PartyMonthBar[] = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    bars.push({
      key: monthKey(date),
      label: date.toLocaleDateString('en-IN', { month: 'short' }),
      jobs: 0,
      billed: 0,
    })
  }
  return bars
}

function belongs(party: Party, row: { partyId?: string; partyName?: string; source?: string }) {
  if (row.partyId && row.partyId === party.id) return true
  const name = norm(party.name)
  if (!name) return false
  return norm(row.partyName) === name || norm(row.source) === name
}

function ratingLabel(score: number, jobs: number, invoices: number, paid: number) {
  if (jobs === 0 && invoices === 0) return 'New party'
  if (invoices > 0 && paid / invoices < 0.34) return 'Slow payer'
  if (score >= 4.5) return 'Top payer'
  if (score >= 3.5) return 'Strong'
  if (score >= 2.5) return 'Steady'
  if (score >= 1) return 'Slow payer'
  return 'New party'
}

function scoreParty(jobs: number, topJobs: number, paid: number, invoiceCount: number, recent: boolean) {
  if (jobs === 0 && invoiceCount === 0) return 0
  const volume = topJobs > 0 ? Math.min(2, (jobs / topJobs) * 2) : 0
  const pay = invoiceCount > 0 ? (paid / invoiceCount) * 2.5 : 1.25
  const freshness = recent ? 0.5 : 0
  const raw = Math.min(5, volume + pay + freshness)
  return Math.round(raw * 2) / 2
}

export function buildPartyBoard(
  parties: Party[],
  requests: HallmarkRequest[],
  invoices: Invoice[],
  funds: FundEntry[],
  now = new Date(),
): { insights: Map<string, PartyInsight>; ranks: PartyRankRow[] } {
  const thisMonth = monthKey(now)
  const months = recentMonths(now, 6)
  const monthIndex = new Map(months.map((bar, index) => [bar.key, index]))
  const statuses = computeInvoicePaymentStatuses(invoices, funds)
  const recentCutoff = now.getTime() - 45 * 24 * 60 * 60 * 1000

  const drafts = parties.map((party) => {
    const jobs = requests.filter((row) => belongs(party, row))
    const bills = invoices.filter((row) => belongs(party, row))
    const partyReceipts = funds.filter((row) =>
      fundBelongsToParty(
        row.partyId === party.id ? { ...row, partyName: party.name } : row,
        party.name,
      ),
    )

    const bars = months.map((bar) => ({ ...bar }))
    for (const job of jobs) {
      const key = monthOf(job.date)
      const index = monthIndex.get(key)
      if (index !== undefined) bars[index].jobs += 1
    }
    for (const bill of bills) {
      const key = monthOf(bill.date)
      const index = monthIndex.get(key)
      if (index !== undefined) bars[index].billed += Number(bill.total) || 0
    }

    let paid = 0
    let partial = 0
    let unpaid = 0
    for (const bill of bills) {
      const status = statuses.get(bill.id) || bill.status || 'Unpaid'
      if (status === 'Paid') paid += 1
      else if (status === 'Partial') partial += 1
      else unpaid += 1
    }

    const billed = Number(bills.reduce((sum, bill) => sum + (Number(bill.total) || 0), 0).toFixed(2))
    const received = Number(
      partyReceipts.reduce((sum, row) => sum + (Number(row.amount) || 0), 0).toFixed(2),
    )
    const settled = Number(
      partyReceipts.reduce((sum, row) => sum + fundSettlementAmount(row), 0).toFixed(2),
    )
    const firstJob = [...jobs].map((job) => job.date).filter(Boolean).sort()[0]
    const span = firstJob ? monthsSince(firstJob, now) : 1
    const lastDate = [...jobs].map((job) => job.date).filter(Boolean).sort().at(-1) || ''
    const lastMs = lastDate ? new Date(lastDate.length === 10 ? `${lastDate}T00:00:00` : lastDate).getTime() : 0

    return {
      party,
      jobs,
      bills,
      partyReceipts,
      bars,
      paid,
      partial,
      unpaid,
      billed,
      received,
      outstanding: Number((billed - settled).toFixed(2)),
      pendingJobs: jobs.filter((job) => PENDING_JOB.has(job.status)).length,
      pieces: jobs.reduce((sum, job) => sum + (Number(job.pieces) || 0), 0),
      weight: jobs.reduce((sum, job) => sum + (Number(job.weight) || 0), 0),
      jobsThisMonth: jobs.filter((job) => monthOf(job.date) === thisMonth).length,
      avgPerMonth: Number((jobs.length / span).toFixed(1)),
      recent: lastMs >= recentCutoff,
    }
  })

  const topJobs = drafts.reduce((max, row) => Math.max(max, row.jobs.length), 0)
  const byJobs = [...drafts].sort((a, b) => b.jobs.length - a.jobs.length || b.billed - a.billed || a.party.name.localeCompare(b.party.name))
  const byBilling = [...drafts].sort((a, b) => b.billed - a.billed || b.jobs.length - a.jobs.length || a.party.name.localeCompare(b.party.name))
  const jobRank = new Map<string, number>()
  const billRank = new Map<string, number>()
  byJobs.forEach((row, index) => {
    const prev = byJobs[index - 1]
    const rank = prev && prev.jobs.length === row.jobs.length && prev.billed === row.billed ? jobRank.get(prev.party.id)! : index + 1
    jobRank.set(row.party.id, rank)
  })
  byBilling.forEach((row, index) => {
    const prev = byBilling[index - 1]
    const rank = prev && prev.billed === row.billed ? billRank.get(prev.party.id)! : index + 1
    billRank.set(row.party.id, rank)
  })

  const insights = new Map<string, PartyInsight>()
  for (const row of drafts) {
    const rating = scoreParty(row.jobs.length, topJobs, row.paid, row.bills.length, row.recent)
    insights.set(row.party.id, {
      jobs: row.jobs.length,
      pieces: row.pieces,
      weight: Number(row.weight.toFixed(2)),
      pendingJobs: row.pendingJobs,
      jobsThisMonth: row.jobsThisMonth,
      avgPerMonth: row.avgPerMonth,
      billed: row.billed,
      received: row.received,
      outstanding: row.outstanding,
      invoiceCount: row.bills.length,
      paid: row.paid,
      partial: row.partial,
      unpaid: row.unpaid,
      rankByJobs: jobRank.get(row.party.id) || parties.length,
      rankByBilling: billRank.get(row.party.id) || parties.length,
      partyCount: parties.length,
      rating,
      ratingLabel: ratingLabel(rating, row.jobs.length, row.bills.length, row.paid),
      months: row.bars,
      jobsRecent: [...row.jobs]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 6)
        .map((job) => ({
          id: job.id,
          date: job.date,
          requestNo: job.requestNo,
          pieces: Number(job.pieces) || 0,
          weight: Number(job.weight) || 0,
          status: job.status,
        })),
      invoicesRecent: [...row.bills]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 6)
        .map((bill) => ({
          id: bill.id,
          date: bill.date,
          invoiceNo: bill.invoiceNo,
          total: Number(bill.total) || 0,
          status: statuses.get(bill.id) || bill.status || 'Unpaid',
        })),
      paymentsRecent: [...row.partyReceipts]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 6)
        .map((receipt) => ({
          id: receipt.id,
          date: receipt.date,
          voucherNo: receipt.voucherNo || '',
          amount: Number(receipt.amount) || 0,
          mode: receipt.mode,
        })),
    })
  }

  const ranks: PartyRankRow[] = byJobs.map((row) => ({
    id: row.party.id,
    name: row.party.name,
    jobs: row.jobs.length,
    billed: row.billed,
    rank: jobRank.get(row.party.id) || 0,
  }))

  return { insights, ranks }
}

function monthsSince(first: string, now: Date) {
  const key = monthOf(first)
  if (!key) return 1
  const [year, month] = key.split('-').map(Number)
  const span = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month) + 1
  return Math.max(1, span)
}
