import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required. Set it to your PostgreSQL connection string (Railway Postgres or local).',
  )
}

export const pool = new Pool({
  connectionString: databaseUrl,
  // Railway / managed Postgres often need SSL in production
  ssl:
    process.env.PGSSL === 'false'
      ? false
      : process.env.NODE_ENV === 'production' || databaseUrl.includes('railway')
        ? { rejectUnauthorized: false }
        : undefined,
})

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      firm_name TEXT NOT NULL,
      gstin TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT 'trial',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, username)
    );

    CREATE TABLE IF NOT EXISTS firm_profiles (
      tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      firm_name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      gst_no TEXT NOT NULL DEFAULT '',
      bank_name TEXT NOT NULL DEFAULT '',
      account_no TEXT NOT NULL DEFAULT '',
      ifsc TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS store_docs (
      tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS kv_docs (
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tenant_id, key)
    );

    CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_kv_tenant ON kv_docs(tenant_id);
  `)
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function nowIso() {
  return new Date().toISOString()
}

export function emptyStorePayload() {
  return {
    parties: [],
    categories: defaultCategories(),
    requests: [],
    roughSheets: [],
    pendingRough: [],
    invoices: [],
    funds: [],
    expenses: [],
    fireAssays: [],
    stock: [],
    touches: [],
    xray: [],
  }
}

function defaultCategories() {
  return [
    { id: 'c1', name: 'Gold Jewellery', purity: '916', metal: 'Gold', rate: 45 },
    { id: 'c2', name: 'Gold Coin', purity: '999', metal: 'Gold', rate: 40 },
    { id: 'c3', name: 'Silver Jewellery', purity: '925', metal: 'Silver', rate: 25 },
  ]
}

export function assertTenantId(tenantId: string | undefined): asserts tenantId is string {
  if (!tenantId || typeof tenantId !== 'string') {
    throw Object.assign(new Error('Missing tenant context'), { status: 401 })
  }
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw e
  } finally {
    client.release()
  }
}
