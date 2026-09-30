import { useMemo, useState, type FormEvent } from 'react'
import { Megaphone } from 'lucide-react'
import { ScheduledMaintenanceNoticeCard } from './ScheduledMaintenanceNotice'
import {
  loadScheduledMaintenanceDraft,
  saveScheduledMaintenanceDraft,
} from '../data/scheduledMaintenanceNoticeApi'
import {
  DEFAULT_MAINTENANCE_MESSAGE_EN,
  DEFAULT_MAINTENANCE_MESSAGE_HI,
  EMPTY_SCHEDULED_MAINTENANCE,
  presentScheduledMaintenance,
  sanitizeScheduledMaintenanceDraft,
  type ScheduledMaintenanceDraft,
} from '../scheduledMaintenanceNotice'

export function ScheduledMaintenanceAdmin({
  masterSecret,
  toast,
}: {
  masterSecret: string
  toast: (message: string) => void
}) {
  const [draft, setDraft] = useState<ScheduledMaintenanceDraft>(EMPTY_SCHEDULED_MAINTENANCE)
  const [busy, setBusy] = useState(false)
  const preview = useMemo(
    () => presentScheduledMaintenance(draft, new Date(), { preview: true }),
    [draft],
  )

  const patch = (partial: Partial<ScheduledMaintenanceDraft>) => {
    setDraft((current) => ({ ...current, ...partial }))
  }

  const load = async () => {
    if (!masterSecret.trim()) {
      toast('Enter the master secret first')
      return
    }
    setBusy(true)
    try {
      setDraft(await loadScheduledMaintenanceDraft(masterSecret))
      toast('Current maintenance notice loaded')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not load the maintenance notice')
    } finally {
      setBusy(false)
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!masterSecret.trim()) {
      toast('Enter the master secret first')
      return
    }
    const parsed = sanitizeScheduledMaintenanceDraft(draft)
    if (!parsed.ok) {
      toast(parsed.error)
      return
    }
    setBusy(true)
    try {
      const saved = await saveScheduledMaintenanceDraft(masterSecret, parsed.draft)
      setDraft(saved)
      toast('Scheduled maintenance notice saved')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save the maintenance notice')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <h2>
        <Megaphone size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} aria-hidden />
        Scheduled Maintenance / निर्धारित रखरखाव
      </h2>
      <p className="auto-manak-hint">
        Write the notice for each maintenance event. The login page and the notification bell use
        this same text. Leave a language blank to keep the standard professional wording. This
        notice does not enable Maintenance Mode.
      </p>
      <form className="form-grid" onSubmit={(e) => void save(e)}>
        <div className="field">
          <label htmlFor="sched-maint-enabled">Publish notice / सूचना प्रकाशित करें</label>
          <select
            id="sched-maint-enabled"
            value={draft.enabled ? 'yes' : 'no'}
            onChange={(e) => patch({ enabled: e.target.value === 'yes' })}
          >
            <option value="no">Hidden</option>
            <option value="yes">Visible until the end time</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sched-maint-date">Date / दिनांक</label>
          <input
            id="sched-maint-date"
            type="date"
            value={draft.date}
            onChange={(e) => patch({ date: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="sched-maint-start">Start time / प्रारंभ समय</label>
          <input
            id="sched-maint-start"
            type="time"
            value={draft.startTime}
            onChange={(e) => patch({ startTime: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="sched-maint-end">End time / समाप्ति समय</label>
          <input
            id="sched-maint-end"
            type="time"
            value={draft.endTime}
            onChange={(e) => patch({ endTime: e.target.value })}
          />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="sched-maint-en">Notice (English) / सूचना (अंग्रेज़ी)</label>
          <textarea
            id="sched-maint-en"
            rows={4}
            maxLength={1000}
            value={draft.messageEn}
            placeholder={DEFAULT_MAINTENANCE_MESSAGE_EN}
            onChange={(e) => patch({ messageEn: e.target.value })}
          />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="sched-maint-hi">Notice (Hindi) / सूचना (हिन्दी)</label>
          <textarea
            id="sched-maint-hi"
            rows={4}
            maxLength={1000}
            lang="hi"
            value={draft.messageHi}
            placeholder={DEFAULT_MAINTENANCE_MESSAGE_HI}
            onChange={(e) => patch({ messageHi: e.target.value })}
          />
        </div>
        <div className="auto-manak-actions">
          <button type="submit" className="btn btn-navy" disabled={busy || !masterSecret.trim()}>
            {busy ? 'Saving…' : 'Save notice'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || !masterSecret.trim()}
            onClick={() => void load()}
          >
            Load current notice
          </button>
        </div>
      </form>
      {preview ? (
        <div className="sched-notice-preview">
          <p className="sched-notice-kicker">Preview / पूर्वावलोकन</p>
          <ScheduledMaintenanceNoticeCard notice={preview} />
        </div>
      ) : null}
    </div>
  )
}
