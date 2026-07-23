import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  Briefcase,
  ClipboardList,
  CreditCard,
  IndianRupee,
  TrendingUp,
} from 'lucide-react'
import { getSession } from '../data/auth'
import { USER_NAME } from '../data/modules'
import { store } from '../data/store'

const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return startOfDay(d)
}

function parseDate(s: string) {
  return startOfDay(new Date(s))
}

function inRange(dateStr: string, from: Date, to: Date) {
  const d = parseDate(dateStr)
  return d >= from && d <= to
}

function formatMoney(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function PerformanceChart({ values }: { values: number[] }) {
  const w = 560
  const h = 220
  const pad = { t: 16, r: 12, b: 28, l: 36 }
  const max = Math.max(1, ...values)
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b

  const points = values.map((v, i) => {
    const x = pad.l + (i / Math.max(1, values.length - 1)) * innerW
    const y = pad.t + innerH - (v / max) * innerH
    return `${x},${y}`
  })

  const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1)
  const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => pad.t + innerH * (1 - t))

  return (
    <div className="dash-chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="dash-chart-svg" role="img" aria-label="Monthly performance">
        {grid.map((y, i) => (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.l - 8} y={y + 3} textAnchor="end" className="dash-chart-label">
              {(max * (1 - i / 4)).toFixed(max >= 10 ? 0 : 1)}
            </text>
          </g>
        ))}
        <polyline
          fill="none"
          stroke="#2563EB"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.join(' ')}
        />
        {values.map((v, i) => {
          const x = pad.l + (i / Math.max(1, values.length - 1)) * innerW
          const y = pad.t + innerH - (v / max) * innerH
          return <circle key={i} cx={x} cy={y} r="3.5" fill="#2563EB" />
        })}
        {FY_MONTHS.map((m, i) => {
          const x = pad.l + (i / Math.max(1, FY_MONTHS.length - 1)) * innerW
          return (
            <text key={m} x={x} y={h - 8} textAnchor="middle" className="dash-chart-label">
              {m}
            </text>
          )
        })}
      </svg>
      <span className="dash-avg-badge">Avg: {avg.toFixed(avg >= 10 ? 0 : 1)}</span>
    </div>
  )
}

function CalendarWidget({
  month,
  onPrev,
  onNext,
  selected,
  onSelect,
}: {
  month: Date
  onPrev: () => void
  onNext: () => void
  selected: number
  onSelect: (day: number) => void
}) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDow = new Date(year, m, 1).getDay()
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const title = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === m

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="dash-calendar">
      <div className="dash-calendar-head">
        <strong>{title}</strong>
        <div className="dash-calendar-nav">
          <button type="button" onClick={onPrev} aria-label="Previous month">
            ‹
          </button>
          <button type="button" onClick={onNext} aria-label="Next month">
            ›
          </button>
        </div>
      </div>
      <div className="dash-calendar-dow">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="dash-calendar-grid">
        {cells.map((d, i) =>
          d == null ? (
            <span key={`e-${i}`} className="dash-cal-empty" />
          ) : (
            <button
              key={d}
              type="button"
              className={`dash-cal-day ${selected === d ? 'selected' : ''} ${
                isCurrentMonth && d === today.getDate() ? 'today' : ''
              }`}
              onClick={() => onSelect(d)}
            >
              {d}
            </button>
          ),
        )}
      </div>
    </div>
  )
}

export function AnalyticsDashboard() {
  const data = store.getAll()
  const session = getSession()
  const name = session?.username || USER_NAME

  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())

  const stats = useMemo(() => {
    const today = startOfDay(new Date())
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const d15 = daysAgo(15)
    const d7 = daysAgo(7)

    const piecesIn = (from: Date, to: Date) =>
      data.requests
        .filter((r) => inRange(r.date, from, to))
        .reduce((s, r) => s + (r.pieces || 0), 0)

    const todayReqs = data.requests.filter((r) => inRange(r.date, today, today))
    // Shift not stored on request — approximate Day/Night split by even/odd request hash
    let dayPieces = 0
    let nightPieces = 0
    for (const r of todayReqs) {
      const isNight = /night/i.test(r.remarks) || r.requestNo.charCodeAt(r.requestNo.length - 1) % 2 === 0
      if (isNight) nightPieces += r.pieces
      else dayPieces += r.pieces
    }

    const revenue = data.invoices.reduce((s, i) => s + i.total, 0)
    // Fund Entry receipts — not invoice Paid flag (GoldShark-style)
    const receivedAmt = data.funds.reduce((s, f) => s + (Number(f.amount) || 0), 0)
    const due = Math.max(0, revenue - receivedAmt)

    const huid = data.requests.filter((r) =>
      ['Hallmarked', 'Billed', 'Delivered'].includes(r.status),
    ).length

    // FY month buckets Apr→Mar relative to current FY
    const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
    const monthly = FY_MONTHS.map((_, i) => {
      const monthIndex = (i + 3) % 12
      const year = i < 9 ? fyStartYear : fyStartYear + 1
      const from = new Date(year, monthIndex, 1)
      const to = new Date(year, monthIndex + 1, 0)
      return piecesIn(from, to)
    })

    const groups = [...new Set(data.parties.map((p) => p.groupName).filter(Boolean))]

    return {
      monthlyPieces: piecesIn(monthStart, today),
      last15: piecesIn(d15, today),
      lastWeek: piecesIn(d7, today),
      dayPieces,
      nightPieces,
      monthly,
      revenue,
      huid,
      requests: data.requests.length,
      jobs: data.requests.filter((r) => r.status !== 'Pending').length,
      receivedAmt,
      due,
      groups,
      partiesInGroups: data.parties.filter((p) => p.groupName).length,
    }
  }, [data])

  return (
    <div className="dash-page">
      <header className="dash-welcome">
        <h1>Welcome Back! 👋</h1>
        <p>{name}</p>
      </header>

      <div className="dash-metric-row">
        <div className="dash-metric purple">
          <div className="dash-metric-top">
            <span>Monthly Pieces</span>
            <span className="dash-metric-badge">This Month</span>
          </div>
          <strong>{stats.monthlyPieces}</strong>
        </div>
        <div className="dash-metric pink">
          <div className="dash-metric-top">
            <span>Last 15 Days</span>
            <span className="dash-metric-badge">Recent</span>
          </div>
          <strong>{stats.last15}</strong>
        </div>
        <div className="dash-metric blue">
          <div className="dash-metric-top">
            <span>Last Week</span>
            <span className="dash-metric-badge">7 Days</span>
          </div>
          <strong>{stats.lastWeek}</strong>
        </div>
        <div className="dash-metric green">
          <div className="dash-metric-top">
            <span>Today&apos;s Pieces</span>
            <span className="dash-metric-badge">Live</span>
          </div>
          <strong className="dash-metric-split">
            Day: {stats.dayPieces} <span>/</span> Night: {stats.nightPieces}
          </strong>
        </div>
      </div>

      <div className="dash-main-grid">
        <div className="dash-main-left">
          <section className="dash-card">
            <div className="dash-card-head">
              <div className="dash-card-title">
                <span className="dash-card-icon purple">
                  <TrendingUp size={18} />
                </span>
                <h2>Monthly Performance</h2>
              </div>
            </div>
            <PerformanceChart values={stats.monthly} />
          </section>

          <section className="dash-card">
            <div className="dash-card-head">
              <h2>Quick Stats</h2>
            </div>
            <div className="dash-quick-grid">
              <div className="dash-quick-item">
                <span className="dash-quick-icon purple">
                  <IndianRupee size={18} />
                </span>
                <div>
                  <span>Total Revenue</span>
                  <strong>{formatMoney(stats.revenue)}</strong>
                </div>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-icon sky">
                  <CreditCard size={18} />
                </span>
                <div>
                  <span>Total HUID</span>
                  <strong>{stats.huid}</strong>
                </div>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-icon pink">
                  <ClipboardList size={18} />
                </span>
                <div>
                  <span>Total Requests</span>
                  <strong>{stats.requests}</strong>
                </div>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-icon teal">
                  <Briefcase size={18} />
                </span>
                <div>
                  <span>Total Jobs</span>
                  <strong>{stats.jobs}</strong>
                </div>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-icon orange">
                  <ArrowDownToLine size={18} />
                </span>
                <div>
                  <span>Received Amount</span>
                  <strong>{formatMoney(stats.receivedAmt)}</strong>
                </div>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-icon navy">
                  <AlertTriangle size={18} />
                </span>
                <div>
                  <span>Due Amount</span>
                  <strong>{formatMoney(stats.due)}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="dash-main-right">
          <CalendarWidget
            month={calMonth}
            selected={selectedDay}
            onSelect={setSelectedDay}
            onPrev={() =>
              setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
            }
            onNext={() =>
              setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
            }
          />

          <section className="dash-card dash-group-card">
            <div className="dash-card-head">
              <div className="dash-card-title">
                <span className="dash-card-icon purple">
                  <Briefcase size={18} />
                </span>
                <h2>Group Data</h2>
              </div>
            </div>
            {stats.groups.length === 0 ? (
              <p className="dash-group-empty">No party groups yet. Assign groups in Add Party.</p>
            ) : (
              <ul className="dash-group-list">
                {stats.groups.map((g) => (
                  <li key={g}>
                    <strong>{g}</strong>
                    <span>
                      {data.parties.filter((p) => p.groupName === g).length} parties
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="dash-group-meta">{stats.partiesInGroups} parties in groups</div>
          </section>
        </aside>
      </div>
    </div>
  )
}
