import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

let _pool: pg.Pool | null = null
let dbReady = false
let lastDbError: string | null = null

export function isDbReady() {
  return dbReady
}

export function getLastDbError() {
  return lastDbError
}

/** Redacted preview for health diagnostics */
export function databaseUrlPreview() {
  const url = databaseUrl()
  if (!url) return null
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.username ? '***' : ''}@${u.hostname}:${u.port || '5432'}${u.pathname}`
  } catch {
    return url.slice(0, 32) + (url.length > 32 ? '…' : '')
  }
}

function databaseUrl() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.DATABASE_PUBLIC_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ''
  return raw.trim().replace(/^["']|["']$/g, '')
}

export function getPool(): pg.Pool {
  if (_pool) return _pool
  let url = databaseUrl()
  if (!url) {
    throw Object.assign(new Error('DATABASE_URL is not configured'), { status: 503 })
  }
  if (url.includes('${') || url.includes('{{')) {
    throw Object.assign(
      new Error(
        'DATABASE_URL still has unexpanded ${{VAR}} placeholders. Use Railway Variable Reference or paste a full postgresql:// URL.',
      ),
      { status: 503 },
    )
  }
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    throw Object.assign(
      new Error('DATABASE_URL must start with postgresql:// or postgres://'),
      { status: 503 },
    )
  }
  // Do NOT append sslmode=require in the URL — newer pg treats it as verify-full and can hang.
  // Use Pool ssl config instead.
  const needsSsl =
    process.env.PGSSL !== 'false' &&
    (process.env.NODE_ENV === 'production' ||
      /railway|amazonaws|render|neon|supabase|rlwy/i.test(url))

  _pool = new Pool({
    connectionString: url.split('?')[0], // strip any broken sslmode query
    connectionTimeoutMillis: 8000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  })
  return _pool
}

export function resetPool() {
  if (_pool) {
    void _pool.end().catch(() => {})
    _pool = null
  }
  dbReady = false
}

/** Call from health / requests — creates schema if needed */
export async function ensureDb() {
  if (dbReady) {
    try {
      await getPool().query('SELECT 1')
      return true
    } catch (e) {
      lastDbError = e instanceof Error ? e.message : String(e)
      resetPool()
    }
  }
  try {
    await initDb(2, 1000)
    return true
  } catch (e) {
    lastDbError = e instanceof Error ? e.message : String(e)
    return false
  }
}

/** Lazy proxy so routes can `import { pool }` before DB is ready */
export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop, receiver) {
    const real = getPool()
    const value = Reflect.get(real, prop, receiver)
    return typeof value === 'function' ? value.bind(real) : value
  },
})

export async function initDb(retries = 8, delayMs = 2000) {
  const url = databaseUrl()
  if (!url) {
    lastDbError = 'DATABASE_URL is not set'
    throw new Error(
      'DATABASE_URL is required. On Railway: add a PostgreSQL service and reference DATABASE_URL on this service.',
    )
  }

  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const p = getPool()
      // node-pg does NOT allow multiple statements in one query — run separately
      await p.query(`
        CREATE TABLE IF NOT EXISTS tenants (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          firm_name TEXT NOT NULL,
          gstin TEXT NOT NULL DEFAULT '',
          plan TEXT NOT NULL DEFAULT 'trial',
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      await p.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          username TEXT NOT NULL,
          role TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          is_admin BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (tenant_id, username)
        )
      `)
      await p.query(`
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
        )
      `)
      await p.query(`
        CREATE TABLE IF NOT EXISTS store_docs (
          tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      await p.query(`
        CREATE TABLE IF NOT EXISTS kv_docs (
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          key TEXT NOT NULL,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (tenant_id, key)
        )
      `)
      await p.query(`CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id)`)
      await p.query(`CREATE INDEX IF NOT EXISTS idx_kv_tenant ON kv_docs(tenant_id)`)

      dbReady = true
      lastDbError = null
      console.log(`PostgreSQL ready (attempt ${attempt})`)
      return
    } catch (e) {
      lastError = e
      lastDbError = e instanceof Error ? e.message : String(e)
      console.error(`DB init attempt ${attempt}/${retries} failed:`, lastDbError)
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  }
  throw lastError
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
  const client = await getPool().connect()
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
