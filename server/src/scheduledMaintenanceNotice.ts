/**
 * Scheduled-maintenance notice copy and schedule rules.
 * Independent of Maintenance Mode and the 503 screen.
 * Date and time are interpreted as India Standard Time (UTC+05:30).
 */

export const SCHEDULED_MAINTENANCE_COPY = {
  titleEn: 'Scheduled Maintenance',
  titleHi: 'निर्धारित रखरखाव',
  dateLabel: 'Date / दिनांक',
  timeLabel: 'Time / समय',
  noticeLabel: 'Notice / सूचना',
  thanksEn: 'Thank you for your cooperation.',
  thanksHi: 'आपके सहयोग के लिए धन्यवाद।',
} as const

/** Used only when an administrator leaves that language blank. */
export const DEFAULT_MAINTENANCE_MESSAGE_EN =
  'The application will be temporarily unavailable during this maintenance period. Please complete pending work before the start time and sign in again after maintenance has concluded.'

export const DEFAULT_MAINTENANCE_MESSAGE_HI =
  'निर्धारित रखरखाव अवधि के दौरान यह प्रणाली अस्थायी रूप से उपलब्ध नहीं रहेगी। कृपया प्रारंभ समय से पूर्व लंबित कार्य पूर्ण कर लें तथा रखरखाव समाप्त होने के पश्चात पुनः प्रवेश करें।'

export type ScheduledMaintenanceDraft = {
  enabled: boolean
  /** Calendar date YYYY-MM-DD, or empty. */
  date: string
  /** 24-hour HH:mm, or empty. */
  startTime: string
  /** 24-hour HH:mm, or empty. */
  endTime: string
  messageEn: string
  messageHi: string
}

export const EMPTY_SCHEDULED_MAINTENANCE: ScheduledMaintenanceDraft = {
  enabled: false,
  date: '',
  startTime: '',
  endTime: '',
  messageEn: '',
  messageHi: '',
}

export type PresentedScheduledMaintenance = {
  dateLabel: string
  timeLabel: string
  messageEn: string
  messageHi: string
  fingerprint: string
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const MAX_MESSAGE = 1000

const ERRORS = {
  invalid: 'Scheduled maintenance notice is invalid.',
  date: 'Enter a valid maintenance date.',
  start: 'Enter a valid start time.',
  end: 'Enter a valid end time.',
  order: 'End time must be later than the start time.',
  en: 'English notice must be 1000 characters or fewer.',
  hi: 'Hindi notice must be 1000 characters or fewer.',
} as const

export function isCalendarDate(value: string): boolean {
  const match = DATE_RE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
}

/** DD Month YYYY, for example 30 September 2026. */
export function formatMaintenanceDate(isoDate: string): string {
  if (!isCalendarDate(isoDate)) return ''
  const match = DATE_RE.exec(isoDate)
  if (!match) return ''
  const day = match[3]
  const month = MONTHS[Number(match[2]) - 1]
  return `${day} ${month} ${match[1]}`
}

/** 12-hour clock with AM/PM, for example 09:30 AM. */
export function formatMaintenanceClock(hhmm: string): string {
  const match = TIME_RE.exec(hhmm)
  if (!match) return ''
  const hour = Number(match[1])
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${String(hour12).padStart(2, '0')}:${match[2]} ${suffix}`
}

export function formatMaintenanceTimeRange(startTime: string, endTime: string): string {
  const start = formatMaintenanceClock(startTime)
  const end = formatMaintenanceClock(endTime)
  if (start && end) return `${start} – ${end}`
  return start || end
}

/** End of the published window in IST. Null when no calendar date is set. */
export function maintenanceWindowEnd(draft: ScheduledMaintenanceDraft): Date | null {
  if (!isCalendarDate(draft.date)) return null
  const time = TIME_RE.test(draft.endTime) ? draft.endTime : '23:59'
  const instant = new Date(`${draft.date}T${time}:00+05:30`)
  return Number.isNaN(instant.getTime()) ? null : instant
}

export function isScheduledMaintenanceVisible(
  draft: ScheduledMaintenanceDraft,
  now = new Date(),
): boolean {
  if (!draft.enabled) return false
  const end = maintenanceWindowEnd(draft)
  if (!end) return true
  return now.getTime() <= end.getTime()
}

export function presentScheduledMaintenance(
  draft: ScheduledMaintenanceDraft,
  now = new Date(),
  options?: { preview?: boolean },
): PresentedScheduledMaintenance | null {
  if (!options?.preview && !isScheduledMaintenanceVisible(draft, now)) return null
  const messageEn = draft.messageEn.trim() || DEFAULT_MAINTENANCE_MESSAGE_EN
  const messageHi = draft.messageHi.trim() || DEFAULT_MAINTENANCE_MESSAGE_HI
  return {
    dateLabel: formatMaintenanceDate(draft.date),
    timeLabel: formatMaintenanceTimeRange(draft.startTime, draft.endTime),
    messageEn,
    messageHi,
    fingerprint: [draft.date, draft.startTime, draft.endTime, messageEn, messageHi].join('\u001f'),
  }
}

function cleanMessage(value: string): string {
  let out = ''
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    if (code === 13) continue
    if (code < 32 && code !== 10) continue
    out += ch
  }
  return out.trim()
}

function normalizeTime(value: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value.trim())
  if (!match) return value.trim()
  return `${match[1]}:${match[2]}`
}

export function sanitizeScheduledMaintenanceDraft(
  input: unknown,
): { ok: true; draft: ScheduledMaintenanceDraft } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: ERRORS.invalid }
  const body = input as Record<string, unknown>
  const date = typeof body.date === 'string' ? body.date.trim() : ''
  const startTime = typeof body.startTime === 'string' ? normalizeTime(body.startTime) : ''
  const endTime = typeof body.endTime === 'string' ? normalizeTime(body.endTime) : ''
  const messageEn = typeof body.messageEn === 'string' ? cleanMessage(body.messageEn) : ''
  const messageHi = typeof body.messageHi === 'string' ? cleanMessage(body.messageHi) : ''

  const enabled = body.enabled === true
  if (enabled && !date) return { ok: false, error: ERRORS.date }
  if (enabled && !startTime) return { ok: false, error: ERRORS.start }
  if (enabled && !endTime) return { ok: false, error: ERRORS.end }
  if (date && !isCalendarDate(date)) return { ok: false, error: ERRORS.date }
  if (startTime && !TIME_RE.test(startTime)) return { ok: false, error: ERRORS.start }
  if (endTime && !TIME_RE.test(endTime)) return { ok: false, error: ERRORS.end }
  if (startTime && endTime && startTime >= endTime) return { ok: false, error: ERRORS.order }
  if (messageEn.length > MAX_MESSAGE) return { ok: false, error: ERRORS.en }
  if (messageHi.length > MAX_MESSAGE) return { ok: false, error: ERRORS.hi }

  return {
    ok: true,
    draft: {
      enabled,
      date,
      startTime,
      endTime,
      messageEn,
      messageHi,
    },
  }
}
