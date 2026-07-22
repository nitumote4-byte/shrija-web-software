import { randomUUID } from 'node:crypto'
import {
  cookieHeader,
  deleteSession,
  getSession,
  mergeSetCookie,
  putSession,
  type ManakSession,
} from './sessions.js'
import type { ManakFetchResult, ManakRequestRow } from './types.js'

const DEFAULT_BASE = 'https://huid.manakonline.in'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function normalizeBase(url: string) {
  const u = (url || DEFAULT_BASE).trim().replace(/\/$/, '')
  return u || DEFAULT_BASE
}

async function manakFetch(
  session: ManakSession,
  pathOrUrl: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `${session.baseUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
  const headers = new Headers(init.headers || {})
  headers.set('User-Agent', USER_AGENT)
  headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
  if (!headers.has('Cookie')) headers.set('Cookie', cookieHeader(session.cookies))
  const res = await fetch(url, {
    ...init,
    headers,
    redirect: 'manual',
  })
  mergeSetCookie(session.cookies, res.headers)
  // Follow one hop redirects manually to keep cookies
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const loc = res.headers.get('location')
    if (loc) {
      const next = loc.startsWith('http') ? loc : new URL(loc, url).toString()
      return manakFetch(session, next, { method: 'GET' })
    }
  }
  return res
}

function extractInputs(html: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /<input\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const tag = m[0]
    const name = /name=["']([^"']+)["']/i.exec(tag)?.[1]
    if (!name) continue
    const type = (/type=["']([^"']+)["']/i.exec(tag)?.[1] || 'text').toLowerCase()
    if (type === 'submit' || type === 'button' || type === 'image') continue
    const value = /value=["']([^"']*)["']/i.exec(tag)?.[1] ?? ''
    out[name] = value
  }
  return out
}

function findCaptchaSrc(html: string, baseUrl: string): string | null {
  const patterns = [
    /<img[^>]+(?:captcha|Captcha|CAPTCHA)[^>]+src=["']([^"']+)["']/i,
    /src=["']([^"']*captcha[^"']*)["']/i,
    /src=["']([^"']*Captcha[^"']*)["']/i,
  ]
  for (const re of patterns) {
    const m = re.exec(html)
    if (m?.[1]) {
      const src = m[1]
      if (src.startsWith('data:')) return src
      if (src.startsWith('http')) return src
      return new URL(src, baseUrl).toString()
    }
  }
  return null
}

function findCaptchaField(inputs: Record<string, string>): string | null {
  const keys = Object.keys(inputs)
  return (
    keys.find((k) => /captcha/i.test(k)) ||
    keys.find((k) => /j_captcha|securitycode|secCode|otp/i.test(k)) ||
    null
  )
}

function findUserPassFields(inputs: Record<string, string>): { user: string; pass: string } {
  const keys = Object.keys(inputs)
  const user =
    keys.find((k) => /user(name)?|login|uid|email/i.test(k) && !/pass/i.test(k)) ||
    keys.find((k) => k.toLowerCase() === 'username') ||
    'username'
  const pass =
    keys.find((k) => /pass(word)?|pwd/i.test(k)) ||
    keys.find((k) => k.toLowerCase() === 'password') ||
    'password'
  return { user, pass }
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim()
}

function stripTags(html: string) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function parseHtmlTables(html: string): ManakRequestRow[] {
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
  const rows: ManakRequestRow[] = []

  for (const t of tables) {
    const tableHtml = t[1]
    const headerCells = [...tableHtml.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((c) =>
      stripTags(c[1]).toLowerCase(),
    )
    if (headerCells.length < 3) continue

    const col = (names: string[]) =>
      headerCells.findIndex((h) => names.some((n) => h.includes(n)))

    const iParty = col(['party', 'jeweller', 'customer', 'outlet', 'name'])
    const iItem = col(['item', 'article', 'jewellery', 'category'])
    const iPic = col(['pic', 'pcs', 'piece', 'qty', 'quantity', 'no of'])
    const iWeight = col(['weight', 'wt', 'gross'])
    const iPurity = col(['purity', 'fineness', 'karat', 'touch'])
    const iReq = col(['request', 'req no', 'req. no', 'hallmark request'])
    const iReceipt = col(['receipt', 'ack', 'voucher'])
    const iJob = col(['job', 'job card', 'jc'])
    const iCml = col(['cml', 'licence', 'license'])

    // Must look like a request table
    if (iParty < 0 && iReq < 0) continue

    const bodyRows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    for (const tr of bodyRows) {
      const cells = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        stripTags(c[1]),
      )
      if (cells.length < 2) continue
      // skip header row duplicated as td
      if (cells.every((c) => headerCells.includes(c.toLowerCase()))) continue

      const pick = (idx: number, fallback = '') => (idx >= 0 ? cells[idx] || fallback : fallback)
      const partyName = pick(iParty)
      const requestNo = pick(iReq)
      if (!partyName && !requestNo) continue
      if (/^(party|request|s\.?no|sr)/i.test(partyName)) continue

      const picRaw = pick(iPic, '0').replace(/,/g, '')
      const wtRaw = pick(iWeight, '0').replace(/,/g, '')
      rows.push({
        partyName: partyName || 'Unknown Party',
        item: pick(iItem, 'Jewellery'),
        pic: Math.max(0, Number.parseInt(picRaw, 10) || 0),
        weight: Number.parseFloat(wtRaw) || 0,
        purity: (pick(iPurity, '916').match(/\d{3}/)?.[0] || '916').slice(0, 3),
        requestNo: requestNo || `MANAK-${Date.now()}-${rows.length + 1}`,
        receiptNo: pick(iReceipt),
        jobCardNo: pick(iJob),
        cml: pick(iCml),
        raw: Object.fromEntries(headerCells.map((h, i) => [h || `col${i}`, cells[i] || ''])),
      })
    }
  }

  // Deduplicate by requestNo
  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = r.requestNo || `${r.partyName}:${r.item}:${r.weight}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parseJsonRequests(body: unknown): ManakRequestRow[] {
  if (!body || typeof body !== 'object') return []
  const obj = body as Record<string, unknown>
  const list = (Array.isArray(obj) ? obj : obj.requests || obj.data || obj.rows) as unknown
  if (!Array.isArray(list)) return []
  return list
    .map((item): ManakRequestRow | null => {
      if (!item || typeof item !== 'object') return null
      const r = item as Record<string, unknown>
      const partyName = String(r.partyName || r.party || r.jewellerName || r.customerName || '').trim()
      const requestNo = String(r.requestNo || r.request_no || r.reqNo || r.RequestNo || '').trim()
      if (!partyName && !requestNo) return null
      return {
        partyName: partyName || 'Unknown Party',
        item: String(r.item || r.itemName || r.category || 'Jewellery'),
        pic: Number(r.pic || r.pcs || r.pieces || r.qty || r.quantity || 0) || 0,
        weight: Number(r.weight || r.wt || r.grossWeight || 0) || 0,
        purity: String(r.purity || r.declaredPurity || '916').replace(/\D/g, '').slice(0, 3) || '916',
        requestNo: requestNo || `MANAK-${Date.now()}`,
        receiptNo: String(r.receiptNo || r.receipt_no || r.ackNo || ''),
        jobCardNo: String(r.jobCardNo || r.job_card_no || r.jobNo || ''),
        cml: String(r.cml || r.cmlNo || r.licenceNo || ''),
        date: r.date ? String(r.date) : undefined,
      }
    })
    .filter((x): x is ManakRequestRow => Boolean(x))
}

export async function fetchViaBridge(opts: {
  bridgeUrl: string
  username: string
  password: string
  night: string
}): Promise<ManakFetchResult> {
  const res = await fetch(opts.bridgeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      username: opts.username,
      password: opts.password,
      night: opts.night,
      action: 'fetch_requests',
    }),
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch {
    throw Object.assign(
      new Error(`Manak bridge returned non-JSON (${res.status}). Check bridge URL / PHP.`),
      { status: 502 },
    )
  }
  if (!res.ok) {
    const err = (json as { error?: string })?.error || `Bridge error ${res.status}`
    throw Object.assign(new Error(err), { status: 502 })
  }
  const requests = parseJsonRequests(json)
  return {
    ok: true,
    source: 'bridge',
    requests,
    message: requests.length
      ? `Fetched ${requests.length} request(s) via Manak bridge`
      : 'Bridge OK but no pending requests',
  }
}

export async function startPortalSession(opts: {
  tenantId: string
  username: string
  password: string
  baseUrl: string
}): Promise<ManakFetchResult> {
  const session: ManakSession = {
    id: randomUUID(),
    tenantId: opts.tenantId,
    baseUrl: normalizeBase(opts.baseUrl),
    username: opts.username,
    password: opts.password,
    cookies: new Map(),
    createdAt: Date.now(),
  }

  const loginPaths = [
    '/MANAK/eBISLogin',
    '/MANAK/login',
    '/MANAK/HallmarkingLogin',
    '/MANAK/AHCLogin',
  ]

  let html = ''
  let usedPath = loginPaths[0]
  let lastErr = ''
  for (const path of loginPaths) {
    try {
      const res = await manakFetch(session, path)
      if (res.status >= 400) {
        lastErr = `GET ${path} → ${res.status}`
        continue
      }
      html = await res.text()
      usedPath = path
      if (html.length > 200) break
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
  }

  if (!html) {
    throw Object.assign(
      new Error(
        `Could not open Manak login page from cloud (${lastErr || 'no response'}). ` +
          `Start Shrija Scrap Tool on this PC (tools\\shrija-scrap\\start.bat), wait for "Scrap tool: Online", then Fetch again.`,
      ),
      { status: 502 },
    )
  }

  session.loginHtml = html
  const inputs = extractInputs(html)
  session.captchaField = findCaptchaField(inputs) || undefined
  putSession(session)

  const captchaSrc = findCaptchaSrc(html, session.baseUrl)
  let captchaImage: string | undefined
  if (captchaSrc) {
    if (captchaSrc.startsWith('data:')) {
      captchaImage = captchaSrc
    } else {
      try {
        const imgRes = await manakFetch(session, captchaSrc)
        const buf = Buffer.from(await imgRes.arrayBuffer())
        const ctype = imgRes.headers.get('content-type') || 'image/png'
        captchaImage = `data:${ctype};base64,${buf.toString('base64')}`
      } catch {
        captchaImage = undefined
      }
    }
  }

  return {
    ok: true,
    source: 'portal',
    requests: [],
    needsCaptcha: Boolean(session.captchaField || captchaImage),
    sessionId: session.id,
    captchaImage,
    message: `Manak login page loaded (${usedPath}). Enter captcha if shown, then confirm fetch.`,
  }
}

export async function completePortalFetch(opts: {
  tenantId: string
  sessionId: string
  captchaText?: string
}): Promise<ManakFetchResult> {
  const session = getSession(opts.sessionId, opts.tenantId)
  if (!session) {
    throw Object.assign(new Error('Manak session expired. Click Fetch Request again.'), {
      status: 400,
    })
  }

  const html = session.loginHtml || ''
  const inputs = extractInputs(html)
  const { user, pass } = findUserPassFields(inputs)
  const form: Record<string, string> = { ...inputs }
  form[user] = session.username
  form[pass] = session.password
  if (session.captchaField) {
    form[session.captchaField] = opts.captchaText || ''
  } else if (opts.captchaText) {
    const guess =
      Object.keys(form).find((k) => /captcha|security/i.test(k)) || 'captcha'
    form[guess] = opts.captchaText
  }

  const body = new URLSearchParams(form)
  const loginRes = await manakFetch(session, '/MANAK/eBISLogin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${session.baseUrl}/MANAK/eBISLogin`,
    },
    body,
  })
  const loginHtml = await loginRes.text()

  if (
    /invalid|incorrect|wrong captcha|authentication failed|login failed/i.test(loginHtml) &&
    /password|captcha|login/i.test(loginHtml)
  ) {
    deleteSession(session.id)
    throw Object.assign(
      new Error('Manak login failed (wrong credentials or captcha). Try again.'),
      { status: 401 },
    )
  }

  // Candidate AHC pending-request pages
  const candidatePaths = [
    '/MANAK/AHCReceivingUIDJewellerRequest.do',
    '/MANAK/AHCReceivingUIDJewellerRequest',
    '/MANAK/AHCReceiveRequest',
    '/MANAK/AHCPendingRequest',
    '/MANAK/AHCPendingRequests',
    '/MANAK/HallmarkingAHCPending',
    '/MANAK/AssayingPendingRequest',
    '/MANAK/AHCHome',
    '/MANAK/HallmarkingHomePage',
  ]

  const collected: ManakRequestRow[] = []
  const tried: string[] = []

  for (const path of candidatePaths) {
    try {
      const res = await manakFetch(session, path)
      if (res.status >= 400) continue
      const page = await res.text()
      tried.push(path)
      if (/login|eBISLogin|sign in/i.test(page) && page.length < 8000 && !/<table/i.test(page)) {
        continue
      }
      const parsed = parseHtmlTables(page)
      for (const row of parsed) collected.push(row)
      if (parsed.length) break
    } catch {
      /* try next */
    }
  }

  // Deduplicate
  const seen = new Set<string>()
  const requests = collected.filter((r) => {
    if (seen.has(r.requestNo)) return false
    seen.add(r.requestNo)
    return true
  })

  deleteSession(session.id)

  if (!requests.length) {
    return {
      ok: true,
      source: 'portal',
      requests: [],
      message:
        `Logged into Manak, but no request table was found on known AHC pages (${tried.join(', ') || 'none'}). ` +
        `Paste Gold Shark automate_request.php here — we will map the exact URL/fields. Or set a Bridge URL.`,
    }
  }

  return {
    ok: true,
    source: 'portal',
    requests,
    message: `Fetched ${requests.length} request(s) from Manak Online`,
  }
}

export function demoRequests(night: string): ManakFetchResult {
  const n = Math.floor(Math.random() * 3) + 1
  const items = ['Necklace', 'Bangles', 'Earrings', 'Ring Set', 'Chain']
  const requests: ManakRequestRow[] = Array.from({ length: n }, (_, i) => ({
    partyName: `Demo Jewellers ${((Date.now() + i) % 90) + 10}`,
    item: items[i % items.length],
    pic: 4 + i * 2,
    weight: Number((20 + Math.random() * 40).toFixed(2)),
    purity: i % 2 === 0 ? '916' : '999',
    requestNo: `DEMO-${night.slice(0, 1)}-${Date.now().toString(36).toUpperCase()}-${i + 1}`,
    receiptNo: `RC-${2000 + i}`,
    jobCardNo: `JC-${5000 + i}`,
    cml: `CML-${90000 + i}`,
  }))
  return {
    ok: true,
    source: 'demo',
    requests,
    message: `Demo mode: ${requests.length} sample request(s). Configure Manak credentials for live fetch.`,
  }
}
