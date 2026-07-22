import { chromium, type Page } from 'playwright'
import { parseHtmlTables, type ManakRequestRow } from './parseTables.js'

const DEFAULT_BASE = 'https://huid.manakonline.in'

const LOGIN_PATHS = ['/MANAK/eBISLogin', '/MANAK/login', '/MANAK/HallmarkingLogin']

/** Real Manak AHC receive flow (user-confirmed path) */
const RECEIVE_ACTION = 'AHCReceivingUIDJewellerRequest.do'

export const SCRAP_TOOL_VERSION = '1.2.0'

export type ScrapFetchInput = {
  username: string
  password: string
  baseUrl?: string
  /** Max seconds to wait for user to solve captcha / finish login */
  loginTimeoutSec?: number
  /**
   * After login, wait for user to open Receiving page and click "Scrape now".
   * No automatic page.goto after login.
   */
  postLoginWaitSec?: number
  headed?: boolean
}

export type ScrapFetchResult = {
  ok: boolean
  source: 'scrap-tool'
  requests: ManakRequestRow[]
  message: string
  pagesTried: string[]
  version?: string
}

function abs(base: string, path: string) {
  if (path.startsWith('http')) return path
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

function b64Decode(value: string): string {
  try {
    return Buffer.from(value, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

function requestIdFromReceiveUrl(url: string): string {
  try {
    const u = new URL(url)
    const enc = u.searchParams.get('eRequestId') || ''
    return b64Decode(enc) || enc
  } catch {
    return ''
  }
}

function cmlFromReceiveUrl(url: string): string {
  try {
    const u = new URL(url)
    const enc = u.searchParams.get('eCmlNo') || ''
    return b64Decode(enc) || enc
  } catch {
    return ''
  }
}

function labelValue(html: string, labels: string[]): string {
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*[:\\-]?\\s*</(?:td|th|label|span|div)>\\s*<(?:td|span|div)[^>]*>\\s*([^<]+)`,
      'i',
    )
    const m = re.exec(html)
    if (m?.[1]?.trim()) return m[1].trim()

    const re2 = new RegExp(`${label}\\s*[:\\-]\\s*([A-Za-z0-9][A-Za-z0-9 .\\-/]*)`, 'i')
    const m2 = re2.exec(html.replace(/<[^>]+>/g, ' '))
    if (m2?.[1]?.trim()) return m2[1].trim()
  }
  return ''
}

function inputValue(html: string, nameHints: string[]): string {
  for (const hint of nameHints) {
    const re = new RegExp(
      `<input[^>]*(?:name|id)=["'][^"']*${hint}[^"']*["'][^>]*value=["']([^"']*)["']`,
      'i',
    )
    const m = re.exec(html)
    if (m?.[1]?.trim()) return m[1].trim()
    const re2 = new RegExp(
      `<input[^>]*value=["']([^"']*)["'][^>]*(?:name|id)=["'][^"']*${hint}[^"']*["']`,
      'i',
    )
    const m2 = re2.exec(html)
    if (m2?.[1]?.trim()) return m2[1].trim()
  }
  return ''
}

/** Parse one AHCReceivingUIDJewellerRequest.do detail page */
export function parseReceiveDetailPage(html: string, pageUrl: string): ManakRequestRow | null {
  const fromTable = parseHtmlTables(html)
  if (fromTable.length === 1) {
    const row = fromTable[0]
    if (!row.requestNo) row.requestNo = requestIdFromReceiveUrl(pageUrl)
    if (!row.cml) row.cml = cmlFromReceiveUrl(pageUrl)
    return row
  }

  const requestNo =
    labelValue(html, ['Request No', 'Request Number', 'Request ID', 'Hallmarking Request']) ||
    inputValue(html, ['Request', 'requestId', 'reqNo']) ||
    requestIdFromReceiveUrl(pageUrl)

  const partyName =
    labelValue(html, ['Jeweller', 'Party', 'Customer', 'Outlet', 'Firm Name', 'Jeweller Name']) ||
    inputValue(html, ['jeweller', 'party', 'outlet', 'customerName'])

  const item =
    labelValue(html, ['Item', 'Article', 'Jewellery', 'Category', 'Item Category']) ||
    inputValue(html, ['item', 'category', 'article']) ||
    'Jewellery'

  const picRaw =
    labelValue(html, ['PIC', 'Pcs', 'Pieces', 'Quantity', 'No of Pieces', 'Qty']) ||
    inputValue(html, ['pic', 'pcs', 'qty', 'quantity', 'piece'])
  const wtRaw =
    labelValue(html, ['Weight', 'Gross Weight', 'Declared Weight', 'Wt']) ||
    inputValue(html, ['weight', 'gross', 'wt'])
  const purity =
    (
      labelValue(html, ['Purity', 'Declared Purity', 'Fineness']) ||
      inputValue(html, ['purity', 'fineness']) ||
      '916'
    )
      .match(/\d{3}/)?.[0] || '916'

  const receiptNo =
    labelValue(html, ['Receipt', 'Ack', 'Acknowledgement']) ||
    inputValue(html, ['receipt', 'ack'])
  const jobCardNo =
    labelValue(html, ['Job Card', 'Job No', 'Job Number']) ||
    inputValue(html, ['job'])
  const cml =
    labelValue(html, ['CML', 'Licence', 'License']) ||
    inputValue(html, ['cml', 'licence']) ||
    cmlFromReceiveUrl(pageUrl)

  if (!requestNo && !partyName) {
    if (fromTable[0]) return fromTable[0]
    return null
  }

  return {
    partyName: partyName || 'Unknown Party',
    item,
    pic: Math.max(0, Number.parseInt(String(picRaw).replace(/,/g, ''), 10) || 0),
    weight: Number.parseFloat(String(wtRaw).replace(/,/g, '')) || 0,
    purity,
    requestNo: requestNo || `MANAK-${Date.now()}`,
    receiptNo,
    jobCardNo,
    cml,
  }
}

async function fillLogin(page: Page, username: string, password: string) {
  const userSel = [
    'input[name*="user" i]',
    'input[id*="user" i]',
    'input[name*="login" i]',
    'input[type="text"]',
    'input[type="email"]',
  ]
  const passSel = ['input[type="password"]', 'input[name*="pass" i]', 'input[id*="pass" i]']

  for (const sel of userSel) {
    const el = page.locator(sel).first()
    if (await el.count()) {
      await el.fill(username)
      break
    }
  }
  for (const sel of passSel) {
    const el = page.locator(sel).first()
    if (await el.count()) {
      await el.fill(password)
      break
    }
  }
}

async function clickLogin(page: Page) {
  const candidates = [
    'button:has-text("Login")',
    'input[type="submit"]',
    'button[type="submit"]',
    'a:has-text("Login")',
    'input[value*="Login" i]',
  ]
  for (const sel of candidates) {
    const el = page.locator(sel).first()
    if (await el.count()) {
      await el.click({ timeout: 3000 }).catch(() => {})
      return
    }
  }
}

async function waitUntilLoggedIn(page: Page, timeoutMs: number) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const url = page.url()
    // Only treat as logged-in when we left the login URL — never navigate
    if (!/eBISLogin|\/login|HallmarkingLogin/i.test(url)) {
      return true
    }
    await page.waitForTimeout(1500)
  }
  return false
}

/** Sticky banner + green button. Does not navigate. Re-injects after user navigates. */
async function ensureControlBanner(page: Page, phase: 'login' | 'ready') {
  await page
    .evaluate((p) => {
      const w = window as unknown as { __shrijaScrapReady?: boolean }
      let root = document.getElementById('shrija-scrap-root')
      if (!root) {
        root = document.createElement('div')
        root.id = 'shrija-scrap-root'
        root.style.cssText =
          'position:fixed;z-index:2147483647;left:12px;right:12px;top:12px;' +
          'font:600 14px/1.35 system-ui,sans-serif;pointer-events:auto'
        document.body.appendChild(root)
      }

      if (p === 'login') {
        root.innerHTML =
          '<div style="background:#1a365d;color:#fff;padding:12px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35)">' +
          '<div>Shrija Scrap v1.2 — enter captcha, then click Login.</div>' +
          '<div style="font-weight:500;opacity:.9;margin-top:4px">Tool will NOT auto-refresh. After login, open Receiving tab yourself.</div>' +
          '</div>'
        return
      }

      root.innerHTML =
        '<div style="background:#14532d;color:#fff;padding:12px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:220px">' +
        '<div>Login OK — open <b>Receiving / Jeweller Request</b> (no auto refresh).</div>' +
        '<div style="font-weight:500;opacity:.95;margin-top:4px">When the list/detail is visible, click the button →</div>' +
        '</div>' +
        '<button id="shrija-scrap-go" type="button" style="background:#fbbf24;color:#111;border:0;border-radius:8px;padding:10px 16px;font:700 14px system-ui;cursor:pointer">Scrape this page</button>' +
        '</div>'

      const btn = document.getElementById('shrija-scrap-go')
      if (btn) {
        btn.onclick = () => {
          w.__shrijaScrapReady = true
          btn.textContent = 'Scraping…'
          ;(btn as HTMLButtonElement).disabled = true
        }
      }
    }, phase)
    .catch(() => {})
}

async function userClickedScrape(page: Page): Promise<boolean> {
  return page
    .evaluate(() => Boolean((window as unknown as { __shrijaScrapReady?: boolean }).__shrijaScrapReady))
    .catch(() => false)
}

function urlLooksLikeReceive(url: string) {
  return /AHCReceivingUIDJewellerRequest/i.test(url)
}

/**
 * Passive mode: after login the tool NEVER calls page.goto.
 * User navigates to Receiving, then clicks "Scrape this page".
 */
export async function fetchManakWithBrowser(input: ScrapFetchInput): Promise<ScrapFetchResult> {
  const base = (input.baseUrl || DEFAULT_BASE).replace(/\/$/, '')
  const headed = input.headed !== false
  const loginTimeoutMs = Math.max(30, input.loginTimeoutSec || 180) * 1000
  const postLoginWaitMs = Math.max(60, input.postLoginWaitSec || 300) * 1000
  const pagesTried: string[] = []

  const browser = await chromium.launch({
    headless: !headed,
    args: ['--disable-blink-features=AutomationControlled'],
  })

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 860 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()

    // Re-inject banner after every user navigation (no tool navigation)
    page.on('load', () => {
      void ensureControlBanner(page, /eBISLogin|\/login/i.test(page.url()) ? 'login' : 'ready')
    })

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
        /* try next */
      }
    }

    if (!opened) {
      return {
        ok: false,
        source: 'scrap-tool',
        requests: [],
        message: 'Could not open Manak login page. Check internet / base URL.',
        pagesTried,
        version: SCRAP_TOOL_VERSION,
      }
    }

    await fillLogin(page, input.username, input.password)
    await ensureControlBanner(page, 'login')

    const hasCaptcha = await page.locator('img[src*="captcha" i], img[alt*="captcha" i]').count()
    if (!hasCaptcha) {
      await clickLogin(page)
    }

    const loggedIn = await waitUntilLoggedIn(page, loginTimeoutMs)
    if (!loggedIn) {
      return {
        ok: false,
        source: 'scrap-tool',
        requests: [],
        message:
          'Login not completed in time. Enter captcha, click Login, then try Fetch again.',
        pagesTried,
        version: SCRAP_TOOL_VERSION,
      }
    }

    console.log(`[shrija-scrap ${SCRAP_TOOL_VERSION}] Login OK. Passive wait — no auto navigation.`)
    await ensureControlBanner(page, 'ready')

    const waitStart = Date.now()
    let scrapeNow = false
    while (Date.now() - waitStart < postLoginWaitMs) {
      // Only check flags / URL — never goto, never click menus, never crawl links
      if (await userClickedScrape(page)) {
        scrapeNow = true
        break
      }
      // Optional: if user already opened the exact receive URL, still require button
      // (avoids false start on dashboard). Re-inject banner if Manak wiped DOM.
      if (!(await page.evaluate(() => Boolean(document.getElementById('shrija-scrap-root'))).catch(() => false))) {
        await ensureControlBanner(page, 'ready')
      }
      await page.waitForTimeout(800)
    }

    if (!scrapeNow) {
      return {
        ok: false,
        source: 'scrap-tool',
        requests: [],
        message:
          'Timed out waiting. Open Receiving / Jeweller Request, then click the yellow "Scrape this page" button.',
        pagesTried,
        version: SCRAP_TOOL_VERSION,
      }
    }

    const url = page.url()
    pagesTried.push(`scrape:${url}`)
    const html = await page.content()
    const collected: ManakRequestRow[] = []
    collected.push(...parseHtmlTables(html))
    const detail = parseReceiveDetailPage(html, url)
    if (detail) collected.push(detail)

    // If still empty and URL is not receive page, tell user clearly — do NOT navigate
    if (!collected.length && !urlLooksLikeReceive(url)) {
      return {
        ok: false,
        source: 'scrap-tool',
        requests: [],
        message: `Scraped current page but found no request rows. URL was not ${RECEIVE_ACTION}. Open that page, then click Scrape again.`,
        pagesTried,
        version: SCRAP_TOOL_VERSION,
      }
    }

    const seen = new Set<string>()
    const requests = collected.filter((r) => {
      const key = r.requestNo || `${r.partyName}:${r.item}:${r.weight}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return {
      ok: true,
      source: 'scrap-tool',
      requests,
      message: requests.length
        ? `Scraped ${requests.length} request(s) from current Manak page (v${SCRAP_TOOL_VERSION})`
        : 'Page scraped but no rows parsed. Stay on Receiving list/detail and try again.',
      pagesTried,
      version: SCRAP_TOOL_VERSION,
    }
  } finally {
    await browser.close().catch(() => {})
  }
}
