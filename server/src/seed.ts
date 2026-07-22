/**
 * Optional seed: creates Centre A if DB has no tenants.
 * Requires DATABASE_URL. Run: npm run seed
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
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
const hash = bcrypt.hashSync('admin123', 10)
const labHash = bcrypt.hashSync('smg123', 10)
const demoExpires = addDaysIso(new Date(), 365)

await withTransaction(async (client) => {
  await client.query(
    `INSERT INTO tenants (id, slug, firm_name, gstin, plan, status, created_at, license_expires_at, max_users)
     VALUES ($1, 'centre-a', $2, '', 'demo', 'active', $3, $4, 20)`,
    [tenantId, firmName, createdAt, demoExpires],
  )
  await client.query(
    `INSERT INTO users (id, tenant_id, username, role, password_hash, is_admin, created_at)
     VALUES ($1, $2, 'qm_admin', 'quality_manager', $3, TRUE, $4)`,
    [userId, tenantId, hash, createdAt],
  )
  await client.query(
    `INSERT INTO users (id, tenant_id, username, role, password_hash, is_admin, created_at)
     VALUES ($1, $2, 'SMG', 'assay_lab', $3, FALSE, $4)`,
    [uid('usr'), tenantId, labHash, createdAt],
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

console.log('Seeded Centre A')
console.log('  Login: select centre → qm_admin / admin123')
console.log(`  tenantId: ${tenantId}`)
await pool.end()
