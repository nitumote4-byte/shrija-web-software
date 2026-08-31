import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange } from 'lucide-react'
import {
  getWorkingPeriod,
  isCalendarCurrentPeriod,
  OFP_CHANGE_EVENT,
} from '../data/operationalPeriod'
import { formatDisplayDate } from '../utils/financialYear'

export function OperationalPeriodBadge({ compact = false }: { compact?: boolean }) {
  const [period, setPeriod] = useState(() => getWorkingPeriod())
  useEffect(() => {
    const sync = () => setPeriod(getWorkingPeriod())
    window.addEventListener(OFP_CHANGE_EVENT, sync)
    return () => window.removeEventListener(OFP_CHANGE_EVENT, sync)
  }, [])
  const prior = !isCalendarCurrentPeriod(period)
  if (compact) {
    return (
      <Link
        to="/others/operational-period"
        className={`ofp-header-chip${prior ? ' is-prior' : ''}`}
        title={`Working Operational Financial Period ${period.name}`}
      >
        <CalendarRange size={14} />
        <span>{period.name}</span>
      </Link>
    )
  }
  return (
    <section className={`ofp-dash-banner${prior ? ' is-prior' : ''}`}>
      <div>
        <span className="ofp-kicker">Working Operational Financial Period</span>
        <strong>{period.name}</strong>
        <p>
          {formatDisplayDate(period.startDate)} → {formatDisplayDate(period.endDate)}
          {prior ? ' · working in a prior period' : ''}
        </p>
      </div>
      <Link to="/others/operational-period" className="ofp-dash-link">
        Manage / Switch
      </Link>
    </section>
  )
}
