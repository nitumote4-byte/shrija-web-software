/**
 * Optional seed: creates Centre A if DB has no tenants.
 * Requires DATABASE_URL. Run: npm run seed
 *
 * Prints a one-time admin password. Do not reuse it in production.
 */
import './loadEnv.js'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { emptyStorePayload, initDb, nowIso, pool, uid, withTransaction } from './db.js'
import { addDaysIso } from './license.js'

await initDb()

const countRes = await pool.query(`SELECT COUNT(*)::int AS c FROM tenants`)
const count = (countRes.rows[0] as { c: number }).c
if (count > 0) {
  console.log(`DB already has ${count} tenant(s) — skip seed`)
  await pool.end()
  process.exit(0)
}

const tenantId = uid('tn')
const userId = uid('usr')
const createdAt = nowIso()
const firmName = 'Shrija Hallmarking Centre A'
const adminPassword = crypto.randomBytes(12).toString('base64url')
const hash = bcrypt.hashSync(adminPassword, 10)
const demoExpires = addDaysIso(new Date(), 365)

await withTransaction(async (client) => {
  await client.query(
    `INSERT INTO tenants (id, slug, firm_name, gstin, plan, status, created_at, license_expires_at, max_users)
     VALUES ($1, 'centre-a', $2, '', 'demo', 'active', $3, $4, 20)`,
    [tenantId, firmName, createdAt, demoExpires],
  )
  await client.query(
    `INSERT INTO users (id, tenant_id, username, role, password_hash, is_admin, created_at, must_change_password)
     VALUES ($1, $2, 'qm_admin', 'quality_manager', $3, TRUE, $4, TRUE)`,
    [userId, tenantId, hash, createdAt],
  )
  await client.query(
    `INSERT INTO firm_profiles
     (tenant_id, firm_name, email, address, gst_no, bank_name, account_no, ifsc, city, state, updated_at)
     VALUES ($1, $2, '', '', '', '', '', '', '', '', $3)`,
    [tenantId, firmName, createdAt],
  )
  await client.query(
    `INSERT INTO store_docs (tenant_id, payload, updated_at) VALUES ($1, $2::jsonb, $3)`,
    [tenantId, JSON.stringify(emptyStorePayload()), createdAt],
  )
})

console.log('Seeded Centre A (local/demo only)')
console.log('  Login: qm_admin')
console.log(`  One-time password: ${adminPassword}`)
console.log('  You will be asked to change this password on first sign-in.')
console.log('  Lab users are not created automatically — add them in Access Management.')
console.log(`  tenantId (server-assigned): ${tenantId}`)
await pool.end()
