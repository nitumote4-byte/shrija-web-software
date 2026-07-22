import { useEffect, useState } from 'react'

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 2600)
    return () => clearTimeout(t)
  }, [message])

  const toast = (msg: string) => setMessage(msg)

  const Toast = message ? <div className="toast">{message}</div> : null

  return { toast, Toast }
}

export function statusBadge(status: string) {
  const map: Record<string, string> = {
    Pending: 'badge-pending',
    'In Progress': 'badge-progress',
    Assayed: 'badge-done',
    Hallmarked: 'badge-done',
    Billed: 'badge-billed',
    Delivered: 'badge-done',
    Unpaid: 'badge-pending',
    Paid: 'badge-done',
    Partial: 'badge-progress',
    'In Lab': 'badge-progress',
    Completed: 'badge-done',
    Accepted: 'badge-done',
    Rejected: 'badge-danger',
  }
  return <span className={`badge ${map[status] ?? 'badge-progress'}`}>{status}</span>
}
