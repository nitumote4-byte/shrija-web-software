const STYLE_ID = 'shrija-invoice-page-style'
const STORAGE_KEY = 'shrija-invoice-paper-size'

export type InvoicePaperSize = 'A4' | 'A5'

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

/** Inject @page size so browser Print uses A4 or A5. */
export function applyInvoicePaperForPrint(size: InvoicePaperSize) {
  document.documentElement.setAttribute('data-invoice-paper', size.toLowerCase())
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  const margin = size === 'A5' ? '5mm' : '8mm'
  el.textContent = `@page { size: ${size} portrait; margin: ${margin}; }`
}

export function printInvoiceSheet(size: InvoicePaperSize) {
  applyInvoicePaperForPrint(size)
  window.print()
}
