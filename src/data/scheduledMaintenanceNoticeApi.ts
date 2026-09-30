import { api } from '../api/client'
import {
  sanitizeScheduledMaintenanceDraft,
  type ScheduledMaintenanceDraft,
} from '../scheduledMaintenanceNotice'

export async function fetchScheduledMaintenanceNotice(): Promise<ScheduledMaintenanceDraft | null> {
  try {
    const body = await api<{ notice?: unknown }>('/api/scheduled-maintenance')
    if (!body?.notice) return null
    const parsed = sanitizeScheduledMaintenanceDraft(body.notice)
    return parsed.ok ? parsed.draft : null
  } catch {
    return null
  }
}

export async function loadScheduledMaintenanceDraft(
  masterSecret: string,
): Promise<ScheduledMaintenanceDraft> {
  const body = await api<{ notice?: unknown }>('/api/admin/scheduled-maintenance/current', {
    method: 'POST',
    json: { masterSecret },
  })
  const parsed = sanitizeScheduledMaintenanceDraft(body?.notice ?? {})
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.draft
}

export async function saveScheduledMaintenanceDraft(
  masterSecret: string,
  draft: ScheduledMaintenanceDraft,
): Promise<ScheduledMaintenanceDraft> {
  const body = await api<{ notice?: unknown }>('/api/admin/scheduled-maintenance', {
    method: 'POST',
    json: { masterSecret, ...draft },
  })
  const parsed = sanitizeScheduledMaintenanceDraft(body?.notice ?? draft)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.draft
}
