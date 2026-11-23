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
import { fundSettlementAmount, store } from '../data/store'
import { FY_MONTH_LABELS, getFinancialYearMonthBuckets } from '../utils/financialYear'

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

/** Saved shift. Remarks always contain the word Night, so that word alone is not the shift. */
function isNightShift(r: { night?: string; remarks?: string; shift?: string }) {
  const raw = String(r.shift || r.night || '').trim().toLowerCase()
  if (raw === 'night' || raw === 'n' || raw === 'night shift') return true
  if (raw === 'day' || raw === 'd' || raw === 'day shift') return false
  const marked = /night:\s*(day|night)\b/i.exec(String(r.remarks || ''))
  if (marked) return marked[1].toLowerCase() === 'night'
  return false
}

/** `1_1047` and `2_1047` are lots of one job card. */
function jobCardKey(raw: string | undefined) {
  const value = String(raw || '').trim()
  if (!value) return ''
  const lot = /^\d+\s*[_\-/]\s*(.+)$/.exec(value)
  return (lot ? lot[1] : value).trim().toLowerCase()
}

function formatMoney(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPieces(n: number) {
  return n.toLocaleString('en-IN', {
    maximumFractionDigits: n >= 10 ? 0 : 1,
    minimumFractionDigits: 0,
  })
}

function PerformanceChart({ values }: { values: number[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const w = 960
  const h = 360
  const pad = { t: 36, r: 16, b: 34, l: 48 }
  const max = Math.max(1, ...values)
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b
  const slot = innerW / Math.max(1, values.length)
  const barW = Math.min(48, slot * 0.62)
  const baseline = pad.t + innerH
  const pts = values.map((v, i) => {
    const x = pad.l + slot * i + slot / 2
    const y = pad.t + innerH - (v / max) * innerH
    return { x, y, v }
  })
  const total = values.reduce((sum, n) => sum + n, 0)
  const avg = total / (values.length || 1)
  const peak = values.reduce((best, n, i) => (n > values[best] ? i : best), 0)
  const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => pad.t + innerH * (1 - t))

  return (
    <div className="dash-vfx">
      <div className="dash-vfx-top">
        <span className="dash-vfx-kicker">Financial year · pieces</span>
        <div className="dash-vfx-chips">
          <span>
            Peak {FY_MONTH_LABELS[peak]} · {formatPieces(values[peak])}
          </span>
          <span>Avg {formatPieces(avg)}</span>
          <span>Total {formatPieces(total)}</span>
        </div>
      </div>
      <div className="dash-vfx-stage">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="dash-chart-svg dash-vfx-svg"
          role="img"
          aria-label="Monthly performance"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="vfx-bar" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
              <stop offset="48%" stopColor="#d4b56a" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#fff6d4" />
            </linearGradient>
          </defs>

          {grid.map((y, i) => (
            <g key={i}>
              <line
                x1={pad.l}
                y1={y}
                x2={w - pad.r}
                y2={y}
                className="dash-vfx-grid"
              />
              <text x={pad.l - 10} y={y + 4} textAnchor="end" className="dash-vfx-axis">
                {formatPieces(max * (i / 4))}
              </text>
            </g>
          ))}

          {pts.map((p, i) => {
            const barH = Math.max(0, baseline - p.y)
            const active = hover === i
            if (p.v <= 0) return null
            return (
              <rect
                key={FY_MONTH_LABELS[i] || i}
                x={p.x - barW / 2}
                y={p.y}
                width={barW}
                height={barH}
                rx="7"
                className={`dash-vfx-bar ${i === peak ? 'is-peak' : ''} ${active ? 'is-hot' : ''}`}
                style={{ animationDelay: `${i * 45}ms` }}
              />
            )
          })}

          {pts.map((p, i) => (
            <text key={`mo-${i}`} x={p.x} y={h - 10} textAnchor="middle" className="dash-vfx-month">
              {FY_MONTH_LABELS[i]}
            </text>
          ))}

          {pts.map((_, i) => (
            <rect
              key={`hit-${i}`}
              x={pad.l + slot * i}
              y={pad.t}
              width={slot}
              height={innerH}
              className={`dash-vfx-hit ${hover === i ? 'is-hot' : ''}`}
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>
        {hover != null && pts[hover] && (
          <div
            className="dash-vfx-tip"
            style={{
              left: `${(pts[hover].x / w) * 100}%`,
              top: `${(pts[hover].y / h) * 100}%`,
            }}
          >
            <strong>{FY_MONTH_LABELS[hover]}</strong>
            <span>{formatPieces(values[hover])} pcs</span>
          </div>
        )}
      </div>
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
  const name = session?.username || 'User'

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

    const requestByNo = new Map(
      data.requests.map((request) => [String(request.requestNo || '').trim(), request]),
    )
    const activeSheets = data.roughSheets.filter((row) => row.status !== 'Rejected')
    const sheetRequestNos = new Set(
      activeSheets.map((row) => String(row.requestNo || '').trim()).filter(Boolean),
    )

    const piecesIn = (from: Date, to: Date) => {
      const fromSheets = activeSheets
        .filter((row) => inRange(row.date, from, to))
        .reduce((sum, row) => sum + (Number(row.pic) || 0), 0)
      const fromRequests = data.requests
        .filter((request) => {
          const requestNo = String(request.requestNo || '').trim()
          return inRange(request.date, from, to) && !sheetRequestNos.has(requestNo)
        })
        .reduce((sum, request) => sum + (request.pieces || 0), 0)
      return fromSheets + fromRequests
    }

    let dayPieces = 0
    let nightPieces = 0
    for (const row of activeSheets) {
      if (!inRange(row.date, today, today)) continue
      const request = requestByNo.get(String(row.requestNo || '').trim())
      const pic = Number(row.pic) || 0
      if (isNightShift({ shift: row.shift, night: request?.night, remarks: request?.remarks })) {
        nightPieces += pic
      } else {
        dayPieces += pic
      }
    }
    for (const request of data.requests) {
      const requestNo = String(request.requestNo || '').trim()
      if (sheetRequestNos.has(requestNo) || !inRange(request.date, today, today)) continue
      if (isNightShift(request)) nightPieces += request.pieces || 0
      else dayPieces += request.pieces || 0
    }

    const revenue = data.invoices.reduce((s, i) => s + i.total, 0)
    // Fund Entry receipts — not invoice Paid flag (GoldShark-style).
    // Received stays cash/bank. Due also drops the TDS the client deducted.
    const receivedAmt = data.funds.reduce((s, f) => s + (Number(f.amount) || 0), 0)
    const settledAmt = data.funds.reduce((s, f) => s + fundSettlementAmount(f), 0)
    const due = Math.max(0, Number((revenue - settledAmt).toFixed(2)))

    const huid = data.requests.filter((r) =>
      ['Hallmarked', 'Billed', 'Delivered'].includes(r.status),
    ).length

    // FY month buckets Apr→Mar relative to current FY (shared utility)
    const monthly = getFinancialYearMonthBuckets(today).map((bucket) =>
      piecesIn(bucket.from, bucket.to),
    )

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
      requests: new Set(
        data.requests.map((request) => String(request.requestNo || '').trim()).filter(Boolean),
      ).size,
      jobs: new Set(
        activeSheets.map((row) => jobCardKey(row.jobCardNo) || `row:${row.id}`),
      ).size,
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
                  <TrendingUp size={20} />
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
