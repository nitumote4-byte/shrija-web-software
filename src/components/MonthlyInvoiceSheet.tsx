import { FileText } from 'lucide-react'
import { formatInvoiceDateTime } from './InvoiceChallan'
import { InvoicePaperSizeToggle } from './InvoicePaperSizeToggle'
import { getInvoiceHeader } from '../data/firmProfile'
import type { MonthlyInvoice, MonthlyInvoiceLine } from '../data/store'
import type { InvoicePaperSize } from '../utils/invoicePaper'

function money(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export type MonthlyPreview = {
  invoiceNo: string
  invoiceDateTime: string
  partyName: string
  partyGstin: string
  partyCml: string
  placeOfSupply: string
  stateCode: string
  period?: string
  sac?: string
  lines: MonthlyInvoiceLine[]
  taxable: number
  cgst: number
  sgst: number
  igst: number
  grandTotal: number
  useIgst: boolean
}

export function monthlyInvoiceToPreview(inv: MonthlyInvoice): MonthlyPreview {
  return {
    invoiceNo: inv.invoiceNo,
    invoiceDateTime: inv.invoiceDateTime || inv.date,
    partyName: inv.partyName,
    partyGstin: inv.partyGstin || '',
    partyCml: inv.partyCml || '',
    placeOfSupply: inv.placeOfSupply || '',
    stateCode: inv.stateCode || '',
    period: inv.period || 'Monthly Summary',
    sac: inv.sac || '998346',
    lines: inv.lines || [],
    taxable: inv.amount,
    cgst: inv.cgst,
    sgst: inv.sgst,
    igst: inv.igst,
    grandTotal: inv.total,
    useIgst: inv.useIgst,
  }
}

type SheetProps = {
  view: MonthlyPreview | null
  paperSize: InvoicePaperSize
  printId?: string
}

export function MonthlyInvoiceSheet({
  view,
  paperSize,
  printId = 'monthly-invoice-print',
}: SheetProps) {
  const header = getInvoiceHeader()
  const centreName = header.centreName
  const centreAddr =
    header.centreKind === 'osc'
      ? `${header.centreAddress}${header.firmName ? ` (Outlet of ${header.firmName})` : ''}`
      : header.centreAddress
  const minRows = paperSize === 'A5' ? 8 : 12
  const filler = Math.max(0, minRows - Math.max(view?.lines.length || 0, 0))

  return (
    <div
      className={`invoice-sheet paper-${paperSize.toLowerCase()} invoice-fill-page`}
      id={printId}
      data-paper={paperSize}
    >
      <div className="invoice-sheet-topblock">
        <div className="invoice-centre-head">
          <strong>{centreName}</strong>
          <div className="invoice-centre-addr">{centreAddr || '\u00A0'}</div>
          <div className="invoice-gstin">CENTRE GSTIN: {header.centreGstin}</div>
        </div>
        <div className="invoice-title-bar">
          <h2>MONTHLY CONSOLIDATED INVOICE</h2>
        </div>
        <div className="invoice-meta-grid">
          <div className="invoice-party invoice-meta-box">
            <div>
              <span>Bill To:</span> {view?.partyName || ''}
            </div>
            <div>
              <span>GSTIN:</span> {view?.partyGstin || ''}
            </div>
            <div>
              <span>CML:</span> {view?.partyCml || ''}
            </div>
            <div>
              <span>Place of Supply:</span>{' '}
              {view?.placeOfSupply
                ? `${view.placeOfSupply}${view.stateCode ? ` (Code: ${view.stateCode})` : ''}`
                : ''}
            </div>
          </div>
          <div className="invoice-doc invoice-meta-box">
            <div>
              <span>Invoice No:</span> {view?.invoiceNo || '—'}
            </div>
            <div>
              <span>Invoice Date:</span>{' '}
              {view ? formatInvoiceDateTime(view.invoiceDateTime) : ''}
            </div>
            <div>
              <span>SAC:</span> {view?.sac || '998346'}
            </div>
            <div>
              <span>Period:</span> {view?.period || 'Monthly Summary'}
            </div>
          </div>
        </div>
      </div>

      <div className="invoice-table-grow">
        <table className="invoice-items">
          <thead>
            <tr>
              <th>S No.</th>
              <th>Request No</th>
              <th>Party Name</th>
              <th>Date</th>
              <th>No Of Articles HM</th>
              <th>Amount (Taxable)</th>
            </tr>
          </thead>
          <tbody>
            {!view || view.lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="invoice-empty">
                  &nbsp;
                </td>
              </tr>
            ) : (
              view.lines.map((line, i) => (
                <tr key={`${line.requestNo}-${i}`}>
                  <td>{i + 1}</td>
                  <td>{line.requestNo}</td>
                  <td>{line.partyName}</td>
                  <td>{line.date}</td>
                  <td>{line.articlesHm}</td>
                  <td>{money(line.amount)}</td>
                </tr>
              ))
            )}
            <tr className="invoice-spacer-row" aria-hidden="true">
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
            {Array.from({ length: filler }).map((_, i) => (
              <tr key={`mf-${i}`} className="invoice-filler-row">
                <td colSpan={6}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="invoice-sheet-foot">
        <div className="invoice-bottom-grid">
          <div />
          <div className="invoice-tax">
            <div>
              <span>Total Taxable</span>
              <strong>{view ? money(view.taxable) : '0.00'}</strong>
            </div>
            <div>
              <span>CGST @ 9%</span>
              <strong>{view && !view.useIgst ? money(view.cgst) : '0.00'}</strong>
            </div>
            <div>
              <span>SGST @ 9%</span>
              <strong>{view && !view.useIgst ? money(view.sgst) : '0.00'}</strong>
            </div>
            <div>
              <span>IGST @ 18%</span>
              <strong>{view?.useIgst ? money(view.igst) : '0.00'}</strong>
            </div>
            <div className="invoice-grand">
              <span>Grand Total (Incl. Tax)</span>
              <strong>{view ? money(view.grandTotal) : '0.00'}</strong>
            </div>
          </div>
        </div>
        <div className="invoice-sign-grid">
          <div className="invoice-sign-label">CUSTOMER&apos;S SIGNATURE</div>
          <div className="invoice-auth">
            <div>FOR, {centreName}</div>
            <div className="invoice-sign-space" />
            <div className="invoice-sign-label">Authorized Signatory</div>
          </div>
        </div>
        <div className="invoice-bank">
          {firm.bankName || 'ICICI BANK'}
          {firm.accountNo ? ` | AC No. ${firm.accountNo}` : ''}
          {firm.ifsc ? ` | IFSC Code: ${firm.ifsc}` : ''}
        </div>
      </div>
    </div>
  )
}

type PanelProps = {
  view: MonthlyPreview | null
  paperSize: InvoicePaperSize
  onPaperChange: (size: InvoicePaperSize) => void
  printId?: string
}

export function MonthlyInvoicePreviewPanel({
  view,
  paperSize,
  onPaperChange,
  printId,
}: PanelProps) {
  return (
    <section className="gb-card gb-preview-card">
      <header className="gb-card-head gb-preview-toolbar no-print">
        <FileText size={18} />
        <h2>Invoice Preview</h2>
        <InvoicePaperSizeToggle value={paperSize} onChange={onPaperChange} />
      </header>
      <p className="invoice-hint no-print">Choose A4 or A5, then Print / Download PDF</p>
      <div className={`invoice-preview-stage paper-${paperSize.toLowerCase()}`}>
        <MonthlyInvoiceSheet view={view} paperSize={paperSize} printId={printId} />
      </div>
    </section>
  )
}
