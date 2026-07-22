import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { dataRouter } from './routes/data.js'
import { initDb } from './db.js'

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
  <p>Health: <a href="/api/health">/api/health</a></p>
</body></html>`)
})

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'shrija-api',
    tenantEnforcement: true,
    db: 'postgres',
  })
})

app.use('/api/auth', authRouter)
app.use('/api/data', dataRouter)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = (err as { status?: number })?.status || 500
  const message = err instanceof Error ? err.message : 'Server error'
  console.error(err)
  res.status(status).json({ error: message })
})

async function main() {
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production')
  }
  await initDb()
  app.listen(PORT, () => {
    console.log(`Shrija API listening on port ${PORT}`)
    console.log('DB: PostgreSQL · Tenant isolation: JWT tenant_id')
  })
}

main().catch((err) => {
  console.error('Failed to start server', err)
  process.exit(1)
})
