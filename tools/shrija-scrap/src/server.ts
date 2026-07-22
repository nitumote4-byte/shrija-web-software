import cors from 'cors'
import express from 'express'
import { listMacAddresses, machineLabel, primaryMac } from './mac.js'
import { fetchManakWithBrowser } from './manakPlaywright.js'

export const DEFAULT_PORT = Number(process.env.SHRIJA_SCRAP_PORT || 19876)

/** In-flight fetch lock — one browser at a time */
let busy = false

export function createScrapServer() {
  const app = express()
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '2mb' }))

  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Shrija Scrap Tool</title></head>
<body style="font-family:system-ui;padding:1.5rem;line-height:1.5;max-width:40rem">
  <h1>Shrija Scrap Tool</h1>
  <p>Local agent is <strong>running</strong> on port ${DEFAULT_PORT}.</p>
  <p>Keep this window open. In Shrija Auto Request, click <strong>Fetch Request</strong>.</p>
  <p>Health: <a href="/health">/health</a></p>
</body></html>`)
  })

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'shrija-scrap',
      version: '1.0.0',
      busy,
      mac: primaryMac(),
      macs: listMacAddresses(),
      machine: machineLabel(),
      port: DEFAULT_PORT,
    })
  })

  app.get('/mac', (_req, res) => {
    res.json({ mac: primaryMac(), macs: listMacAddresses(), machine: machineLabel() })
  })

  app.post('/fetch', async (req, res) => {
    if (busy) {
      res.status(409).json({ error: 'Scrap tool is already fetching. Wait for the browser window.' })
      return
    }

    const username = String(req.body?.username || '').trim()
    const password = String(req.body?.password || '')
    const baseUrl = String(req.body?.baseUrl || 'https://huid.manakonline.in').trim()
    const night = String(req.body?.night || 'Night')
    const loginTimeoutSec = Number(req.body?.loginTimeoutSec || 180)
    const postLoginWaitSec = Number(req.body?.postLoginWaitSec || 150)
    const headed = req.body?.headed !== false

    if (!username || !password) {
      res.status(400).json({ error: 'username and password required' })
      return
    }

    // Optional MAC gate — if client sends allowedMacs, enforce
    const allowedRaw = req.body?.allowedMacs
    if (typeof allowedRaw === 'string' && allowedRaw.trim()) {
      const allowed = allowedRaw
        .split(',')
        .map((s: string) => s.trim().toUpperCase().replace(/:/g, '-'))
        .filter(Boolean)
      const local = listMacAddresses()
      const ok = allowed.some((m) => local.includes(m))
      if (allowed.length && !ok) {
        res.status(403).json({
          error: `This PC MAC is not allowed. Local: ${local.join(', ') || 'none'} · Allowed: ${allowed.join(', ')}`,
        })
        return
      }
    }

    busy = true
    try {
      const result = await fetchManakWithBrowser({
        username,
        password,
        baseUrl,
        loginTimeoutSec,
        postLoginWaitSec,
        headed,
      })
      res.json({ ...result, night, mac: primaryMac() })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Scrap failed'
      res.status(500).json({ error: message, source: 'scrap-tool' })
    } finally {
      busy = false
    }
  })

  return app
}
