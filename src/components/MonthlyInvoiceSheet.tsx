import { FileText } from 'lucide-react'
import { formatInvoiceDateTime } from './InvoiceChallan'
import { InvoiceLetterhead } from './InvoiceLetterhead'
import { InvoicePaperSizeToggle } from './InvoicePaperSizeToggle'
import { getInvoiceHeader } from '../data/firmProfile'
import type { MonthlyInvoice, MonthlyInvoiceLine } from '../data/store'
import type { InvoicePaperSize } from '../utils/invoicePaper'

function money(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Existing monthly-invoice notes copy (reference / prior GoldShark wording). */
const MONTHLY_INVOICE_NOTES =
  'Consolidated Monthly Invoice for above mentioned requests.'

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
  const totHm = view?.lines.reduce((s, l) => s + l.articlesHm, 0) ?? 0
  const totAmount = view?.lines.reduce((s, l) => s + l.amount, 0) ?? 0

  return (
    <div
      className={`invoice-sheet monthly-invoice-sheet paper-${paperSize.toLowerCase()}`}
      id={printId}
      data-paper={paperSize}
    >
      <div className="invoice-sheet-topblock">
        <InvoiceLetterhead />
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

      <div className="monthly-invoice-table-wrap">
        <table className="invoice-items">
          <colgroup>
            <col className="mi-col-sno" />
            <col className="mi-col-req" />
            <col className="mi-col-party" />
            <col className="mi-col-date" />
            <col className="mi-col-hm" />
            <col className="mi-col-amt" />
          </colgroup>
          <thead>
            <tr>
              <th>S. No.</th>
              <th>Request No</th>
              <th>Party Name</th>
              <th>Date</th>
              <th>No Of Articles HM</th>
              <th>Amount (Taxable)</th>
            </tr>
          </thead>
          <tbody>
            {!view || view.lines.length === 0 ? (
              <tr className="invoice-data-row">
                <td colSpan={6} className="invoice-empty">
                  &nbsp;
                </td>
              </tr>
            ) : (
              view.lines.map((line, i) => (
                <tr key={`${line.requestNo}-${i}`} className="invoice-data-row">
                  <td className="mi-td-sno">{i + 1}</td>
                  <td className="mi-td-req">{line.requestNo}</td>
                  <td className="mi-td-party">{line.partyName}</td>
                  <td className="mi-td-date">{line.date}</td>
                  <td className="mi-td-hm">{line.articlesHm}</td>
                  <td className="mi-td-amt">{money(line.amount)}</td>
                </tr>
              ))
            )}
            <tr className="invoice-total-row">
              <td colSpan={4} className="mi-td-total-label">
                <strong>Total</strong>
              </td>
              <td className="mi-td-hm">
                <strong>{view ? totHm : ''}</strong>
              </td>
              <td className="mi-td-amt">
                <strong>{view ? money(totAmount) : ''}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="invoice-sheet-foot">
        <div className="invoice-bottom-grid">
          <div className="invoice-notes">
            <div className="invoice-notes-label">Notes:</div>
            <div className="invoice-notes-body">{MONTHLY_INVOICE_NOTES}</div>
          </div>
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
          {header.bankName || 'ICICI BANK'}
          {header.accountNo ? ` | AC No. ${header.accountNo}` : ''}
          {header.ifsc ? ` | IFSC Code: ${header.ifsc}` : ''}
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
