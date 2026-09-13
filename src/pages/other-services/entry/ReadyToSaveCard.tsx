import { Gift } from 'lucide-react'

export function ReadyToSaveCard({ editing }: { editing: boolean }) {
  return (
    <div className="nse-ready" aria-hidden="true">
      <div className="nse-ready-emoji" aria-hidden>
        <Gift size={22} strokeWidth={1.9} />
      </div>
      <strong>Ready to {editing ? 'update' : 'save'}!</strong>
      <p>
        Click below to record payment
        <br />
        and print receipt.
      </p>
    </div>
  )
}
