/**
 * One-time repair per process: admin power follows the Admin role in the
 * database, not a flag the browser can send. The oldest account is promoted
 * only when the centre has nobody in that role, so the original login is not
 * locked out.
 */
import { pool } from './db.js'
import { planCentreAdminRepair, type CentreAdminSnapshot } from './rbac.js'

const repairedTenants = new Set<string>()

export async function repairCentreAdminRoles(tenantId: string): Promise<void> {
  if (!tenantId || repairedTenants.has(tenantId)) return
  const { rows } = await pool.query(
    `SELECT id, role, COALESCE(is_admin, FALSE) AS "isAdmin", created_at AS "createdAt"
     FROM users WHERE tenant_id = $1`,
    [tenantId],
  )
  const updates = planCentreAdminRepair(rows as CentreAdminSnapshot[])
  for (const row of updates) {
    await pool.query(
      `UPDATE users SET role = $1, is_admin = $2 WHERE id = $3 AND tenant_id = $4`,
      [row.role, row.isAdmin, row.id, tenantId],
    )
  }
  repairedTenants.add(tenantId)
}
