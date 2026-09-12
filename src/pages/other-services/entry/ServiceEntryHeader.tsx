import { CalendarDays, ClipboardPen } from 'lucide-react'
import { formatChipDate } from './format'

export function ServiceEntryHeader({
  editing,
  slipNo,
  date,
}: {
  editing: boolean
  slipNo?: string
  date: string
}) {
  return (
    <header className="nse-hero">
      <div className="nse-hero-left">
        <div className="nse-hero-icon" aria-hidden>
          <ClipboardPen size={22} strokeWidth={1.75} />
        </div>
        <div>
          <h1>{editing ? 'Edit Service Entry' : 'New Service Entry'}</h1>
          <p>Fill customer and service details, save, then print the receipt.</p>
          {editing && slipNo ? <span className="nse-slip-pill">Slip {slipNo}</span> : null}
        </div>
      </div>
      <div className="nse-date-chip" title="Selected date">
        <CalendarDays size={16} strokeWidth={2} />
        <span>{formatChipDate(date)}</span>
      </div>
    </header>
  )
}
