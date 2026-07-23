import type { InvoicePaperSize } from '../utils/invoicePaper'

type Props = {
  value: InvoicePaperSize
  onChange: (size: InvoicePaperSize) => void
}

export function InvoicePaperSizeToggle({ value, onChange }: Props) {
  return (
    <div className="invoice-paper-toggle no-print" role="group" aria-label="Invoice paper size">
      <span className="invoice-paper-label">Preview size</span>
      <button
        type="button"
        className={value === 'A4' ? 'active' : ''}
        onClick={() => onChange('A4')}
      >
        A4
      </button>
      <button
        type="button"
        className={value === 'A5' ? 'active' : ''}
        onClick={() => onChange('A5')}
      >
        A5
      </button>
    </div>
  )
}
