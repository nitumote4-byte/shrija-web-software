import './loadEnv.js'
import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { dataRouter } from './routes/data.js'
import { manakRouter } from './routes/manak.js'
import { licenseRouter } from './routes/license.js'
import { adminRouter } from './routes/admin.js'
import { initDb, isDbReady, getLastDbError, ensureDb, databaseUrlPreview } from './db.js'

const app = express()
const PORT = Number(process.env.PORT || 8787)

// Railway / Vercel reverse proxies — needed for correct rate-limit IP
app.set('trust proxy', 1)

const corsOrigin = process.env.CORS_ORIGIN
if (process.env.NODE_ENV === 'production' && !corsOrigin) {
  console.error('CORS_ORIGIN is required in production')
  process.exit(1)
}
app.use(
  cors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((s) => s.trim()).filter(Boolean)
      : true,
    credentials: true,
  }),
)
app.use(express.json({ limit: '8mb' }))

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Shrija API</title></head>
<body style="font-family:system-ui;padding:2rem;line-height:1.5">
  <h1>Shrija API</h1>
  <p>Backend is running (PostgreSQL + tenant_id enforcement).</p>
  <p>DB ready: <strong>${isDbReady() ? 'yes' : 'no'}</strong></p>
  <p>Health: <a href="/api/health">/api/health</a></p>
</body></html>`)
})

function dbNotReadyMessage() {
  if (process.env.NODE_ENV === 'production') {
    return 'Database is starting or DATABASE_URL is missing. Add Railway Postgres and link DATABASE_URL.'
  }
  const detail = getLastDbError()
  const safeDetail =
    detail && !/postgres(ql)?:\/\//i.test(detail) ? ` (${detail})` : ''
  return `Database is not ready${safeDetail}. Local Postgres is started by npm run dev (Docker Compose). Confirm DATABASE_URL is set in server/.env and check GET /api/health.`
}

async function requireDb(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!isDbReady()) {
    await ensureDb()
  }
  if (!isDbReady()) {
    res.status(503).json({ error: dbNotReadyMessage() })
    return
  }
  next()
}

/** Always 200 once HTTP is up — also tries DB connect so status is fresh */
app.get('/api/health', async (_req, res) => {
  if (!isDbReady()) {
    await ensureDb()
  }
  const dbReady = isDbReady()
  if (process.env.NODE_ENV === 'production') {
    res.json({
      ok: true,
      ready: dbReady,
      service: 'shrija-api',
    })
    return
  }
  res.json({
    ok: true,
    ready: dbReady,
    service: 'shrija-api',
    tenantEnforcement: true,
    dbReady,
    hasDatabaseUrl: Boolean(databaseUrlPreview()),
    databaseUrlPreview: databaseUrlPreview(),
    dbError: dbReady ? null : getLastDbError(),
    features: { license: true },
    commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT || null,
    hasLicenseMaster: Boolean(process.env.LICENSE_MASTER_SECRET),
  })
})

app.use('/api/auth', requireDb)
app.use('/api/auth', authRouter)

app.use('/api/license', requireDb)
app.use('/api/license', licenseRouter)
// Alias under /api/auth so older proxies / caches that only know auth still reach licence APIs
app.use('/api/auth/license', licenseRouter)

app.use('/api/admin', requireDb)
app.use('/api/admin', adminRouter)

app.use('/api/data', requireDb)
app.use('/api/data', dataRouter)
app.use('/api/data/manak', requireDb)
app.use('/api/data/manak', manakRouter)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = (err as { status?: number })?.status || 500
  console.error(err)
  const expose = process.env.NODE_ENV !== 'production' || status < 500
  const message =
    expose && err instanceof Error && err.message && !/postgres(ql)?:\/\//i.test(err.message)
      ? err.message
      : 'Server error'
  res.status(status).json({ error: message })
})

async function main() {
  if (process.env.NODE_ENV === 'production') {
    const missing: string[] = []
    if (!process.env.JWT_SECRET) missing.push('JWT_SECRET')
    if (!process.env.LICENSE_MASTER_SECRET) missing.push('LICENSE_MASTER_SECRET')
    if (!process.env.CORS_ORIGIN) missing.push('CORS_ORIGIN')
    if (missing.length) {
      console.error(`Missing required production env: ${missing.join(', ')}`)
      process.exit(1)
    }
  } else {
    if (!process.env.JWT_SECRET) {
      console.warn(
        'WARNING: JWT_SECRET is not set. Set it in Railway Variables for production.',
      )
    }
    if (!process.env.LICENSE_MASTER_SECRET) {
      console.warn(
        'WARNING: LICENSE_MASTER_SECRET is not set. Set a separate LICENSE_MASTER_SECRET in production (do not reuse JWT_SECRET).',
      )
    }
  }
  if (!process.env.MAIL_HOST || !process.env.MAIL_FROM) {
    console.warn(
      'WARNING: MAIL_HOST / MAIL_FROM are not set. Forgot-password email reset is disabled until SMTP is configured.',
    )
  }

  // Listen first so Railway healthcheck passes while DB connects
  app.listen(PORT, () => {
    console.log(`Shrija API listening on port ${PORT}`)
  })

  try {
    await initDb()
    console.log('DB: PostgreSQL · Tenant isolation: JWT tenant_id (client tenant/centre IDs ignored)')
  } catch (err) {
    console.error('PostgreSQL init failed — API is up but /api/auth and /api/data will return 503')
    console.error(err)
    // Keep retrying in background so linking DATABASE_URL later can recover without full redeploy
    const retry = async () => {
      for (;;) {
        await new Promise((r) => setTimeout(r, 15000))
        if (isDbReady()) return
        try {
          await initDb(3, 2000)
          console.log('DB recovered after retry')
          return
        } catch (e) {
          console.error('DB retry failed:', e instanceof Error ? e.message : e)
        }
      }
    }
    void retry()
  }
}

main().catch((err) => {
  console.error('Failed to start server', err)
  process.exit(1)
})
