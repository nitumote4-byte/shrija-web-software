import type { Page } from 'playwright'
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

async function collectDetailLinks(page: Page, base: string): Promise<string[]> {
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href))
  const out = new Set<string>()
  for (const href of hrefs) {
    if (/AHCReceivingUIDJewellerRequest/i.test(href)) {
      out.add(href.startsWith('http') ? href : abs(base, href))
    }
  }
  const html = await page.content()
  const re = /AHCReceivingUIDJewellerRequest\.do\?[^"'>\s]+/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    out.add(abs(base, `/MANAK/${m[0]}`))
  }
  return [...out]
}

/** Scrape Gold Shark list URL + click into rows for Item/PIC/Weight */
export async function scrapeAssayingList(
  page: Page,
  base: string,
): Promise<{ requests: ManakRequestRow[]; pagesTried: string[]; listRowCount: number }> {
  const pagesTried: string[] = []
  const collected: ManakRequestRow[] = []
  const listUrl = abs(base, RECEIVED_LIST_PATH)
  pagesTried.push(listUrl)

  await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1500)

  // If redirected to login, abort with empty — caller handles message
  if (/eBISLogin|\/login|HallmarkingLogin/i.test(page.url())) {
    return { requests: [], pagesTried, listRowCount: 0 }
  }

  const listRowCount = await page.evaluate(() => {
    const tables = [...document.querySelectorAll('table')]
    for (const t of tables) {
      const headers = [...t.querySelectorAll('th')].map((th) =>
        (th.textContent || '').trim().toLowerCase(),
      )
      const hasJeweller = headers.some((h) => h.includes('jeweller') || h.includes('address'))
      const hasDate = headers.some((h) => h.includes('date'))
      if (hasJeweller && (hasDate || headers.some((h) => /s\.?\s*no|sno/.test(h)))) {
        return [...t.querySelectorAll('tr')].filter((tr) => tr.querySelectorAll('td').length >= 2)
          .length
      }
    }
    let max = 0
    for (const t of tables) {
      const n = [...t.querySelectorAll('tr')].filter((tr) => tr.querySelectorAll('td').length >= 2)
        .length
      if (n > max) max = n
    }
    return max
  })

  const clicks = Math.min(listRowCount, MAX_LIST_ROWS)
  for (let i = 0; i < clicks; i++) {
    try {
      if (!/assayingAH_List/i.test(page.url())) {
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(600)
      }

      const meta = await page.evaluate((rowIndex) => {
        const tables = [...document.querySelectorAll('table')]
        let targetRows: HTMLTableRowElement[] | null = null
        for (const t of tables) {
          const headers = [...t.querySelectorAll('th')].map((th) =>
            (th.textContent || '').trim().toLowerCase(),
          )
          if (headers.some((h) => h.includes('jeweller') || h.includes('address'))) {
            targetRows = [...t.querySelectorAll('tr')].filter(
              (tr) => tr.querySelectorAll('td').length >= 2,
            ) as HTMLTableRowElement[]
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
        const tr = targetRows?.[rowIndex]
        if (!tr) return null
        const cells = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
        const link = tr.querySelector('a[href]') as HTMLAnchorElement | null
        return { cells, href: link?.href || '' }
      }, i)

      if (!meta) continue
      const partyGuess =
        meta.cells.find((c) => c.length > 8 && !/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(c)) ||
        meta.cells[meta.cells.length - 1] ||
        ''
      const dateGuess = meta.cells.find((c) => /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(c)) || ''

      if (meta.href && /AHCReceivingUIDJewellerRequest|assaying|Request/i.test(meta.href)) {
        pagesTried.push(meta.href)
        await page.goto(meta.href, { waitUntil: 'domcontentloaded', timeout: 30000 })
      } else {
        await page.evaluate((rowIndex) => {
          const tables = [...document.querySelectorAll('table')]
          let targetRows: HTMLTableRowElement[] | null = null
          for (const t of tables) {
            const headers = [...t.querySelectorAll('th')].map((th) =>
              (th.textContent || '').trim().toLowerCase(),
            )
            if (headers.some((h) => h.includes('jeweller') || h.includes('address'))) {
              targetRows = [...t.querySelectorAll('tr')].filter(
                (tr) => tr.querySelectorAll('td').length >= 2,
              ) as HTMLTableRowElement[]
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
          const tr = targetRows?.[rowIndex]
          if (!tr) return
          const clickable = tr.querySelector(
            'a, button, input[type="button"], input[type="submit"]',
          ) as HTMLElement | null
          ;(clickable || tr).click()
        }, i)
        await page.waitForTimeout(1200)
      }

      await page.waitForTimeout(600)
      const html = await page.content()
      pagesTried.push(`detail-row-${i}:${page.url()}`)

      const detail = parseReceiveDetailPage(html, page.url())
      const batch = [...(detail ? [detail] : []), ...parseHtmlTables(html)]
        .map((r) => ({
          ...r,
          partyName:
            r.partyName && r.partyName !== 'Unknown Party' ? r.partyName : partyGuess || r.partyName,
          date: r.date || dateGuess || undefined,
          purity: normalizePurity(r.purity),
        }))
        .filter(isQualityRequestRow)

      collected.push(...batch)
    } catch (e) {
      console.warn(`[shrija-scrap] row ${i} failed`, e instanceof Error ? e.message : e)
    }
  }

  try {
    if (!/assayingAH_List/i.test(page.url())) {
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    }
    for (const detailUrl of (await collectDetailLinks(page, base)).slice(0, MAX_LIST_ROWS)) {
      pagesTried.push(detailUrl)
      await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(350)
      const html = await page.content()
      const detail = parseReceiveDetailPage(html, detailUrl)
      if (detail && isQualityRequestRow(detail)) collected.push(detail)
      collected.push(...parseHtmlTables(html).filter(isQualityRequestRow))
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
