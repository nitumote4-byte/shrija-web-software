export type ManakRequestRow = {
  partyName: string
  item: string
  pic: number
  weight: number
  purity: string
  requestNo: string
  receiptNo: string
  jobCardNo: string
  cml: string
  date?: string
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

export function normalizePurity(raw: string): string {
  const s = String(raw || '')
  if (/22\s*k|916/i.test(s)) return '916'
  if (/999/.test(s)) return '999'
  if (/995/.test(s)) return '995'
  if (/958|18\s*k/i.test(s)) return '958'
  if (/750|18ct/i.test(s)) return '750'
  if (/585|14\s*k/i.test(s)) return '585'
  const all = s.match(/\d{3}/g)
  if (all?.length) return all[all.length - 1]
  return '916'
}

/** Drop junk rows from unrelated Manak tables / list-only stubs */
export function isQualityRequestRow(r: ManakRequestRow): boolean {
  const party = (r.partyName || '').trim()
  const req = (r.requestNo || '').trim()
  if (!party && !req) return false
  if (/^\d{1,4}$/.test(party)) return false
  if (/^(unknown party|party name|jeweller|select|metal)$/i.test(party)) return false
  if (/^gold$/i.test(r.item) && r.weight <= 0 && r.pic <= 0) return false
  if (r.purity === '100' || r.purity === '10' || r.purity === '0') return false
  // Date mistaken as request no
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(req)) return false
  // Address-only stubs with no metrics
  if (r.weight <= 0 && r.pic <= 0) return false

  const reqDigits = req.replace(/\D/g, '')
  const hasRealReq = reqDigits.length >= 6
  const hasMetrics = r.pic > 0 || r.weight > 0
  return hasMetrics && (hasRealReq || party.length >= 5)
}

function headerIndex(headers: string[], names: string[]) {
  return headers.findIndex((h) => names.some((n) => h.includes(n)))
}

function looksLikeHeaderRow(cells: string[]): boolean {
  const joined = cells.join(' ').toLowerCase()
  let hits = 0
  if (/party|jeweller|customer|outlet|firm|address/.test(joined)) hits++
  if (/item|article|ornament|categor|description/.test(joined)) hits++
  if (/pic|pcs|piece|qty|quantity|no\.?\s*of|articles/.test(joined)) hits++
  if (/weight|wt\.?|gross|grams?|gms?/.test(joined)) hits++
  if (/purity|fineness|karat|touch/.test(joined)) hits++
  if (/request/.test(joined)) hits++
  return hits >= 2
}

type ColMap = {
  iParty: number
  iAddress: number
  iItem: number
  iPic: number
  iWeight: number
  iPurity: number
  iReq: number
  iReceipt: number
  iJob: number
  iCml: number
  iDate: number
}

function mapColumns(headerCells: string[]): ColMap {
  const col = (names: string[]) => headerIndex(headerCells, names)
  const iReqStrict = col([
    'request no',
    'request number',
    'req no',
    'req. no',
    'request id',
    'hallmark request',
    'hm request',
  ])
  const iReqLoose =
    iReqStrict >= 0
      ? iReqStrict
      : headerCells.findIndex((h) => h.includes('request') && !h.includes('date'))
  return {
    iParty: col(['party', 'jeweller', 'customer', 'outlet', 'firm']),
    iAddress: col(['address']),
    iItem: col(['item', 'article', 'jewellery', 'category', 'ornament', 'description']),
    iPic: col([
      'pic',
      'pcs',
      'piece',
      'qty',
      'quantity',
      'no of',
      'no. of',
      'articles',
      'no of articles',
      'no. of articles',
      'no of pic',
    ]),
    iWeight: col(['weight', 'wt', 'gross', 'gms', 'grams']),
    iPurity: col(['purity', 'fineness', 'karat', 'touch', 'declared purity']),
    iReq: iReqLoose,
    iReceipt: col(['receipt', 'ack', 'voucher']),
    iJob: col(['job', 'job card', 'jc']),
    iCml: col(['cml', 'licence', 'license']),
    iDate: col(['request date', 'date']),
  }
}

function isMetalDropdownTable(headerCells: string[], sampleCells: string[]): boolean {
  const h = headerCells.join(' ')
  if (/\bmetal\b|\bselect\b/.test(h) && !/pic|weight|article|jeweller/.test(h)) return true
  const sample = sampleCells.join(' ').toLowerCase()
  if (/^(gold|silver|platinum)$/i.test(sampleCells[0] || '') && /100|916|999/.test(sample)) {
    if (!/pic|weight|piece/.test(h)) return true
  }
  return false
}

function parseRowCells(
  cells: string[],
  map: ColMap,
  trHtml: string,
): ManakRequestRow | null {
  const pick = (idx: number, fallback = '') => (idx >= 0 ? cells[idx] || fallback : fallback)
  const partyName = pick(map.iParty) || pick(map.iAddress)
  let requestNo = pick(map.iReq)
  if (!partyName && !requestNo && !pick(map.iItem)) return null
  if (/^(party|request|s\.?no|sr|jeweller|item|select)/i.test(partyName) && !/\d{5,}/.test(partyName)) {
    return null
  }

  const href = /AHCReceivingUIDJewellerRequest\.do\?[^"'>\s]+/i.exec(trHtml)?.[0]
  if (!requestNo && href) {
    const m = /eRequestId=([^&"']+)/i.exec(href)
    if (m) {
      try {
        requestNo = Buffer.from(m[1], 'base64').toString('utf8') || m[1]
      } catch {
        requestNo = m[1]
      }
    }
  }

  // Long numeric cell often is request id when column map missed it
  if (!requestNo || /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(requestNo)) {
    const numeric = cells.find((c) => /^\d{7,}$/.test(c.replace(/\s/g, '')))
    if (numeric) requestNo = numeric.replace(/\s/g, '')
  }

  const picRaw = pick(map.iPic, '0').replace(/,/g, '')
  const wtRaw = pick(map.iWeight, '0').replace(/,/g, '')
  // Sometimes PIC/weight are swapped or unlabeled — recover from numeric cells
  let pic = Math.max(0, Number.parseInt(picRaw, 10) || 0)
  let weight = Number.parseFloat(wtRaw) || 0
  if (pic <= 0 && weight <= 0) {
    const nums = cells
      .map((c) => c.replace(/,/g, '').trim())
      .filter((c) => /^\d+(\.\d+)?$/.test(c))
      .map(Number)
    const intPic = nums.find((n) => Number.isInteger(n) && n > 0 && n < 100000)
    const wt = nums.find((n) => !Number.isInteger(n) && n > 0 && n < 100000)
    if (intPic) pic = intPic
    if (wt) weight = wt
    // both integers: larger often weight in some sheets — prefer small as pic
    if (!wt && nums.length >= 2) {
      const sorted = [...nums].filter((n) => n > 0).sort((a, b) => a - b)
      if (sorted.length >= 2) {
        pic = Math.round(sorted[0])
        weight = sorted[sorted.length - 1]
      }
    }
  }

  return {
    partyName: partyName || 'Unknown Party',
    item: pick(map.iItem, 'Jewellery') || 'Jewellery',
    pic,
    weight,
    purity: normalizePurity(pick(map.iPurity, '916')),
    requestNo: requestNo || '',
    receiptNo: pick(map.iReceipt),
    jobCardNo: pick(map.iJob),
    cml: pick(map.iCml),
    date: pick(map.iDate) || undefined,
  }
}

/** Parse HTML tables that look like hallmarking request / item lists */
export function parseHtmlTables(html: string): ManakRequestRow[] {
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
  const rows: ManakRequestRow[] = []

  for (const t of tables) {
    const tableHtml = t[1]
    let headerCells = [...tableHtml.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((c) =>
      stripTags(c[1]).toLowerCase(),
    )

    const bodyRows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    // Manak often uses <td> header row instead of <th>
    if (headerCells.length < 2 && bodyRows.length > 0) {
      const firstCells = [...bodyRows[0][1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        stripTags(c[1]),
      )
      if (looksLikeHeaderRow(firstCells)) {
        headerCells = firstCells.map((c) => c.toLowerCase())
        bodyRows.shift()
      }
    }

    if (headerCells.length < 2) continue

    const map = mapColumns(headerCells)
    const sample =
      bodyRows[0] &&
      [...bodyRows[0][1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1]))
    if (sample && isMetalDropdownTable(headerCells, sample)) continue

    // Skip pure list stub tables (address + date only) — detail click fills metrics
    const isListStub =
      (map.iAddress >= 0 || (map.iParty >= 0 && map.iDate >= 0)) &&
      map.iItem < 0 &&
      map.iPic < 0 &&
      map.iWeight < 0 &&
      map.iReq < 0
    if (isListStub) continue

    if (map.iParty < 0 && map.iAddress < 0 && map.iReq < 0 && map.iItem < 0 && map.iPic < 0) {
      continue
    }

    for (const tr of bodyRows) {
      const cells = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        stripTags(c[1]),
      )
      if (cells.length < 2) continue
      if (cells.every((c) => headerCells.includes(c.toLowerCase()))) continue
      if (looksLikeHeaderRow(cells)) continue

      const row = parseRowCells(cells, map, tr[1])
      if (row) rows.push(row)
    }
  }

  const seen = new Set<string>()
  return rows.filter((r) => {
    if (!isQualityRequestRow(r)) return false
    const key = r.requestNo || `${r.partyName}:${r.item}:${r.weight}:${r.pic}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Merge article lines for one request into a single Auto Request row */
export function mergeArticleRows(
  articles: ManakRequestRow[],
  defaults: Partial<ManakRequestRow>,
): ManakRequestRow | null {
  const usable = articles.filter((r) => r.pic > 0 || r.weight > 0)
  if (!usable.length) return null
  const first = usable[0]
  const pic = usable.reduce((s, r) => s + (r.pic || 0), 0)
  const weight = Number(usable.reduce((s, r) => s + (r.weight || 0), 0).toFixed(3))
  const items = [...new Set(usable.map((r) => r.item).filter(Boolean))]
  return {
    partyName: defaults.partyName || first.partyName || 'Unknown Party',
    item: items.length <= 2 ? items.join(' + ') : `${items[0]} +${items.length - 1} more`,
    pic,
    weight,
    purity: normalizePurity(defaults.purity || first.purity || '916'),
    requestNo: defaults.requestNo || first.requestNo || '',
    receiptNo: defaults.receiptNo || first.receiptNo || '',
    jobCardNo: defaults.jobCardNo || first.jobCardNo || '',
    cml: defaults.cml || first.cml || '',
    date: defaults.date || first.date,
  }
}
