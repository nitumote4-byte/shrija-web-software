import { chromium, type Page } from 'playwright'
import { parseHtmlTables, type ManakRequestRow } from './parseTables.js'

const DEFAULT_BASE = 'https://huid.manakonline.in'

const LOGIN_PATHS = ['/MANAK/eBISLogin', '/MANAK/login', '/MANAK/HallmarkingLogin']

/** Real Manak AHC receive flow (user-confirmed path) */
const RECEIVE_ACTION = 'AHCReceivingUIDJewellerRequest.do'

const MAX_DETAIL_PAGES = 40

export type ScrapFetchInput = {
  username: string
  password: string
  baseUrl?: string
  /** Max seconds to wait for user to solve captcha / finish login */
  loginTimeoutSec?: number
  /**
   * After login, do NOT auto-navigate. Wait this many seconds for the user
   * to open Receiving / pending request tab manually.
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
  if (fromTable.length > 1) {
    // Prefer first data-looking row; caller may also merge table list separately
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
    const html = await page.content().catch(() => '')
    const stillLogin =
      /eBISLogin|\/login/i.test(url) ||
      (/password/i.test(html) && /captcha/i.test(html) && html.length < 200_000)

    if (!stillLogin && (/table/i.test(html) || /hallmark|logout|sign out|ahc/i.test(html))) {
      return true
    }
    await page.waitForTimeout(1500)
  }
  return false
}

async function collectReceiveLinks(page: Page, base: string): Promise<string[]> {
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href))
  const out = new Set<string>()
  for (const href of hrefs) {
    if (/AHCReceivingUIDJewellerRequest/i.test(href)) {
      out.add(href.startsWith('http') ? href : abs(base, href))
    }
  }
  // Also scan raw HTML for encoded links
  const html = await page.content()
  const re = /AHCReceivingUIDJewellerRequest\.do\?[^"'>\s]+/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    out.add(abs(base, `/MANAK/${m[0]}`))
  }
  return [...out]
}

async function showUserBanner(page: Page, text: string) {
  await page
    .evaluate((msg) => {
      let el = document.getElementById('shrija-scrap-banner')
      if (!el) {
        el = document.createElement('div')
        el.id = 'shrija-scrap-banner'
        el.style.cssText =
          'position:fixed;z-index:2147483647;left:0;right:0;top:0;padding:14px 18px;' +
          'background:#1a365d;color:#fff;font:600 15px/1.4 system-ui,sans-serif;' +
          'box-shadow:0 4px 16px rgba(0,0,0,.35);text-align:center'
        document.body.appendChild(el)
      }
      el.textContent = msg
    }, text)
    .catch(() => {})
}

function isReceivePage(url: string, html: string) {
  return (
    /AHCReceivingUIDJewellerRequest/i.test(url) ||
    /AHCReceivingUIDJewellerRequest/i.test(html) ||
    (/receiv/i.test(html) && /jeweller/i.test(html) && /<table/i.test(html))
  )
}

/**
 * Opens a real Chromium window. User solves captcha, then opens Receiving tab
 * manually — tool does not auto-refresh through menus after login.
 */
export async function fetchManakWithBrowser(input: ScrapFetchInput): Promise<ScrapFetchResult> {
  const base = (input.baseUrl || DEFAULT_BASE).replace(/\/$/, '')
  const headed = input.headed !== false
  const loginTimeoutMs = Math.max(30, input.loginTimeoutSec || 180) * 1000
  const postLoginWaitMs = Math.max(30, input.postLoginWaitSec || 150) * 1000
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
      }
    }

    await fillLogin(page, input.username, input.password)
    await showUserBanner(
      page,
      'Shrija Scrap: enter captcha → Login. After login, OPEN Receiving / Jeweller Request tab. Do not close this window.',
    )
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
          'Login not completed in time. Enter captcha in the browser window, click Login, then try Fetch again.',
        pagesTried,
      }
    }

    // --- Critical: NO auto page.goto loop here (that caused the refresh) ---
    await showUserBanner(
      page,
      'Login OK — now open AHC Receiving / pending Jeweller Request. Waiting… (tool will scrape when that page loads)',
    )
    console.log('[shrija-scrap] Login OK. Waiting for you to open Receiving / pending tab…')

    const collected: ManakRequestRow[] = []
    const detailUrls = new Set<string>()
    const waitStart = Date.now()
    let ready = false

    while (Date.now() - waitStart < postLoginWaitMs) {
      const url = page.url()
      pagesTried.push(`wait:${url}`)
      const html = await page.content().catch(() => '')

      for (const link of await collectReceiveLinks(page, base)) {
        detailUrls.add(link)
      }

      const tables = parseHtmlTables(html)
      if (tables.length) collected.push(...tables)

      if (isReceivePage(url, html) || detailUrls.size > 0 || tables.length > 0) {
        ready = true
        break
      }

      const remaining = Math.ceil((postLoginWaitMs - (Date.now() - waitStart)) / 1000)
      await showUserBanner(
        page,
        `Shrija: open Receiving / Jeweller Request tab now (${remaining}s left). No auto-refresh — navigate yourself.`,
      )
      await page.waitForTimeout(2000)
    }

    // Scrape whatever page the user is on
    {
      const html = await page.content()
      pagesTried.push(page.url())
      collected.push(...parseHtmlTables(html))
      const detail = parseReceiveDetailPage(html, page.url())
      if (detail) collected.push(detail)
      for (const link of await collectReceiveLinks(page, base)) {
        detailUrls.add(link)
      }
    }

    // Soft fallback once only — if user never opened receive page
    if (!ready && !detailUrls.size && !collected.length) {
      const fallback = abs(base, `/MANAK/${RECEIVE_ACTION}`)
      pagesTried.push(fallback)
      await showUserBanner(page, 'Opening Receiving page once (fallback)…')
      try {
        await page.goto(fallback, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(1200)
        const html = await page.content()
        collected.push(...parseHtmlTables(html))
        for (const link of await collectReceiveLinks(page, base)) detailUrls.add(link)
      } catch {
        /* ignore */
      }
    }

    // Open detail links found on list (capped) — only after user/list ready
    const details = [...detailUrls].slice(0, MAX_DETAIL_PAGES)
    if (details.length) {
      await showUserBanner(page, `Reading ${details.length} jeweller request page(s)…`)
    }
    for (const detailUrl of details) {
      pagesTried.push(detailUrl)
      try {
        await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(400)
        const html = await page.content()
        const detail = parseReceiveDetailPage(html, detailUrl)
        if (detail) collected.push(detail)
        collected.push(...parseHtmlTables(html))
      } catch {
        /* next */
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
        ? `Scrap tool fetched ${requests.length} request(s) via AHCReceivingUIDJewellerRequest`
        : 'Login OK, but no request rows found. After login, open Receiving / Jeweller Request, wait until the list shows, then Fetch again.',
      pagesTried,
    }
  } finally {
    await browser.close().catch(() => {})
  }
}
