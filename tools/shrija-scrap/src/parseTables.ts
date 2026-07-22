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
  if (/^(unknown party|party name|jeweller)$/i.test(party)) return false
  if (/^gold$/i.test(r.item) && r.weight <= 0 && r.pic <= 0) return false
  if (r.purity === '100' || r.purity === '10' || r.purity === '0') return false
  // Date mistaken as request no, no metrics
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(req) && r.weight <= 0 && r.pic <= 0) return false

  const reqDigits = req.replace(/\D/g, '')
  const hasRealReq = reqDigits.length >= 6
  const hasMetrics = r.pic > 0 || r.weight > 0
  return hasRealReq || hasMetrics
}

/** Parse HTML tables that look like hallmarking request / item lists */
export function parseHtmlTables(html: string): ManakRequestRow[] {
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
  const rows: ManakRequestRow[] = []

  for (const t of tables) {
    const tableHtml = t[1]
    const headerCells = [...tableHtml.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((c) =>
      stripTags(c[1]).toLowerCase(),
    )
    if (headerCells.length < 2) continue

    const col = (names: string[]) =>
      headerCells.findIndex((h) => names.some((n) => h.includes(n)))

    const iParty = col(['party', 'jeweller', 'customer', 'outlet', 'firm'])
    const iAddress = col(['address'])
    const iItem = col(['item', 'article', 'jewellery', 'category', 'ornament'])
    const iPic = col(['pic', 'pcs', 'piece', 'qty', 'quantity', 'no of'])
    const iWeight = col(['weight', 'wt', 'gross'])
    const iPurity = col(['purity', 'fineness', 'karat', 'touch'])
    const iReq = col(['request no', 'request number', 'req no', 'req. no', 'request id', 'hallmark request'])
    // Avoid matching "Request Date" as request number column
    const iReqLoose =
      iReq >= 0 ? iReq : headerCells.findIndex((h) => h.includes('request') && !h.includes('date'))
    const iReceipt = col(['receipt', 'ack', 'voucher'])
    const iJob = col(['job', 'job card', 'jc'])
    const iCml = col(['cml', 'licence', 'license'])
    const iDate = col(['request date', 'date'])

    // Skip pure list stub tables here — handled by click-through scraper
    const isListStub =
      (iAddress >= 0 || (iParty >= 0 && iDate >= 0)) && iItem < 0 && iPic < 0 && iWeight < 0 && iReq < 0
    if (isListStub) continue

    if (iParty < 0 && iAddress < 0 && iReqLoose < 0 && iItem < 0) continue

    const bodyRows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    for (const tr of bodyRows) {
      const cells = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        stripTags(c[1]),
      )
      if (cells.length < 2) continue
      if (cells.every((c) => headerCells.includes(c.toLowerCase()))) continue

      const pick = (idx: number, fallback = '') => (idx >= 0 ? cells[idx] || fallback : fallback)
      const partyName = pick(iParty) || pick(iAddress)
      let requestNo = pick(iReqLoose)
      if (!partyName && !requestNo && !pick(iItem)) continue
      if (/^(party|request|s\.?no|sr|jeweller|item)/i.test(partyName) && !/\d{5,}/.test(partyName)) {
        continue
      }

      const href = /AHCReceivingUIDJewellerRequest\.do\?[^"'>\s]+/i.exec(tr[1])?.[0]
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

      const picRaw = pick(iPic, '0').replace(/,/g, '')
      const wtRaw = pick(iWeight, '0').replace(/,/g, '')
      const date = pick(iDate)
      rows.push({
        partyName: partyName || 'Unknown Party',
        item: pick(iItem, 'Jewellery'),
        pic: Math.max(0, Number.parseInt(picRaw, 10) || 0),
        weight: Number.parseFloat(wtRaw) || 0,
        purity: normalizePurity(pick(iPurity, '916')),
        requestNo: requestNo || '',
        receiptNo: pick(iReceipt),
        jobCardNo: pick(iJob),
        cml: pick(iCml),
        date: date || undefined,
      })
    }
  }

  const seen = new Set<string>()
  return rows.filter((r) => {
    if (!isQualityRequestRow(r) && !(r.requestNo && r.pic > 0)) {
      // keep partial detail rows that at least have request + item metrics after fill
      if (!(r.pic > 0 || r.weight > 0) || !r.requestNo) return false
    }
    const key = r.requestNo || `${r.partyName}:${r.item}:${r.weight}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
