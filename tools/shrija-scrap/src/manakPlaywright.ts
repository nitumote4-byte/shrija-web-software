import { chromium, type Browser, type Page } from 'playwright'
import { parseReceiveDetailPage } from './detailParse.js'
import { RECEIVED_LIST_PATH, scrapeAssayingList } from './scrapeList.js'
import type { ManakRequestRow } from './parseTables.js'

const DEFAULT_BASE = 'https://huid.manakonline.in'
const LOGIN_PATHS = ['/MANAK/eBISLogin', '/MANAK/login', '/MANAK/HallmarkingLogin']
const CDP_URL = process.env.SHRIJA_CDP_URL || 'http://127.0.0.1:9222'

export const SCRAP_TOOL_VERSION = '2.0.0'

export type ScrapFetchInput = {
  username?: string
  password?: string
  baseUrl?: string
  loginTimeoutSec?: number
  postLoginWaitSec?: number
  headed?: boolean
  /** Prefer attach to real Chrome (Gold Shark–fast). Default true. */
  preferCdp?: boolean
}

export type ScrapFetchResult = {
  ok: boolean
  source: 'scrap-tool'
  mode?: 'cdp' | 'playwright'
  requests: ManakRequestRow[]
  message: string
  pagesTried: string[]
  version?: string
  chromeAttached?: boolean
}

function abs(base: string, path: string) {
  if (path.startsWith('http')) return path
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

export async function isChromeAttached(cdpUrl = CDP_URL): Promise<boolean> {
  try {
    const res = await fetch(`${cdpUrl.replace(/\/$/, '')}/json/version`, {
      signal: AbortSignal.timeout(1200),
    })
    return res.ok
  } catch {
    return false
  }
}

async function fillLogin(page: Page, username: string, password: string) {
  const pass = page.locator('input[type="password"]').first()
  await pass.waitFor({ state: 'visible', timeout: 20000 })
  await pass.fill(password, { timeout: 10000 })

  const candidates = [
    page.getByLabel(/user\s*name|login|email|userid/i),
    page.getByPlaceholder(/user\s*name|login|email/i),
    page.locator('input[type="text"]'),
    page.locator('input[type="email"]'),
  ]

  let filledUser = false
  for (const loc of candidates) {
    const count = await loc.count()
    for (let i = 0; i < count; i++) {
      const el = loc.nth(i)
      if (!(await el.isVisible().catch(() => false))) continue
      const type = ((await el.getAttribute('type')) || 'text').toLowerCase()
      if (type === 'hidden' || type === 'password') continue
      const meta = `${(await el.getAttribute('name')) || ''} ${(await el.getAttribute('id')) || ''}`
      if (/captcha|otp|securitycode/i.test(meta)) continue
      if (/^userId$/i.test((await el.getAttribute('id')) || '')) continue
      await el.click({ timeout: 5000 })
      await el.fill(username, { timeout: 10000 })
      filledUser = true
      break
    }
    if (filledUser) break
  }
  if (!filledUser) {
    throw new Error('Visible username box not found — type username manually.')
  }
}

async function waitUntilLoggedIn(page: Page, timeoutMs: number) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (!/eBISLogin|\/login|HallmarkingLogin/i.test(page.url())) return true
    await page.waitForTimeout(1200)
  }
  return false
}

async function ensureBanner(page: Page, text: string) {
  await page
    .evaluate((msg) => {
      let root = document.getElementById('shrija-scrap-root')
      if (!root) {
        root = document.createElement('div')
        root.id = 'shrija-scrap-root'
        root.style.cssText =
          'position:fixed;z-index:2147483647;left:12px;right:12px;top:12px;font:600 14px/1.35 system-ui,sans-serif'
        document.body.appendChild(root)
      }
      root.innerHTML = `<div style="background:#1a365d;color:#fff;padding:12px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35)">${msg}</div>`
    }, text)
    .catch(() => {})
}

/**
 * FAST path (Gold Shark style): attach to Chrome already logged into Manak.
 * No captcha. Just open received list and scrape.
 */
async function fetchViaCdp(base: string): Promise<ScrapFetchResult | null> {
  let browser: Browser
  try {
    browser = await chromium.connectOverCDP(CDP_URL)
  } catch {
    return null
  }

  try {
    const context = browser.contexts()[0] || (await browser.newContext())
    const page = context.pages().find((p) => /manakonline/i.test(p.url())) || context.pages()[0] || (await context.newPage())

    await ensureBanner(
      page,
      'Shrija v2 — Chrome attach mode: scraping List of Received Request (no captcha)…',
    )

    const { requests, pagesTried, listRowCount } = await scrapeAssayingList(page, base)

    if (/eBISLogin|\/login/i.test(page.url()) || listRowCount === 0 && requests.length === 0) {
      // Maybe not logged in
      const stillLogin = /eBISLogin|\/login|HallmarkingLogin/i.test(page.url())
      return {
        ok: false,
        source: 'scrap-tool',
        mode: 'cdp',
        chromeAttached: true,
        requests: [],
        pagesTried,
        version: SCRAP_TOOL_VERSION,
        message: stillLogin
          ? 'Chrome connected but Manak login required. Login once in the debug Chrome window, then Fetch again.'
          : `Chrome connected but received list empty (${listRowCount} rows). Open ${RECEIVED_LIST_PATH} in Chrome, then Fetch again.`,
      }
    }

    return {
      ok: true,
      source: 'scrap-tool',
      mode: 'cdp',
      chromeAttached: true,
      requests,
      pagesTried,
      version: SCRAP_TOOL_VERSION,
      message: requests.length
        ? `FAST: ${requests.length} request(s) via Chrome attach (v${SCRAP_TOOL_VERSION})`
        : `Chrome attach OK, list had ${listRowCount} rows but item/PIC/weight not parsed. Click one request in Chrome then Fetch again.`,
    }
  } finally {
    // Disconnect only — does not close user's Chrome
    await browser.close().catch(() => {})
  }
}

/**
 * Slow fallback: launch Playwright browser, captcha login, then scrape.
 */
async function fetchViaPlaywright(input: ScrapFetchInput, base: string): Promise<ScrapFetchResult> {
  const headed = input.headed !== false
  const loginTimeoutMs = Math.max(30, input.loginTimeoutSec || 180) * 1000
  const pagesTried: string[] = []
  const username = String(input.username || '').trim()
  const password = String(input.password || '')

  const browser = await chromium.launch({
    headless: !headed,
    args: ['--disable-blink-features=AutomationControlled'],
  })

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 860 },
    })
    const page = await context.newPage()

    let opened = false
    for (const path of LOGIN_PATHS) {
      const url = abs(base, path)
      pagesTried.push(url)
      try {
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
        if (res && res.status() < 400) {
          opened = true
          break
        }
      } catch {
        /* next */
      }
    }
    if (!opened) {
      return {
        ok: false,
        source: 'scrap-tool',
        mode: 'playwright',
        requests: [],
        pagesTried,
        version: SCRAP_TOOL_VERSION,
        message: 'Could not open Manak login. Prefer start-chrome-for-manak.bat (faster).',
      }
    }

    await ensureBanner(
      page,
      'Shrija v2 fallback — type captcha + Login. Better: use start-chrome-for-manak.bat (no captcha each time).',
    )
    if (username && password) {
      try {
        await fillLogin(page, username, password)
      } catch (e) {
        console.warn('[shrija-scrap] fill skipped', e)
      }
    }

    const loggedIn = await waitUntilLoggedIn(page, loginTimeoutMs)
    if (!loggedIn) {
      return {
        ok: false,
        source: 'scrap-tool',
        mode: 'playwright',
        requests: [],
        pagesTried,
        version: SCRAP_TOOL_VERSION,
        message: 'Login timeout. Or use Chrome attach: run start-chrome-for-manak.bat first.',
      }
    }

    const { requests, pagesTried: tried, listRowCount } = await scrapeAssayingList(page, base)
    pagesTried.push(...tried)

    return {
      ok: true,
      source: 'scrap-tool',
      mode: 'playwright',
      requests,
      pagesTried,
      version: SCRAP_TOOL_VERSION,
      message: requests.length
        ? `Fetched ${requests.length} request(s) (playwright fallback v${SCRAP_TOOL_VERSION})`
        : `List opened (${listRowCount} rows) but details not parsed.`,
    }
  } finally {
    await browser.close().catch(() => {})
  }
}

/** Main entry — CDP first (Gold Shark–fast), then Playwright. */
export async function fetchManakWithBrowser(input: ScrapFetchInput): Promise<ScrapFetchResult> {
  const base = (input.baseUrl || DEFAULT_BASE).replace(/\/$/, '')
  const preferCdp = input.preferCdp !== false

  if (preferCdp) {
    const cdpResult = await fetchViaCdp(base)
    if (cdpResult) {
      // If CDP connected but needs login, still return that message (don't immediately launch 2nd browser)
      if (cdpResult.requests.length > 0 || cdpResult.chromeAttached) return cdpResult
    }
  }

  return fetchViaPlaywright(input, base)
}

// re-export for older imports
export { parseReceiveDetailPage }
