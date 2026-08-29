const STYLE_ID = 'shrija-fire-assay-page-style'
const ATTR = 'data-fire-assay-print'

/** Inject A4 portrait @page for native Print Preview / Save as PDF. Does not scale the sheet. */
export function applyFireAssayPaperForPrint() {
  document.documentElement.setAttribute(ATTR, 'a4')
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = `@page {
    size: A4 portrait;
    margin: 8mm;
}`
}

export function printFireAssaySheet() {
  applyFireAssayPaperForPrint()
  const cleanup = () => {
    document.documentElement.removeAttribute(ATTR)
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}
