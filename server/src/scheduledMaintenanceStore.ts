import { pool } from './db.js'
import {
  EMPTY_SCHEDULED_MAINTENANCE,
  isScheduledMaintenanceVisible,
  type ScheduledMaintenanceDraft,
} from './scheduledMaintenanceNotice.js'

const ROW_ID = 'current'

type NoticeRow = {
  enabled: boolean
  notice_date: string | null
  start_time: string | null
  end_time: string | null
  message_en: string | null
  message_hi: string | null
}

function fromRow(row: NoticeRow): ScheduledMaintenanceDraft {
  return {
    enabled: row.enabled === true,
    date: row.notice_date || '',
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    messageEn: row.message_en || '',
    messageHi: row.message_hi || '',
  }
}

export async function readScheduledMaintenanceDraft(): Promise<ScheduledMaintenanceDraft> {
  const { rows } = await pool.query(
    `SELECT enabled, notice_date, start_time, end_time, message_en, message_hi
     FROM scheduled_maintenance_notice
     WHERE id = $1`,
    [ROW_ID],
  )
  const row = rows[0] as NoticeRow | undefined
  if (!row) return { ...EMPTY_SCHEDULED_MAINTENANCE }
  return fromRow(row)
}

export async function writeScheduledMaintenanceDraft(draft: ScheduledMaintenanceDraft): Promise<void> {
  await pool.query(
    `INSERT INTO scheduled_maintenance_notice
       (id, enabled, notice_date, start_time, end_time, message_en, message_hi, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       notice_date = EXCLUDED.notice_date,
       start_time = EXCLUDED.start_time,
       end_time = EXCLUDED.end_time,
       message_en = EXCLUDED.message_en,
       message_hi = EXCLUDED.message_hi,
       updated_at = NOW()`,
    [ROW_ID, draft.enabled, draft.date, draft.startTime, draft.endTime, draft.messageEn, draft.messageHi],
  )
}

/** Public payload. Hidden, disabled, and expired notices are omitted. */
export async function readPublicScheduledMaintenanceNotice(): Promise<ScheduledMaintenanceDraft | null> {
  const draft = await readScheduledMaintenanceDraft()
  return isScheduledMaintenanceVisible(draft) ? draft : null
}
