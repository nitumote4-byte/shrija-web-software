import { ArrowLeft, Eraser, Printer, Save } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ServiceEntryActions({
  editing,
  saving,
  onClear,
  compact,
}: {
  editing: boolean
  saving: boolean
  onClear: () => void
  /** When true, primary Save & Print lives in the aside — show secondary actions only. */
  compact?: boolean
}) {
  return (
    <div className={`nse-actions${compact ? ' nse-actions-compact' : ''}`}>
      <div className="nse-actions-left">
        {!compact ? (
          <button type="submit" name="intent" value="print" className="nse-btn nse-btn-primary" disabled={saving}>
            <Printer size={16} />
            {saving ? 'Saving…' : editing ? 'Update & Print Receipt' : 'Save & Print Receipt'}
          </button>
        ) : null}
        <button type="submit" name="intent" value="save" className="nse-btn nse-btn-secondary" disabled={saving}>
          <Save size={15} />
          {editing ? 'Update Only' : 'Save Only'}
        </button>
        <button type="button" className="nse-btn nse-btn-ghost" onClick={onClear} disabled={saving}>
          <Eraser size={15} />
          Clear Form
        </button>
      </div>
      <Link to="/other-services/records" className="nse-btn nse-btn-back">
        <ArrowLeft size={16} /> Back to Records
      </Link>
    </div>
  )
}

export function SavePrintAsideButton({
  editing,
  saving,
}: {
  editing: boolean
  saving: boolean
}) {
  return (
    <button
      type="submit"
      name="intent"
      value="print"
      className="nse-btn nse-btn-primary nse-btn-save-print"
      disabled={saving}
    >
      <Printer size={18} strokeWidth={2.1} />
      {saving ? 'Saving…' : editing ? 'Update & Print Receipt' : 'Save & Print Receipt'}
    </button>
  )
}
