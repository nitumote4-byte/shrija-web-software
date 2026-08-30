import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { playNoticeBeep } from '../utils/noticeBeep'
import {
  scheduleStatusNoticeDismissal,
  STATUS_NOTICE_DURATION_MS,
} from '../utils/statusNotice'

export type StatusNoticeKind = 'error' | 'warning' | 'success' | 'info'

export type StatusNoticeData = {
  id: number
  kind: StatusNoticeKind
  title: string
  message: string
  durationMs?: number
  beep?: boolean
}

const ICONS: Record<StatusNoticeKind, ReactNode> = {
  error: <TriangleAlert size={20} strokeWidth={2.2} />,
  warning: <CircleAlert size={20} strokeWidth={2.2} />,
  success: <CircleCheck size={20} strokeWidth={2.2} />,
  info: <Info size={20} strokeWidth={2.2} />,
}

/** One beep per notice id — survives Strict Mode remounts, never loops. */
let lastBeepedNoticeId = -1

export function StatusNoticeCard({
  notice,
  onDismissed,
}: {
  notice: StatusNoticeData
  onDismissed: () => void
}) {
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const dismissedRef = useRef(onDismissed)
  dismissedRef.current = onDismissed

  const duration = notice.durationMs ?? STATUS_NOTICE_DURATION_MS
  const shouldBeep = notice.beep ?? notice.kind === 'error'

  useEffect(() => {
    setPhase('in')
    if (shouldBeep && lastBeepedNoticeId !== notice.id) {
      lastBeepedNoticeId = notice.id
      playNoticeBeep()
    }
    return scheduleStatusNoticeDismissal(
      () => setPhase('out'),
      () => dismissedRef.current(),
      duration,
    )
  }, [notice.id, duration, shouldBeep])

  return (
    <div
      className={`status-notice status-notice-${notice.kind} status-notice-${phase}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
      aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className="status-notice-icon" aria-hidden="true">
        {ICONS[notice.kind]}
      </span>
      <div className="status-notice-copy">
        <strong className="status-notice-title">{notice.title}</strong>
        <p className="status-notice-message">{notice.message}</p>
      </div>
    </div>
  )
}

export function useStatusNotice() {
  const [notice, setNotice] = useState<StatusNoticeData | null>(null)
  const seq = useRef(0)

  const showNotice = (data: Omit<StatusNoticeData, 'id'>) => {
    seq.current += 1
    setNotice({ ...data, id: seq.current })
  }

  const Notice = notice ? (
    <StatusNoticeCard
      key={notice.id}
      notice={notice}
      onDismissed={() => setNotice((current) => (current?.id === notice.id ? null : current))}
    />
  ) : null

  return { showNotice, Notice }
}
