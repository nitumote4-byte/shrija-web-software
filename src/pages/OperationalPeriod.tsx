import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { useToast } from '../components/ui'
import {
  createOperationalPeriod,
  getWorkingPeriod,
  isCalendarCurrentPeriod,
  listOperationalPeriods,
  suggestedDatesForName,
  switchWorkingPeriod,
  type OperationalPeriod,
} from '../data/operationalPeriod'
import { formatDisplayDate, getFinancialYear, parsePeriodName } from '../utils/financialYear'

function nextSuggestedName(existing: OperationalPeriod[]) {
  if (existing.length === 0) return getFinancialYear()
  const years = existing
    .map((p) => parsePeriodName(p.name)?.startYear)
    .filter((y): y is number => typeof y === 'number')
  const next = Math.max(...years) + 1
  return `${next}-${String(next + 1).slice(-2)}`
}

export function OperationalPeriodPage() {
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)
  const periods = useMemo(() => {
    void tick
    return listOperationalPeriods()
  }, [tick])
  const working = useMemo(() => getWorkingPeriod(), [tick])

  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    const suggested = nextSuggestedName(periods)
    setName(suggested)
    const dates = suggestedDatesForName(suggested)
    if (dates) {
      setStartDate(dates.startDate)
      setEndDate(dates.endDate)
    }
  }, [periods])

  const onNameChange = (value: string) => {
    setName(value)
    const dates = suggestedDatesForName(value)
    if (dates) {
      setStartDate(dates.startDate)
      setEndDate(dates.endDate)
    }
  }

  const refresh = () => setTick((n) => n + 1)

  const onCreate = (e: FormEvent) => {
    e.preventDefault()
    const result = createOperationalPeriod({ name, startDate, endDate })
    if (!result.ok) {
      toast(result.message)
      return
    }
    toast(`Created Operational Financial Period ${result.period.name}`)
    refresh()
  }

  const onSwitch = (period: OperationalPeriod) => {
    if (period.status === 'working') return
    const result = switchWorkingPeriod(period.id)
    if (!result.ok) {
      toast(result.message)
      return
    }
    setConfirmId(null)
    toast(`Working Operational Financial Period: ${result.period.name}`)
    refresh()
  }

  return (
    <div className="others-subpage ofp-page">
      <Link to="/others" className="back-link">
        <ArrowLeft size={16} /> Back to Others
      </Link>

      <div className="page-header">
        <div>
          <h1>Operational Financial Period</h1>
          <p>Create periods, switch the working year, and keep records isolated.</p>
        </div>
      </div>

      <section className={`ofp-working-card${isCalendarCurrentPeriod(working) ? '' : ' is-prior'}`}>
        <span className="ofp-kicker">Working Operational Financial Period</span>
        <strong>{working?.name || '—'}</strong>
        {working ? (
          <p>
            {formatDisplayDate(working.startDate)} → {formatDisplayDate(working.endDate)}
          </p>
        ) : null}
        {!isCalendarCurrentPeriod(working) ? (
          <p className="ofp-prior-note">Currently working in a prior period. New records stay in {working.name}.</p>
        ) : null}
      </section>

      <section className="ofp-panel">
        <div className="ofp-panel-head">
          <h2>Existing periods</h2>
          <p>Only one period is the working context at a time. Older periods are kept as-is.</p>
        </div>
        <div className="ofp-period-list">
          {periods.map((period) => {
            const isWorking = period.status === 'working'
            return (
              <article
                key={period.id}
                className={`ofp-period-row${isWorking ? ' is-working' : ''}`}
              >
                <div>
                  <strong>{period.name}</strong>
                  <span>
                    {formatDisplayDate(period.startDate)} → {formatDisplayDate(period.endDate)}
                  </span>
                </div>
                <div className="ofp-period-actions">
                  {isWorking ? (
                    <span className="ofp-badge">Working</span>
                  ) : confirmId === period.id ? (
                    <>
                      <span className="ofp-confirm-copy">Switch working period to {period.name}?</span>
                      <button type="button" className="btn btn-navy" onClick={() => onSwitch(period)}>
                        Confirm
                      </button>
                      <button type="button" className="btn btn-reset" onClick={() => setConfirmId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-reset" onClick={() => setConfirmId(period.id)}>
                      Switch to this period
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="ofp-panel">
        <div className="ofp-panel-head">
          <h2>Create Operational Financial Period</h2>
          <p>Start date must be before end date. Overlapping or duplicate periods are rejected.</p>
        </div>
        <form className="ofp-create-form" onSubmit={onCreate}>
          <div className="field">
            <label htmlFor="ofp-name">Period</label>
            <input
              id="ofp-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="2027-28"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="ofp-start">Start Date</label>
            <input
              id="ofp-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="ofp-end">End Date</label>
            <input
              id="ofp-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-navy">
            <Plus size={16} /> Create period
          </button>
        </form>
      </section>
      {Toast}
    </div>
  )
}
