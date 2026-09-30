/**
 * Runtime maintenance flag. Read on each request from the API process env
 * (Railway variable or server/.env). Not a frontend build variable.
 *
 * ON:  MAINTENANCE_MODE=1 | true | yes | on
 * OFF: unset, empty, or any other value (including false, 0, off)
 */
export function isMaintenanceModeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.MAINTENANCE_MODE ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}
