import { FileText } from 'lucide-react'
import { InvoiceChallan, type ChallanView } from './InvoiceChallan'
import { InvoicePaperSizeToggle } from './InvoicePaperSizeToggle'
import type { InvoicePaperSize } from '../utils/invoicePaper'

type Props = {
  view: ChallanView | null
  paperSize: InvoicePaperSize
  onPaperChange: (size: InvoicePaperSize) => void
  printId?: string
  hint?: string
}

/** Shared Invoice Preview (A4/A5) used on Billing + Generated Bills. */
export function InvoicePreviewPanel({
  view,
  paperSize,
  onPaperChange,
  printId,
  hint = 'Choose A4 or A5, then Print / Download PDF',
}: Props) {
  return (
    <section className="gb-card gb-preview-card">
      <header className="gb-card-head gb-preview-toolbar no-print">
        <FileText size={18} />
        <h2>Invoice Preview</h2>
        <InvoicePaperSizeToggle value={paperSize} onChange={onPaperChange} />
      </header>
      {hint ? <p className="invoice-hint no-print">{hint}</p> : null}
      <div className={`invoice-preview-stage paper-${paperSize.toLowerCase()}`}>
        <InvoiceChallan view={view} paperSize={paperSize} printId={printId} />
      </div>
    </section>
  )
}
