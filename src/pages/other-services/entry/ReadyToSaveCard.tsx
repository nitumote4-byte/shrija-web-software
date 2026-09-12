export function ReadyToSaveCard({ editing }: { editing: boolean }) {
  return (
    <div className="nse-ready" aria-hidden="true">
      <span className="nse-ready-sparkle nse-ready-sparkle-a" />
      <span className="nse-ready-sparkle nse-ready-sparkle-b" />
      <span className="nse-ready-sparkle nse-ready-sparkle-c" />
      <div className="nse-ready-emoji" aria-hidden>
        🎁
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
