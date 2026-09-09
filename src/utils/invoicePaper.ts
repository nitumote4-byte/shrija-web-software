const STYLE_ID = 'shrija-invoice-page-style'
const STORAGE_KEY = 'shrija-invoice-paper-size'

export type InvoicePaperSize = 'A4' | 'A5'
/** fill = daily challan (one paper, same as preview). flow = monthly (can span pages). */
export type InvoicePrintMode = 'fill' | 'flow'

export function loadInvoicePaperSize(): InvoicePaperSize {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'A5' || v === 'A4') return v
  } catch {
    /* ignore */
  }
  return 'A4'
}

export function saveInvoicePaperSize(size: InvoicePaperSize) {
  try {
    localStorage.setItem(STORAGE_KEY, size)
  } catch {
    /* ignore */
  }
}

export function invoicePageCss(size: InvoicePaperSize, mode: InvoicePrintMode = 'fill'): string {
  // fill: sheet is the paper (preview 210×297 / 148×210). flow: browser page margins for multi-page.
  const margin = mode === 'fill' ? '0' : size === 'A5' ? '6mm' : '8mm'
  return `@page { size: ${size} portrait; margin: ${margin}; }`
}

/** Inject @page size so browser Print uses A4 or A5. */
export function applyInvoicePaperForPrint(
  size: InvoicePaperSize,
  mode: InvoicePrintMode = 'fill',
) {
  document.documentElement.setAttribute('data-invoice-paper', size.toLowerCase())
  document.documentElement.setAttribute('data-invoice-print', mode)
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = invoicePageCss(size, mode)
}

export function clearInvoicePaperForPrint() {
  document.documentElement.removeAttribute('data-invoice-paper')
  document.documentElement.removeAttribute('data-invoice-print')
  document.getElementById(STYLE_ID)?.remove()
}

export function printInvoiceSheet(size: InvoicePaperSize, mode: InvoicePrintMode = 'fill') {
  applyInvoicePaperForPrint(size, mode)
  window.print()
}
