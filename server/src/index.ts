import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { dataRouter } from './routes/data.js'
import { initDb, isDbReady, getLastDbError, ensureDb, databaseUrlPreview } from './db.js'

const app = express()
const PORT = Number(process.env.PORT || 8787)

// Railway / Vercel reverse proxies — needed for correct rate-limit IP
app.set('trust proxy', 1)

const corsOrigin = process.env.CORS_ORIGIN
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

/** Always 200 once HTTP is up — also tries DB connect so status is fresh */
app.get('/api/health', async (_req, res) => {
  if (!isDbReady()) {
    await ensureDb()
  }
  res.json({
    ok: true,
    service: 'shrija-api',
    tenantEnforcement: true,
    dbReady: isDbReady(),
    hasDatabaseUrl: Boolean(databaseUrlPreview()),
    databaseUrlPreview: databaseUrlPreview(),
    dbError: isDbReady() ? null : getLastDbError(),
  })
})

app.use('/api/auth', (req, res, next) => {
  if (!isDbReady() && req.path !== '/tenants') {
    // still allow tenants list after ready; block early if not ready
  }
  if (!isDbReady()) {
    res.status(503).json({
      error: 'Database is starting or DATABASE_URL is missing. Add Railway Postgres and link DATABASE_URL.',
    })
    return
  }
  next()
})
app.use('/api/auth', authRouter)

app.use('/api/data', (req, res, next) => {
  if (!isDbReady()) {
    res.status(503).json({
      error: 'Database is starting or DATABASE_URL is missing. Add Railway Postgres and link DATABASE_URL.',
    })
    return
  }
  next()
})
app.use('/api/data', dataRouter)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = (err as { status?: number })?.status || 500
  const message = err instanceof Error ? err.message : 'Server error'
  console.error(err)
  res.status(status).json({ error: message })
})

async function main() {
  if (!process.env.JWT_SECRET) {
    console.warn(
      'WARNING: JWT_SECRET is not set. Set it in Railway Variables for production.',
    )
  }

  // Listen first so Railway healthcheck passes while DB connects
  app.listen(PORT, () => {
    console.log(`Shrija API listening on port ${PORT}`)
  })

  try {
    await initDb()
    console.log('DB: PostgreSQL · Tenant isolation: JWT tenant_id')
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
