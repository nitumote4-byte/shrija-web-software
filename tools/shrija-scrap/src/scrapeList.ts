import type { BrowserContext, Page } from 'playwright'
import {
  isQualityRequestRow,
  normalizePurity,
  parseHtmlTables,
  type ManakRequestRow,
} from './parseTables.js'
import { parseReceiveDetailPage } from './detailParse.js'

export const RECEIVED_LIST_PATH = '/MANAK/assayingAH_List?hmType=HMRD'
const MAX_LIST_ROWS = 20

function abs(base: string, path: string) {
  if (path.startsWith('http')) return path
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

function looksLikeDetailUrl(url: string) {
  return /AHCReceiving|UIDJewellerRequest|ReceivingUID|jewellerRequest|RequestDetails|ViewRequest/i.test(
    url,
  )
}

function looksLikeListUrl(url: string) {
  return /assayingAH_List/i.test(url)
}

async function parsePageRequests(
  page: Page,
  partyGuess = '',
  dateGuess = '',
  reqGuess = '',
): Promise<ManakRequestRow[]> {
  const html = await page.content()
  const url = page.url()
  const detail = parseReceiveDetailPage(html, url)
  const tableRows = parseHtmlTables(html)
  return [...(detail ? [detail] : []), ...tableRows]
    .map((r) => ({
      ...r,
      partyName:
        r.partyName && r.partyName !== 'Unknown Party' ? r.partyName : partyGuess || r.partyName,
      date: r.date || dateGuess || undefined,
      requestNo: r.requestNo || reqGuess || r.requestNo,
      purity: normalizePurity(r.purity),
    }))
    .filter(isQualityRequestRow)
}

async function collectDetailLinks(page: Page, base: string): Promise<string[]> {
  const out = new Set<string>()

  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href))
  for (const href of hrefs) {
    if (looksLikeDetailUrl(href) && !href.toLowerCase().startsWith('javascript:')) {
      out.add(href.startsWith('http') ? href : abs(base, href))
    }
  }

  const html = await page.content()
  const patterns = [
    /AHCReceivingUIDJewellerRequest\.do\?[^"'>\s]+/gi,
    /AHCReceiving[^"'>\s]*\.do\?[^"'>\s]+/gi,
    /UIDJewellerRequest\.do\?[^"'>\s]+/gi,
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html))) {
      out.add(abs(base, `/MANAK/${m[0].replace(/^\/?MANAK\//i, '')}`))
    }
  }

  // ASP.NET __doPostBack often embeds encoded request ids in eventArgument
  const postbacks = [
    ...html.matchAll(/__doPostBack\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/gi),
  ]
  for (const m of postbacks) {
    const arg = m[2] || ''
    if (/request|receive|hmrd|view|select/i.test(m[1]) || /request|receive|\d{6,}/i.test(arg)) {
      // cannot turn into URL — handled via click path
      void arg
    }
  }

  return [...out]
}

type ListRowMeta = {
  cells: string[]
  href: string
  onclick: string
  hasClickable: boolean
  postBackTarget: string
  postBackArg: string
}

async function getTargetRows(page: Page): Promise<number> {
  return page.evaluate(() => {
    const tables = [...document.querySelectorAll('table')]
    let targetRows: HTMLTableRowElement[] | null = null
    for (const t of tables) {
      const headers = [...t.querySelectorAll('th, tr:first-child td')].map((th) =>
        (th.textContent || '').trim().toLowerCase(),
      )
      const hasJeweller = headers.some((h) => h.includes('jeweller') || h.includes('address'))
      const hasDate = headers.some((h) => h.includes('date'))
      if (hasJeweller && (hasDate || headers.some((h) => /s\.?\s*no|sno|action|view|select/.test(h)))) {
        targetRows = [...t.querySelectorAll('tr')].filter(
          (tr) => tr.querySelectorAll('td').length >= 2,
        ) as HTMLTableRowElement[]
        if (targetRows[0]) {
          const txt = (targetRows[0].innerText || '').toLowerCase()
          if (/jeweller|address|request date|s\.?\s*no/.test(txt) && !/\d{7,}/.test(txt)) {
            targetRows = targetRows.slice(1)
          }
        }
        break
      }
    }
    if (!targetRows) {
      for (const t of tables) {
        const rows = [...t.querySelectorAll('tr')].filter(
          (tr) => tr.querySelectorAll('td').length >= 2,
        ) as HTMLTableRowElement[]
        if (rows.length > (targetRows?.length || 0)) targetRows = rows
      }
    }
    return targetRows?.length || 0
  })
}

async function readListRowMeta(page: Page, rowIndex: number): Promise<ListRowMeta | null> {
  return page.evaluate((idx) => {
    const tables = [...document.querySelectorAll('table')]
    let targetRows: HTMLTableRowElement[] | null = null
    for (const t of tables) {
      const headers = [...t.querySelectorAll('th, tr:first-child td')].map((th) =>
        (th.textContent || '').trim().toLowerCase(),
      )
      if (headers.some((h) => h.includes('jeweller') || h.includes('address'))) {
        targetRows = [...t.querySelectorAll('tr')].filter(
          (tr) => tr.querySelectorAll('td').length >= 2,
        ) as HTMLTableRowElement[]
        if (targetRows[0]) {
          const txt = (targetRows[0].innerText || '').toLowerCase()
          if (/jeweller|address|request date|s\.?\s*no/.test(txt) && !/\d{7,}/.test(txt)) {
            targetRows = targetRows.slice(1)
          }
        }
        break
      }
    }
    if (!targetRows) {
      for (const t of tables) {
        const rows = [...t.querySelectorAll('tr')].filter(
          (tr) => tr.querySelectorAll('td').length >= 2,
        ) as HTMLTableRowElement[]
        if (rows.length > (targetRows?.length || 0)) targetRows = rows
      }
    }
    const tr = targetRows?.[idx]
    if (!tr) return null
    const cells = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
    const link = tr.querySelector(
      'a[href*="AHCReceiving"], a[href*="Request"], a[href*="assaying"], a[href*="View"], a[href]',
    ) as HTMLAnchorElement | null
    const onclickEl =
      (link?.getAttribute('onclick') && link) ||
      (tr.getAttribute('onclick') && tr) ||
      (tr.querySelector('[onclick]') as HTMLElement | null)
    const onclick =
      link?.getAttribute('onclick') ||
      tr.getAttribute('onclick') ||
      tr.querySelector('[onclick]')?.getAttribute('onclick') ||
      ''
    let postBackTarget = ''
    let postBackArg = ''
    const pb = /__doPostBack\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/i.exec(onclick)
    if (pb) {
      postBackTarget = pb[1]
      postBackArg = pb[2]
    }
    const hrefRaw = link?.getAttribute('href') || ''
    const href =
      hrefRaw && !hrefRaw.toLowerCase().startsWith('javascript:')
        ? link?.href || ''
        : ''
    return {
      cells,
      href,
      onclick,
      hasClickable: Boolean(link || onclick || onclickEl || tr.querySelector('input, button')),
      postBackTarget,
      postBackArg,
    }
  }, rowIndex)
}

async function waitForDetailSignals(page: Page, timeoutMs = 8000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const url = page.url()
    if (looksLikeDetailUrl(url)) return true
    const hit = await page
      .evaluate(() => {
        const t = (document.body?.innerText || '').slice(0, 12000)
        const hasWeight = /Gross\s*Weight|Weight\s*\(in\s*gms\)|Declared\s*Weight|\bPIC\b|No\.?\s*of\s*(Pieces|Articles)/i.test(
          t,
        )
        const hasItem = /Item\s*Category|Article\s*Name|Jewellery\s*Category|Item\s*Description/i.test(t)
        const stillList = /List of Received Request|assayingAH_List/i.test(t) && /Request Date/i.test(t)
        return hasWeight && hasItem && !stillList
      })
      .catch(() => false)
    if (hit) return true
    await page.waitForTimeout(250)
  }
  return false
}

async function openListRow(
  page: Page,
  context: BrowserContext,
  rowIndex: number,
  meta: ListRowMeta,
): Promise<Page> {
  const before = page.url()
  const beforePages = new Set(context.pages())

  const popupPromise = context.waitForEvent('page', { timeout: 5000 }).catch(() => null)

  if (meta.href && /^https?:/i.test(meta.href) && looksLikeDetailUrl(meta.href)) {
    await page.goto(meta.href, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await waitForDetailSignals(page, 6000)
    return page
  }

  if (meta.postBackTarget) {
    await page.evaluate(
      ({ target, arg }) => {
        const w = window as unknown as { __doPostBack?: (t: string, a: string) => void }
        if (typeof w.__doPostBack === 'function') w.__doPostBack(target, arg)
      },
      { target: meta.postBackTarget, arg: meta.postBackArg },
    )
  } else {
    await page.evaluate((idx) => {
      const tables = [...document.querySelectorAll('table')]
      let targetRows: HTMLTableRowElement[] | null = null
      for (const t of tables) {
        const headers = [...t.querySelectorAll('th, tr:first-child td')].map((th) =>
          (th.textContent || '').trim().toLowerCase(),
        )
        if (headers.some((h) => h.includes('jeweller') || h.includes('address'))) {
          targetRows = [...t.querySelectorAll('tr')].filter(
            (tr) => tr.querySelectorAll('td').length >= 2,
          ) as HTMLTableRowElement[]
          if (targetRows[0]) {
            const txt = (targetRows[0].innerText || '').toLowerCase()
            if (/jeweller|address|request date|s\.?\s*no/.test(txt) && !/\d{7,}/.test(txt)) {
              targetRows = targetRows.slice(1)
            }
          }
          break
        }
      }
      if (!targetRows) {
        for (const t of tables) {
          const rows = [...t.querySelectorAll('tr')].filter(
            (tr) => tr.querySelectorAll('td').length >= 2,
          ) as HTMLTableRowElement[]
          if (rows.length > (targetRows?.length || 0)) targetRows = rows
        }
      }
      const tr = targetRows?.[idx]
      if (!tr) return
      const clickable = tr.querySelector(
        'a[href], button, input[type="button"], input[type="submit"], input[type="image"], [onclick]',
      ) as HTMLElement | null
      ;(clickable || tr).click()
    }, rowIndex)
  }

  const popup = await popupPromise
  if (popup) {
    await popup.waitForLoadState('domcontentloaded').catch(() => {})
    await waitForDetailSignals(popup, 8000)
    return popup
  }

  // New page may appear without firing waitForEvent in time
  const fresh = context.pages().find((p) => !beforePages.has(p) && !p.isClosed())
  if (fresh) {
    await fresh.waitForLoadState('domcontentloaded').catch(() => {})
    await waitForDetailSignals(fresh, 8000)
    return fresh
  }

  await page
    .waitForURL((url) => url.toString() !== before || looksLikeDetailUrl(url.toString()), {
      timeout: 10000,
    })
    .catch(() => {})
  await waitForDetailSignals(page, 8000)
  return page
}

/** Scrape Gold Shark list URL + click into rows for Item/PIC/Weight */
export async function scrapeAssayingList(
  page: Page,
  base: string,
): Promise<{ requests: ManakRequestRow[]; pagesTried: string[]; listRowCount: number }> {
  const pagesTried: string[] = []
  const collected: ManakRequestRow[] = []
  const context = page.context()
  const listUrl = abs(base, RECEIVED_LIST_PATH)

  // If user already opened a detail in Chrome, parse it first (manual hint in UI message)
  try {
    for (const p of context.pages()) {
      if (p.isClosed()) continue
      const u = p.url()
      if (!/manakonline/i.test(u)) continue
      pagesTried.push(`active:${u}`)
      if (looksLikeDetailUrl(u) || !looksLikeListUrl(u)) {
        const batch = await parsePageRequests(p)
        collected.push(...batch)
      }
    }
  } catch {
    /* ignore */
  }

  pagesTried.push(listUrl)
  await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1500)

  if (/eBISLogin|\/login|HallmarkingLogin/i.test(page.url())) {
    return { requests: collected.filter(isQualityRequestRow), pagesTried, listRowCount: 0 }
  }

  const listRowCount = await getTargetRows(page)
  const clicks = Math.min(listRowCount, MAX_LIST_ROWS)

  for (let i = 0; i < clicks; i++) {
    let detailPage: Page | null = null
    try {
      if (!looksLikeListUrl(page.url())) {
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(700)
      }

      const meta = await readListRowMeta(page, i)
      if (!meta) continue

      const partyGuess =
        meta.cells.find(
          (c) => c.length > 8 && !/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(c) && !/^\d{1,4}$/.test(c),
        ) ||
        meta.cells.find((c) => /[A-Za-z]{3,}/.test(c) && c.length > 5) ||
        ''
      const dateGuess = meta.cells.find((c) => /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(c)) || ''
      const reqGuess = meta.cells.find((c) => /^\d{7,}$/.test(c.replace(/\s/g, ''))) || ''

      detailPage = await openListRow(page, context, i, meta)
      pagesTried.push(`detail-row-${i}:${detailPage.url()}`)

      const batch = await parsePageRequests(detailPage, partyGuess, dateGuess, reqGuess)
      collected.push(...batch)

      // Close popup tabs so we don't accumulate; keep main list page
      if (detailPage !== page && !detailPage.isClosed()) {
        await detailPage.close().catch(() => {})
      } else if (looksLikeDetailUrl(page.url()) || !looksLikeListUrl(page.url())) {
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
        await page.waitForTimeout(500)
      }
    } catch (e) {
      console.warn(`[shrija-scrap] row ${i} failed`, e instanceof Error ? e.message : e)
      if (detailPage && detailPage !== page && !detailPage.isClosed()) {
        await detailPage.close().catch(() => {})
      }
      try {
        if (!looksLikeListUrl(page.url())) {
          await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        }
      } catch {
        /* ignore */
      }
    }
  }

  try {
    if (!looksLikeListUrl(page.url())) {
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    }
    for (const detailUrl of (await collectDetailLinks(page, base)).slice(0, MAX_LIST_ROWS)) {
      pagesTried.push(detailUrl)
      await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(500)
      collected.push(...(await parsePageRequests(page)))
    }
  } catch {
    /* ignore */
  }

  const seen = new Set<string>()
  const requests = collected.filter((r) => {
    if (!isQualityRequestRow(r)) return false
    const key = r.requestNo || `${r.partyName}:${r.item}:${r.weight}:${r.pic}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { requests, pagesTried, listRowCount }
}
