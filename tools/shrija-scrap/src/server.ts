import cors from 'cors'
import express from 'express'
import { listMacAddresses, machineLabel, primaryMac } from './mac.js'
import {
  fetchManakWithBrowser,
  isChromeAttached,
  SCRAP_TOOL_VERSION,
} from './manakPlaywright.js'

export const DEFAULT_PORT = Number(process.env.SHRIJA_SCRAP_PORT || 19876)

let busy = false

export function createScrapServer() {
  const app = express()
  app.use(cors({ origin: true, credentials: true }))
  app.use(express.json({ limit: '2mb' }))

  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Shrija Scrap Tool</title></head>
<body style="font-family:system-ui;padding:1.5rem;max-width:40rem;line-height:1.5">
  <h1>Shrija Scrap Tool v${SCRAP_TOOL_VERSION}</h1>
  <p>Gold Shark–FAST: attach to Chrome (port 9222), scrape Manak received list.</p>
  <ol>
    <li>Run <code>start-chrome-for-manak.bat</code> → login Manak once</li>
    <li>Keep this scrap tool running</li>
    <li>Shrija → Auto Request → Fetch Request</li>
  </ol>
  <p><a href="/health">/health</a></p>
</body></html>`)
  })

  app.get('/health', async (_req, res) => {
    const chromeAttached = await isChromeAttached()
    res.json({
      ok: true,
      service: 'shrija-scrap',
      version: SCRAP_TOOL_VERSION,
      busy,
      chromeAttached,
      mac: primaryMac(),
      macs: listMacAddresses(),
      machine: machineLabel(),
      port: DEFAULT_PORT,
      tip: chromeAttached
        ? 'Chrome debug attached — Fetch will be FAST (no captcha)'
        : 'Run start-chrome-for-manak.bat then login Manak for FAST mode',
    })
  })

  app.get('/mac', (_req, res) => {
    res.json({ mac: primaryMac(), macs: listMacAddresses(), machine: machineLabel() })
  })

  app.post('/fetch', async (req, res) => {
    if (busy) {
      res.status(409).json({ error: 'Already fetching. Wait…' })
      return
    }

    const username = String(req.body?.username || '').trim()
    const password = String(req.body?.password || '')
    const baseUrl = String(req.body?.baseUrl || 'https://huid.manakonline.in').trim()
    const night = String(req.body?.night || 'Night')
    const loginTimeoutSec = Number(req.body?.loginTimeoutSec || 180)
    const postLoginWaitSec = Number(req.body?.postLoginWaitSec || 300)
    const headed = req.body?.headed !== false
    const preferCdp = req.body?.preferCdp !== false

    const chromeAttached = await isChromeAttached()
    if (!chromeAttached && (!username || !password)) {
      res.status(400).json({
        error:
          'For FAST mode: run start-chrome-for-manak.bat and login Manak. Or save Manak username/password for fallback.',
      })
      return
    }

    const allowedRaw = req.body?.allowedMacs
    if (typeof allowedRaw === 'string' && allowedRaw.trim()) {
      const allowed = allowedRaw
        .split(',')
        .map((s: string) => s.trim().toUpperCase().replace(/:/g, '-'))
        .filter(Boolean)
      const local = listMacAddresses()
      if (allowed.length && !allowed.some((m) => local.includes(m))) {
        res.status(403).json({
          error: `PC MAC not allowed. Local: ${local.join(', ') || 'none'}`,
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
        preferCdp,
      })
      res.json({ ...result, night, mac: primaryMac(), chromeAttached })
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'Scrap failed',
        source: 'scrap-tool',
      })
    } finally {
      busy = false
    }
  })

  return app
}
