import { ArrowLeft, ArrowRight, Eraser, Printer, Save } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ServiceEntryActions({
  editing,
  saving,
  onClear,
}: {
  editing: boolean
  saving: boolean
  onClear: () => void
}) {
  return (
    <div className="nse-actions">
      <div className="nse-actions-left">
        <button type="submit" name="intent" value="print" className="nse-btn nse-btn-primary" disabled={saving}>
          <Printer size={16} />
          {saving ? 'Saving…' : editing ? 'Update & Print Receipt' : 'Save & Print Receipt'}
          <ArrowRight size={16} />
        </button>
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
