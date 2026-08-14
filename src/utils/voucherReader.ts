import { normalizeItemCategoryName } from './itemCategoryMatch'

export type VoucherLine = {
  item: string
  pic: string
  weight: string
  purity: string
  requestNo: string
  receiptNo: string
  jobCardNo: string
}

const LABEL_ONLY_ITEM =
  /^(item|items|category|categories|quantity|weight|purity|declared|received|observed|total|request|receipt|pic|pcs|qty|article|jewellery)$/i

function normalizePurity(raw: string): string {
  const t = raw.replace(/\s+/g, '').toUpperCase()
  if (/22.?K|916/.test(t)) return '22K916'
  if (/18.?K|750/.test(t)) return '18K750'
  if (/14.?K|585/.test(t)) return '14K585'
  if (/24.?K|999/.test(t)) return '24K999'
  if (/925|SILVER/.test(t)) return 'Silver925'
  return t || ''
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
}

function digitsFromFilename(name: string): { requestNo: string; receiptNo: string } {
  const nums = name.match(/\d{6,}/g) ?? []
  const requestNo = nums[nums.length - 1] ?? Date.now().toString().slice(-9)
  const receiptNo =
    nums.length > 1
      ? nums[nums.length - 2]
      : String(Math.max(10000000, Number(requestNo.slice(0, 8)) - 90000000))
  return { requestNo, receiptNo }
}

function extractLabeledNumber(text: string, labels: string[]): string {
  for (const label of labels) {
    const re = new RegExp(`${escapeRe(label)}\\s*[:-]?\\s*(\\d+(?:\\.\\d+)?)`, 'i')
    const m = re.exec(text)
    if (m?.[1]) return m[1]
  }
  return ''
}

function extractLabeledText(text: string, labels: string[]): string {
  for (const label of labels) {
    const re = new RegExp(
      `${escapeRe(label)}\\s*[:-]?\\s*([A-Za-z0-9][A-Za-z0-9 .'-]*?)(?=\\s{2,}|\\s+(?:Item\\s*Categor|Quantity|Qty|PIC|Pcs|Weight|Declared|Received|Observed|Total|Request|Receipt|Purity|Job)\\b|$)`,
      'i',
    )
    const m = re.exec(text)
    if (m?.[1]?.trim()) return m[1].trim().replace(/\s+/g, ' ')
  }
  return ''
}

function extractItemCategory(text: string): string {
  const m =
    /Item\s*Categor(?:y|ies)(?!\s+Weight)\s*[:-]?\s*([A-Za-z][A-Za-z .'-]*?)(?=\s+(?:Quantity|Qty|PIC|Pcs|Weight|Declared|Received|Observed|Total|Request|Receipt|Purity|Job|No\.?\s*of)\b|\s+\d|$)/i.exec(
      text,
    )
  const item = m?.[1]?.trim().replace(/\s+/g, ' ') ?? ''
  if (!item || LABEL_ONLY_ITEM.test(item)) return ''
  return item
}

function extractRequestReceipt(
  text: string,
  fileNos: { requestNo: string; receiptNo: string },
): { requestNo: string; receiptNo: string } {
  const requestNo =
    /Request\s*(?:No\.?|Number|#)?\s*[:-]?\s*(\d{6,})/i.exec(text)?.[1] ?? fileNos.requestNo
  const receiptNo =
    /Receipt\s*(?:No\.?|Number|#)?\s*[:-]?\s*(\d{6,})/i.exec(text)?.[1] ?? fileNos.receiptNo
  return { requestNo, receiptNo }
}

function emptyLine(nos: { requestNo: string; receiptNo: string }): VoucherLine {
  return {
    item: '',
    pic: '',
    weight: '',
    purity: '',
    requestNo: nos.requestNo,
    receiptNo: nos.receiptNo,
    jobCardNo: '',
  }
}

function parseAhcLabeledItems(
  text: string,
  nos: { requestNo: string; receiptNo: string },
): VoucherLine[] {
  const parts = text
    .replace(/\r/g, '\n')
    .split(/(?=Item\s*Categor(?:y|ies)(?!\s+Weight)\b)/i)
  const lines: VoucherLine[] = []

  for (const part of parts) {
    if (!/Item\s*Categor(?:y|ies)(?!\s+Weight)\b/i.test(part)) continue
    const item = extractItemCategory(part)
    const pic = extractLabeledNumber(part, [
      'Received Quantity by AHC',
      'Quantity',
      'No. of Pieces',
      'No of Pieces',
      'PIC',
      'Pcs',
      'Qty',
    ])
    const weight = extractLabeledNumber(part, [
      'Total Item Category Weight',
      'Observed Item Category Weight',
      'Total Weight',
      'Gross Weight',
      'Weight',
    ])
    const purityRaw = extractLabeledText(part, ['Declared Purity', 'Purity'])
    const jobCardNo = extractLabeledText(part, ['Job Card No', 'Job Card Number', 'Job Card'])

    if (!item) continue

    lines.push({
      item,
      pic,
      weight,
      purity: purityRaw ? normalizePurity(purityRaw) : '',
      requestNo: nos.requestNo,
      receiptNo: nos.receiptNo,
      jobCardNo,
    })
  }

  return lines
}

function parseStructuredLines(
  text: string,
  nos: { requestNo: string; receiptNo: string },
): VoucherLine[] {
  const lines: VoucherLine[] = []
  const cleaned = text.replace(/\r/g, '\n')

  const rowRe =
    /([A-Za-z][A-Za-z\s]{2,30}?)\s+[|:,-]?\s*(\d{1,5})\s+[|:,-]?\s*(\d+(?:\.\d+)?)\s+[|:,-]?\s*((?:22|18|14|24)\s*K?\s*\d{3}|916|750|585|999|925)/gi

  let m: RegExpExecArray | null
  while ((m = rowRe.exec(cleaned)) !== null) {
    const item = m[1].trim().replace(/\s+/g, ' ')
    if (!item || LABEL_ONLY_ITEM.test(item)) continue
    lines.push({
      item,
      pic: m[2],
      weight: m[3],
      purity: normalizePurity(m[4]),
      requestNo: nos.requestNo,
      receiptNo: nos.receiptNo,
      jobCardNo: '',
    })
  }

  if (lines.length > 0) return lines

  for (const line of cleaned.split('\n')) {
    const cols = line.split(/[,|\t]/).map((c) => c.trim()).filter(Boolean)
    if (cols.length < 3) continue
    const maybeWeight = cols.find((c) => /^\d+(\.\d+)?$/.test(c) && Number(c) > 0.1)
    const maybePic = cols.find((c) => /^\d{1,4}$/.test(c))
    const maybePurity = cols.find((c) => /916|750|585|999|925|K/i.test(c))
    const maybeItem = cols.find(
      (c) =>
        /^[A-Za-z][A-Za-z .'-]{1,40}$/.test(c) &&
        !LABEL_ONLY_ITEM.test(c) &&
        !/916|750|585|999|925|^\d/i.test(c),
    )
    if (maybeItem && maybeWeight) {
      lines.push({
        item: maybeItem,
        pic: maybePic ?? '',
        weight: maybeWeight,
        purity: maybePurity ? normalizePurity(maybePurity) : '',
        requestNo: nos.requestNo,
        receiptNo: nos.receiptNo,
        jobCardNo: '',
      })
    }
  }

  return lines
}

function parseFieldFallbacks(
  text: string,
  nos: { requestNo: string; receiptNo: string },
): VoucherLine[] {
  const item =
    extractItemCategory(text) ||
    extractLabeledText(text, ['Article', 'Jewellery Type', 'Item Description'])
  const pic = extractLabeledNumber(text, [
    'Received Quantity by AHC',
    'Quantity',
    'PIC',
    'Pcs',
    'Pieces',
    'Qty',
  ])
  const weight = extractLabeledNumber(text, [
    'Total Item Category Weight',
    'Observed Item Category Weight',
    'Gross Weight',
    'Total Weight',
    'Weight',
  ])
  const purityRaw = extractLabeledText(text, ['Declared Purity', 'Purity'])
  const job =
    /Job\s*Card\s*(?:No|Number|#)?\s*[:-]?\s*([A-Za-z0-9-]+)/i.exec(text)?.[1] ?? ''

  if (!item && !pic && !weight) return []

  return [
    {
      item: item && !LABEL_ONLY_ITEM.test(item) ? item : '',
      pic,
      weight,
      purity: purityRaw ? normalizePurity(purityRaw) : '',
      requestNo: nos.requestNo,
      receiptNo: nos.receiptNo,
      jobCardNo: job,
    },
  ]
}

function mergeMissingMetrics(target: VoucherLine, source: VoucherLine | undefined): VoucherLine {
  if (!source) return target
  return {
    ...target,
    pic: target.pic || source.pic,
    weight: target.weight || source.weight,
    purity: target.purity || source.purity,
    jobCardNo: target.jobCardNo || source.jobCardNo,
  }
}

/** Parse already-extracted voucher text (PDF / CSV / plain). Never defaults item to Locket. */
export function parseVoucherText(
  text: string,
  fileName = '',
): { lines: VoucherLine[]; source: string } {
  const fileNos = digitsFromFilename(fileName)
  const nos = extractRequestReceipt(text, fileNos)

  const labeled = parseAhcLabeledItems(text, nos)
  if (labeled.length === 1) {
    const fallback = parseFieldFallbacks(text, nos)[0]
    labeled[0] = mergeMissingMetrics(labeled[0], fallback)
  }
  if (labeled.some((line) => normalizeItemCategoryName(line.item))) {
    return { lines: labeled, source: 'voucher AHC labels' }
  }

  const structured = parseStructuredLines(text, nos)
  if (structured.length > 0) {
    return { lines: structured, source: 'voucher text' }
  }

  if (text.trim().length > 20) {
    const fallback = parseFieldFallbacks(text, nos)
    if (fallback.length > 0) {
      return { lines: fallback, source: 'voucher fields' }
    }
  }

  return { lines: [emptyLine(nos)], source: 'voucher (filename only)' }
}

async function extractPdfText(file: File): Promise<string> {
  const [pdfjs, workerMod] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    parts.push(pageText)
  }
  return parts.join('\n')
}

async function extractPlainText(file: File): Promise<string> {
  return file.text()
}

export async function readVoucherFile(
  file: File,
  _partyName: string,
): Promise<{ lines: VoucherLine[]; source: string }> {
  const lower = file.name.toLowerCase()
  let text = ''

  try {
    if (lower.endsWith('.pdf')) {
      text = await extractPdfText(file)
    } else if (
      lower.endsWith('.csv') ||
      lower.endsWith('.tsv') ||
      lower.endsWith('.txt') ||
      file.type.startsWith('text/')
    ) {
      text = await extractPlainText(file)
    }
  } catch {
    text = ''
  }

  return parseVoucherText(text, file.name)
}
