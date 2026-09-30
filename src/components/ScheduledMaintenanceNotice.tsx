import { X } from 'lucide-react'
import { useId } from 'react'
import {
  SCHEDULED_MAINTENANCE_COPY,
  type PresentedScheduledMaintenance,
} from '../scheduledMaintenanceNotice'

export function ScheduledMaintenanceNoticeCard({
  notice,
  onDismiss,
}: {
  notice: PresentedScheduledMaintenance
  onDismiss?: () => void
}) {
  const titleId = useId()
  const copy = SCHEDULED_MAINTENANCE_COPY

  return (
    <article className="sched-notice" aria-labelledby={titleId} data-scheduled-maintenance-notice="">
      {onDismiss ? (
        <button
          type="button"
          className="sched-notice-dismiss"
          onClick={onDismiss}
          aria-label="Close notice / सूचना बंद करें"
        >
          <X size={16} aria-hidden />
        </button>
      ) : null}
      <h2 id={titleId} className={`sched-notice-title${onDismiss ? ' has-dismiss' : ''}`}>
        <span aria-hidden="true">📢 </span>
        <span lang="en">{copy.titleEn}</span>
        <span aria-hidden="true"> / </span>
        <span lang="hi">{copy.titleHi}</span>
      </h2>
      {notice.dateLabel || notice.timeLabel ? (
        <dl className="sched-notice-meta">
          {notice.dateLabel ? (
            <div>
              <dt>
                <span lang="en">Date</span>
                <span aria-hidden="true"> / </span>
                <span lang="hi">दिनांक</span>:
              </dt>
              <dd>{notice.dateLabel}</dd>
            </div>
          ) : null}
          {notice.timeLabel ? (
            <div>
              <dt>
                <span lang="en">Time</span>
                <span aria-hidden="true"> / </span>
                <span lang="hi">समय</span>:
              </dt>
              <dd>{notice.timeLabel}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <p className="sched-notice-kicker">
        <span lang="en">Notice</span>
        <span aria-hidden="true"> / </span>
        <span lang="hi">सूचना</span>:
      </p>
      <p className="sched-notice-message" lang="en">
        {notice.messageEn}
      </p>
      <p className="sched-notice-message" lang="hi">
        {notice.messageHi}
      </p>
      <p className="sched-notice-thanks">
        <span lang="en">{copy.thanksEn}</span>
        <span aria-hidden="true"> / </span>
        <span lang="hi">{copy.thanksHi}</span>
      </p>
    </article>
  )
}
