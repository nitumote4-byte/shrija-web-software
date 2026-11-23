import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Briefcase,
  ClipboardList,
  CreditCard,
  IndianRupee,
  Radio,
  Scale,
  TrendingUp,
} from 'lucide-react'
import { getSession } from '../data/auth'
import { OFP_CHANGE_EVENT, getWorkingPeriod } from '../data/operationalPeriod'
import { store } from '../data/store'
import { pullStoreIfIdle, STORE_PERSIST_EVENT, getStoreVersion } from '../data/tenantCache'
import { formatDisplayDate } from '../utils/financialYear'
import {
  buildAnalytics,
  chartTickValue,
  chartValueY,
  localTodayIso,
  orderedRange,
  rangeForPreset,
  type AnalyticsPreset,
  type AnalyticsShift,
  type DayPoint,
} from '../utils/analyticsMetrics'

const PULL_MS = 12000
const LOCAL_MS = 2000

function formatMoney(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatCount(n: number) {
  return Math.round(n).toLocaleString('en-IN')
}

function formatWeight(n: number) {
  return `${n.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g`
}

function formatClock(d: Date) {
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

function useLiveStore() {
  const [version, setVersion] = useState(() => getStoreVersion())
  const [ofpTick, setOfpTick] = useState(0)
  const [live, setLive] = useState<'live' | 'offline'>('live')
  const [checkedAt, setCheckedAt] = useState(() => new Date())

  useEffect(() => {
    let stopped = false
    const readLocal = () => {
      const next = getStoreVersion()
      setVersion((prev) => {
        if (prev !== next) setCheckedAt(new Date())
        return next
      })
    }
    const pull = async () => {
      const result = await pullStoreIfIdle()
      if (stopped) return
      if (result === 'error') setLive('offline')
      else if (result !== 'skipped') {
        setLive('live')
        setCheckedAt(new Date())
      }
      readLocal()
    }
    const localId = window.setInterval(readLocal, LOCAL_MS)
    const pullId = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void pull()
    }, PULL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull()
    }
    const onPersist = () => readLocal()
    const onPeriod = () => setOfpTick((n) => n + 1)
    window.addEventListener(STORE_PERSIST_EVENT, onPersist)
    window.addEventListener(OFP_CHANGE_EVENT, onPeriod)
    document.addEventListener('visibilitychange', onVisible)
    void pull()
    return () => {
      stopped = true
      window.clearInterval(localId)
      window.clearInterval(pullId)
      window.removeEventListener(STORE_PERSIST_EVENT, onPersist)
      window.removeEventListener(OFP_CHANGE_EVENT, onPeriod)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return { version, ofpTick, live, checkedAt }
}

function PerformanceChart({ points, unit }: { points: DayPoint[]; unit: 'day' | 'month' }) {
  const w = 960
  const h = 340
  const pad = { t: 22, r: 16, b: 32, l: 48 }
  const values = points.map((point) => point.value)
  const max = Math.max(1, ...values, 0)
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const avg = values.reduce((sum, value) => sum + value, 0) / (values.length || 1)
  const labelStep = points.length <= 12 ? 1 : Math.ceil(points.length / 8)

  const xFor = (index: number) =>
    pad.l + (index / Math.max(1, points.length - 1)) * innerW

  return (
    <div className="dash-chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="dash-chart-svg" role="img" aria-label="Pieces received">
        {ticks.map((t, index) => {
          const y = chartValueY(chartTickValue(max, t), max, pad.t, innerH)
          const tick = chartTickValue(max, t)
          return (
            <g key={index}>
              <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" className="dash-chart-label">
                {Math.round(tick).toLocaleString('en-IN')}
              </text>
            </g>
          )
        })}
        <polyline
          fill="none"
          stroke="#1a365d"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points
            .map((point, index) => `${xFor(index)},${chartValueY(point.value, max, pad.t, innerH)}`)
            .join(' ')}
        />
        {points.map((point, index) => {
          const x = xFor(index)
          const y = chartValueY(point.value, max, pad.t, innerH)
          const showLabel = index % labelStep === 0 || index === points.length - 1
          return (
            <g key={`${point.date}-${index}`}>
              <circle cx={x} cy={y} r="3.5" fill="#b8923a">
                <title>{`${point.label}: ${formatCount(point.value)} pcs`}</title>
              </circle>
              {showLabel ? (
                <text x={x} y={h - 8} textAnchor="middle" className="dash-chart-label">
                  {point.label}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      <span className="dash-avg-badge">
        Avg / {unit}: {avg.toFixed(avg >= 10 ? 0 : 1)}
      </span>
    </div>
  )
}

function ShiftSplit({
  day,
  night,
  unshifted,
}: {
  day: number
  night: number
  unshifted: number
}) {
  const total = day + night + unshifted
  const width = (n: number) => (total <= 0 ? 0 : (n / total) * 100)
  return (
    <div className="dash-split">
      <div className="dash-split-bar" aria-hidden>
        <span className="is-day" style={{ width: `${width(day)}%` }} />
        <span className="is-night" style={{ width: `${width(night)}%` }} />
        <span className="is-none" style={{ width: `${width(unshifted)}%` }} />
      </div>
      <div className="dash-split-legend">
        <span><i className="is-day" /> Day {formatCount(day)}</span>
        <span><i className="is-night" /> Night {formatCount(night)}</span>
        {unshifted > 0 ? <span><i className="is-none" /> No shift {formatCount(unshifted)}</span> : null}
      </div>
    </div>
  )
}

function CalendarWidget({
  month,
  onPrev,
  onNext,
  from,
  to,
  activeDays,
  onSelect,
}: {
  month: Date
  onPrev: () => void
  onNext: () => void
  from: string
  to: string
  activeDays: Record<string, number>
  onSelect: (iso: string) => void
}) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDow = new Date(year, m, 1).getDay()
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const title = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const today = localTodayIso()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  const pad = (n: number) => String(n).padStart(2, '0')

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
        {cells.map((d, i) => {
          if (d == null) return <span key={`e-${i}`} className="dash-cal-empty" />
          const iso = `${year}-${pad(m + 1)}-${pad(d)}`
          const inRange = iso >= from && iso <= to
          const pieces = activeDays[iso] || 0
          return (
            <button
              key={iso}
              type="button"
              className={`dash-cal-day ${inRange ? 'in-range' : ''} ${iso === today ? 'today' : ''}`}
              onClick={() => onSelect(iso)}
              title={pieces > 0 ? `${formatCount(pieces)} pieces received` : 'No pieces'}
            >
              {d}
              {pieces > 0 ? <i className="dash-cal-dot" /> : null}
            </button>
          )
        })}
      </div>
      <p className="dash-cal-hint">Click a day to see that day. A dot means pieces were received.</p>
    </div>
  )
}

function partyOptions(parties: { id: string; name: string; groupName?: string }[], names: string[]) {
  const rows = parties
    .filter((party) => party.name.trim() || party.id)
    .map((party) => ({ id: party.id, name: party.name.trim() || party.id, groupName: party.groupName || '' }))
  const seen = new Set(rows.map((party) => party.name.toLowerCase().replace(/\s+/g, ' ')))
  for (const raw of names) {
    const name = String(raw || '').trim()
    const key = name.toLowerCase().replace(/\s+/g, ' ')
    if (!name || seen.has(key)) continue
    seen.add(key)
    rows.push({ id: `name:${key}`, name, groupName: '' })
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

const PRESETS: { id: AnalyticsPreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7', label: '7 days' },
  { id: '15', label: '15 days' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
]

export function AnalyticsDashboard() {
  const session = getSession()
  const name = session?.username || 'User'
  const { version, ofpTick, live, checkedAt } = useLiveStore()

  const [preset, setPreset] = useState<AnalyticsPreset | 'custom'>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [partyId, setPartyId] = useState('')
  const [shift, setShift] = useState<AnalyticsShift>('All')
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const view = useMemo(() => {
    const data = store.getAll()
    const today = localTodayIso()
    const period = getWorkingPeriod()
    const active =
      preset === 'custom'
        ? orderedRange(customFrom, customTo)
        : rangeForPreset(preset, today, period.startDate, period.endDate)
    const names = [
      ...data.requests.map((row) => row.partyName),
      ...data.roughSheets.map((row) => row.partyName),
      ...data.invoices.map((row) => row.partyName),
      ...(data.monthlyInvoices || []).map((row) => row.partyName),
      ...data.funds.map((row) => (row.source === 'OTHER_SERVICE' ? '' : row.partyName || row.source || '')),
    ]
    const parties = partyOptions(data.parties, names)
    return {
      snapshot: buildAnalytics({
        from: active.from,
        to: active.to,
        partyId,
        shift,
        requests: data.requests,
        roughSheets: data.roughSheets,
        invoices: data.invoices,
        monthlyInvoices: data.monthlyInvoices || [],
        funds: data.funds,
        parties,
      }),
      parties,
      periodName: period.name,
    }
    // version and ofpTick re-read the live store and the working period
  }, [version, ofpTick, preset, customFrom, customTo, partyId, shift])

  const { snapshot, parties, periodName } = view

  const applyPreset = (next: AnalyticsPreset) => {
    setPreset(next)
    setCustomFrom('')
    setCustomTo('')
  }

  const applyCustom = (from: string, to: string) => {
    setCustomFrom(from)
    setCustomTo(to)
    setPreset('custom')
  }

  const usingCustom = preset === 'custom'
  const rangeLabel =
    snapshot.from && snapshot.to
      ? snapshot.from === snapshot.to
        ? formatDisplayDate(snapshot.from)
        : `${formatDisplayDate(snapshot.from)} – ${formatDisplayDate(snapshot.to)}`
      : ''

  const endLabel = snapshot.to ? formatDisplayDate(snapshot.to) : 'end date'
  const outstandingLabel = snapshot.outstanding < 0 ? `Advance till ${endLabel}` : `Outstanding till ${endLabel}`
  const outstandingValue = Math.abs(snapshot.outstanding)

  const singleDay = snapshot.chart.length === 1
  const activeGroups = snapshot.groups.filter((group) => group.pieces || group.hallmarked || group.billed)
  const showGroups = activeGroups.length > 0

  return (
    <div className="dash-page">
      <header className="dash-welcome dash-welcome-row">
        <div>
          <h1>Analytics</h1>
          <p>
            {name}
            {rangeLabel ? ` · ${rangeLabel}` : ''}
          </p>
        </div>
        <div className={`dash-live is-${live}`} title={live === 'live' ? 'Updates from this centre' : 'Could not reach the server'}>
          <Radio size={14} />
          <span>{live === 'live' ? 'Live' : 'Not live'}</span>
          <em>Checked {formatClock(checkedAt)}</em>
        </div>
      </header>

      <section className="dash-filters">
        <div className="dash-presets" role="group" aria-label="Date range">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`dash-preset ${!usingCustom && preset === item.id ? 'active' : ''}`}
              aria-pressed={!usingCustom && preset === item.id}
              onClick={() => applyPreset(item.id)}
            >
              {item.id === 'year' ? periodName : item.label}
            </button>
          ))}
        </div>
        <label>
          <span>From</span>
          <input
            type="date"
            value={snapshot.from}
            onChange={(e) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) applyCustom(e.target.value, snapshot.to)
            }}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={snapshot.to}
            onChange={(e) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) applyCustom(snapshot.from, e.target.value)
            }}
          />
        </label>
        <label>
          <span>Party</span>
          <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">All parties</option>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Shift</span>
          <select value={shift} onChange={(e) => setShift(e.target.value as AnalyticsShift)}>
            <option value="All">All shifts</option>
            <option value="Day">Day</option>
            <option value="Night">Night</option>
          </select>
        </label>
      </section>

      <p className="dash-note">
        Pieces, weight, rejected pieces, and job cards come from the day sheet. Hallmarked pieces and billed amount come from bills. Cash and TDS come from hallmark fund entry. Outstanding is every hallmark bill minus receipts up to the end date, including older dues.
        {shift !== 'All'
          ? ' The shift filter changes pieces and job cards only. Bills and money stay on the date and party.'
          : ''}
        {snapshot.unshiftedPieces > 0
          ? shift === 'All'
            ? ` ${formatCount(snapshot.unshiftedPieces)} pieces have no Day/Night on the sheet, and they are included in the total.`
            : ` ${formatCount(snapshot.unshiftedPieces)} pieces have no Day/Night, so they are hidden for this shift.`
          : ''}
      </p>

      <div className="dash-metric-row">
        <div className="dash-metric purple">
          <div className="dash-metric-top">
            <span>Pieces received</span>
            <span className="dash-metric-badge">{shift === 'All' ? 'Day sheet' : shift}</span>
          </div>
          <strong>{formatCount(snapshot.pieces)}</strong>
          <em className="dash-metric-sub">
            {shift === 'All'
              ? `Day ${formatCount(snapshot.dayPieces)} / Night ${formatCount(snapshot.nightPieces)}${
                  snapshot.unshiftedPieces > 0 ? ` / No shift ${formatCount(snapshot.unshiftedPieces)}` : ''
                }`
              : `${shift} shift only`}
          </em>
        </div>
        <div className="dash-metric pink">
          <div className="dash-metric-top">
            <span>Hallmarked pcs</span>
            <span className="dash-metric-badge">On bills</span>
          </div>
          <strong>{formatCount(snapshot.hallmarked)}</strong>
          <em className="dash-metric-sub">HUID pieces, not request count</em>
        </div>
        <div className="dash-metric blue">
          <div className="dash-metric-top">
            <span>Job cards</span>
            <span className="dash-metric-badge">Distinct</span>
          </div>
          <strong>{formatCount(snapshot.jobCards)}</strong>
          <em className="dash-metric-sub">Job card numbers on the day sheet</em>
        </div>
        <div className="dash-metric green">
          <div className="dash-metric-top">
            <span>Requests</span>
            <span className="dash-metric-badge">Request no.</span>
          </div>
          <strong>{formatCount(snapshot.requests)}</strong>
          <em className="dash-metric-sub">{formatCount(snapshot.openRequests)} still open</em>
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
                <div>
                  <h2>Pieces received</h2>
                  <p className="dash-card-sub">{rangeLabel}</p>
                </div>
              </div>
            </div>
            {singleDay ? (
              <ShiftSplit
                day={snapshot.dayPieces}
                night={snapshot.nightPieces}
                unshifted={shift === 'All' ? snapshot.unshiftedPieces : 0}
              />
            ) : (
              <PerformanceChart points={snapshot.chart} unit={snapshot.chartUnit} />
            )}
          </section>

          <section className="dash-card">
            <div className="dash-card-head">
              <h2>For this period</h2>
            </div>
            <div className="dash-quick-grid">
              <div className="dash-quick-item">
                <span className="dash-quick-icon teal">
                  <Scale size={18} />
                </span>
                <div>
                  <span>Weight received</span>
                  <strong>{formatWeight(snapshot.weight)}</strong>
                </div>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-icon pink">
                  <AlertTriangle size={18} />
                </span>
                <div>
                  <span>Rejected pcs</span>
                  <strong>{formatCount(snapshot.rejected)}</strong>
                </div>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-icon sky">
                  <ClipboardList size={18} />
                </span>
                <div>
                  <span>Open requests</span>
                  <strong>{formatCount(snapshot.openRequests)}</strong>
                </div>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-icon navy">
                  <CreditCard size={18} />
                </span>
                <div>
                  <span>Bills</span>
                  <strong>{formatCount(snapshot.bills)}</strong>
                </div>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-icon purple">
                  <IndianRupee size={18} />
                </span>
                <div>
                  <span>Billed amount</span>
                  <strong>{formatMoney(snapshot.billed)}</strong>
                </div>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-icon orange">
                  <IndianRupee size={18} />
                </span>
                <div>
                  <span>Cash received</span>
                  <strong>{formatMoney(snapshot.received)}</strong>
                </div>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-icon teal">
                  <IndianRupee size={18} />
                </span>
                <div>
                  <span>TDS</span>
                  <strong>{formatMoney(snapshot.tds)}</strong>
                </div>
              </div>
              <div className="dash-quick-item">
                <span className="dash-quick-icon navy">
                  <AlertTriangle size={18} />
                </span>
                <div>
                  <span>{outstandingLabel}</span>
                  <strong>{formatMoney(outstandingValue)}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="dash-main-right">
          <CalendarWidget
            month={calMonth}
            from={snapshot.from}
            to={snapshot.to}
            activeDays={snapshot.piecesByDay}
            onSelect={(iso) => {
              applyCustom(iso, iso)
              const [y, m] = iso.split('-').map(Number)
              setCalMonth(new Date(y, m - 1, 1))
            }}
            onPrev={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            onNext={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          />

          <section className="dash-card dash-group-card">
            <div className="dash-card-head">
              <div className="dash-card-title">
                <span className="dash-card-icon purple">
                  <Briefcase size={18} />
                </span>
                <h2>{showGroups ? 'Groups' : 'Parties'}</h2>
              </div>
            </div>
            {showGroups ? (
              <ul className="dash-group-list">
                {activeGroups.slice(0, 12).map((group) => (
                  <li key={group.name}>
                    <strong>{group.name}</strong>
                    <span>
                      {formatCount(group.pieces)} pcs · {formatMoney(group.billed)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : snapshot.parties.length === 0 ? (
              <p className="dash-group-empty">No party activity in this period.</p>
            ) : (
              <ul className="dash-group-list">
                {snapshot.parties.slice(0, 8).map((party) => (
                  <li key={party.id}>
                    <strong>{party.name}</strong>
                    <span>
                      {formatCount(party.pieces)} pcs · {formatMoney(party.billed)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="dash-group-meta">
              {showGroups
                ? 'Pieces and billed amount for parties in each group'
                : 'Top parties by pieces received in this period'}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
