import { normalizePurity, parseHtmlTables, type ManakRequestRow } from './parseTables.js'

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
    labelValue(html, [
      'Jeweller',
      'Party',
      'Customer',
      'Outlet',
      'Firm Name',
      'Jeweller Name',
      'Jeweller Address',
    ]) || inputValue(html, ['jeweller', 'party', 'outlet', 'customerName'])

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
  const purity = normalizePurity(
    labelValue(html, ['Purity', 'Declared Purity', 'Fineness']) ||
      inputValue(html, ['purity', 'fineness']) ||
      '916',
  )

  const receiptNo =
    labelValue(html, ['Receipt', 'Ack', 'Acknowledgement']) || inputValue(html, ['receipt', 'ack'])
  const jobCardNo =
    labelValue(html, ['Job Card', 'Job No', 'Job Number']) || inputValue(html, ['job'])
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
