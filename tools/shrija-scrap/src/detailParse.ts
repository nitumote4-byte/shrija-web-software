import {
  mergeArticleRows,
  normalizePurity,
  parseHtmlTables,
  type ManakRequestRow,
} from './parseTables.js'

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
    const decoded = b64Decode(enc) || enc
    const digits = decoded.replace(/\D/g, '')
    return digits.length >= 6 ? digits : decoded
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
  const plain = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*[:\\-]?\\s*</(?:td|th|label|span|div)>\\s*<(?:td|span|div)[^>]*>\\s*([^<]+)`,
      'i',
    )
    const m = re.exec(plain)
    if (m?.[1]?.trim()) return m[1].trim()
    const re2 = new RegExp(`${label}\\s*[:\\-]\\s*([A-Za-z0-9][A-Za-z0-9 .\\-/]*)`, 'i')
    const m2 = re2.exec(plain.replace(/<[^>]+>/g, ' '))
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
    const re3 = new RegExp(
      `<select[^>]*(?:name|id)=["'][^"']*${hint}[^"']*["'][^>]*>[\\s\\S]*?<option[^>]*selected[^>]*>([^<]+)`,
      'i',
    )
    const m3 = re3.exec(html)
    if (m3?.[1]?.trim() && !/^select/i.test(m3[1])) return m3[1].trim()
  }
  return ''
}

export function parseReceiveDetailPage(html: string, pageUrl: string): ManakRequestRow | null {
  const requestNoFromUrl = requestIdFromReceiveUrl(pageUrl)
  const cmlFromUrl = cmlFromReceiveUrl(pageUrl)

  const partyName =
    labelValue(html, [
      'Jeweller Name',
      'Jeweller',
      'Party Name',
      'Party',
      'Customer',
      'Outlet',
      'Firm Name',
      'Jeweller Address',
    ]) || inputValue(html, ['jeweller', 'party', 'outlet', 'customerName', 'firm'])

  const requestNo =
    labelValue(html, ['Request No', 'Request Number', 'Request ID', 'Hallmarking Request']) ||
    inputValue(html, ['Request', 'requestId', 'reqNo', 'eRequestId']) ||
    requestNoFromUrl

  const receiptNo =
    labelValue(html, ['Receipt', 'Ack', 'Acknowledgement', 'Receipt No']) ||
    inputValue(html, ['receipt', 'ack'])
  const jobCardNo =
    labelValue(html, ['Job Card', 'Job No', 'Job Number', 'Job Card No']) ||
    inputValue(html, ['job'])
  const cml =
    labelValue(html, ['CML', 'Licence', 'License', 'CML No']) ||
    inputValue(html, ['cml', 'licence']) ||
    cmlFromUrl

  const purity = normalizePurity(
    labelValue(html, ['Purity', 'Declared Purity', 'Fineness']) ||
      inputValue(html, ['purity', 'fineness']) ||
      '916',
  )

  const fromTable = parseHtmlTables(html)
  const withMetrics = fromTable.filter((r) => r.pic > 0 || r.weight > 0)

  if (withMetrics.length >= 1) {
    const merged = mergeArticleRows(withMetrics, {
      partyName: partyName || withMetrics[0].partyName,
      requestNo: requestNo || withMetrics[0].requestNo,
      receiptNo,
      jobCardNo,
      cml,
      purity,
    })
    if (merged) return merged
  }

  const item =
    labelValue(html, ['Item', 'Article', 'Jewellery', 'Category', 'Item Category', 'Item Description']) ||
    inputValue(html, ['item', 'category', 'article']) ||
    'Jewellery'

  const picRaw =
    labelValue(html, [
      'PIC',
      'Pcs',
      'Pieces',
      'Quantity',
      'No of Pieces',
      'No. of Pieces',
      'No of Articles',
      'No. of Articles',
      'No.Of Articles',
      'No Of Pic',
      'Total PIC',
      'Total Pieces',
      'Qty',
    ]) || inputValue(html, ['pic', 'pcs', 'qty', 'quantity', 'piece', 'article', 'noOfArticle'])
  const wtRaw =
    labelValue(html, [
      'Weight',
      'Gross Weight',
      'Declared Weight',
      'Total Weight',
      'Wt',
      'Weight (in gms)',
      'Weight (In Gms)',
      'Weight in Grams',
      'Weight in Gms',
      'Gross Wt',
      'Declared Wt',
    ]) || inputValue(html, ['weight', 'gross', 'wt', 'declaredWeight', 'totalWeight'])

  let pic = Math.max(0, Number.parseInt(String(picRaw).replace(/,/g, ''), 10) || 0)
  let weight = Number.parseFloat(String(wtRaw).replace(/,/g, '')) || 0

  // Plain-text fallback (Manak labels vary / sit outside tidy table cells)
  if (pic <= 0 || weight <= 0) {
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
    if (pic <= 0) {
      const m =
        /(?:No\.?\s*of\s*(?:Pieces|Articles|PIC)|Total\s*PIC|PIC|Pcs)\s*[:\-]?\s*(\d{1,6})/i.exec(
          text,
        )
      if (m) pic = Number.parseInt(m[1], 10) || 0
    }
    if (weight <= 0) {
      const m =
        /(?:Gross\s*Weight|Declared\s*Weight|Total\s*Weight|Weight\s*\(?\s*in\s*gms?\s*\)?|Weight)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i.exec(
          text,
        )
      if (m) weight = Number.parseFloat(m[1]) || 0
    }
  }

  if (!requestNo && !partyName) {
    if (fromTable[0] && (fromTable[0].pic > 0 || fromTable[0].weight > 0)) return fromTable[0]
    return null
  }

  // Detail without metrics is not usable for Auto Request
  if (pic <= 0 && weight <= 0) return null

  return {
    partyName: partyName || 'Unknown Party',
    item,
    pic,
    weight,
    purity,
    requestNo: requestNo || `MANAK-${Date.now()}`,
    receiptNo,
    jobCardNo,
    cml,
  }
}
