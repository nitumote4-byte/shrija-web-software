import { api } from './api/client'

/** True only for an explicit `{ maintenance: true }` payload. */
export function isMaintenanceResponse(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  return (body as { maintenance?: unknown }).maintenance === true
}

/**
 * Reads GET /api/maintenance. Failures stay off so a missing or unreachable
 * flag cannot replace the normal app.
 */
export async function readMaintenanceMode(signal?: AbortSignal): Promise<boolean> {
  try {
    const body = await api<unknown>('/api/maintenance', {
      signal,
      cache: 'no-store',
    })
    return isMaintenanceResponse(body)
  } catch {
    return false
  }
}
