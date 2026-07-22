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

/** Parse HTML tables that look like hallmarking request lists */
export function parseHtmlTables(html: string): ManakRequestRow[] {
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

    if (iParty < 0 && iReq < 0) continue

    const bodyRows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    for (const tr of bodyRows) {
      const cells = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        stripTags(c[1]),
      )
      if (cells.length < 2) continue
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
      })
    }
  }

  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = r.requestNo || `${r.partyName}:${r.item}:${r.weight}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
