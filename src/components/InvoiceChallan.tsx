import { getFirmProfile } from '../data/firmProfile'
import type { Invoice, InvoiceLine } from '../data/store'
import { tenantGet } from '../data/tenant'

export type ChallanView = {
  invoiceNo: string
  date: string
  invoiceDateTime?: string
  requestNo: string
  requestDate: string
  partyName: string
  partyAddress: string
  partyGstin: string
  partyCml: string
  placeOfSupply: string
  stateCode: string
  careOf: string
  sac: string
  lines: InvoiceLine[]
  weightReceived: number
  sampleWeight: number
  unusedSample: number
  /** Residue / firebox sample returned */
  fireboxScrap: number
  weightReturned: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  grandTotal: number
  useIgst: boolean
}

type InvoiceSettings = {
  qrDataUrl: string
  sealDataUrl: string
  columns: Record<string, boolean>
}

function loadInvoiceSettings(): InvoiceSettings {
  const defaults: InvoiceSettings = {
    qrDataUrl: '',
    sealDataUrl: '',
    columns: {
      sno: true,
      description: true,
      purity: true,
      pcsRec: true,
      hm: true,
      rej: true,
      melt: true,
      ratePcs: true,
      amount: true,
    },
  }
  try {
    const raw = tenantGet('shrija-invoice-settings')
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<InvoiceSettings>
    return {
      ...defaults,
      ...parsed,
      columns: { ...defaults.columns, ...(parsed.columns || {}) },
    }
  } catch {
    return defaults
  }
}

function money(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Display like GoldShark: 23-07-2026 16:27 */
export function formatInvoiceDateTime(raw?: string) {
  if (!raw) return ''
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const [y, m, day] = raw.slice(0, 10).split('-')
      const time = raw.length > 10 ? raw.slice(11, 16) : ''
      return `${day}-${m}-${y}${time ? ` ${time}` : ''}`
    }
    return raw
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function invoiceToChallan(inv: Invoice): ChallanView {
  const taxable = inv.amount
  const useIgst = Boolean(inv.useIgst)
  const cgst = inv.cgst ?? (useIgst ? 0 : Number((taxable * 0.09).toFixed(2)))
  const sgst = inv.sgst ?? (useIgst ? 0 : Number((taxable * 0.09).toFixed(2)))
  const igst = inv.igst ?? (useIgst ? Number((taxable * 0.18).toFixed(2)) : 0)
  const firebox = inv.fireboxScrap ?? 0
  const unused = inv.unusedSample ?? 0
  const wr = inv.weightReceived ?? 0
  const sw = inv.sampleWeight ?? 0
  return {
    invoiceNo: inv.invoiceNo,
    date: inv.date,
    invoiceDateTime: inv.invoiceDateTime || inv.date,
    requestNo: inv.requestNo,
    requestDate: inv.requestDate || inv.date,
    partyName: inv.partyName,
    partyAddress: inv.partyAddress || '',
    partyGstin: inv.partyGstin || '',
    partyCml: inv.partyCml || '',
    placeOfSupply: inv.placeOfSupply || '',
    stateCode: inv.stateCode || '',
    careOf: inv.careOf || '',
    sac: inv.sac || '998346',
    lines: inv.lines || [],
    weightReceived: wr,
    sampleWeight: sw,
    unusedSample: unused,
    fireboxScrap: firebox,
    weightReturned:
      inv.weightReturned ?? Number((wr - sw + unused - firebox).toFixed(3)),
    taxable,
    cgst,
    sgst,
    igst,
    grandTotal: inv.total,
    useIgst,
  }
}

type Props = {
  view: ChallanView | null
  printId?: string
  paperSize?: 'A4' | 'A5'
}

export function InvoiceChallan({ view, printId = 'invoice-print-area', paperSize = 'A4' }: Props) {
  const settings = loadInvoiceSettings()
  const firm = getFirmProfile()
  const cols = settings.columns
  const centreGst = firm.gstNo || '—'
  const centreName = firm.firmName || 'Hallmarking Centre'
  const centreAddr = firm.address || ''
  const dateShown = formatInvoiceDateTime(view?.invoiceDateTime || view?.date)

  const totPcs = view?.lines.reduce((s, l) => s + l.pcsRec, 0) ?? 0
  const totHm = view?.lines.reduce((s, l) => s + l.hm, 0) ?? 0
  const totRej = view?.lines.reduce((s, l) => s + l.rej, 0) ?? 0
  const totMelt = view?.lines.reduce((s, l) => s + l.melt, 0) ?? 0

  return (
    <div
      className={`invoice-sheet paper-${paperSize.toLowerCase()}`}
      id={printId}
      data-paper={paperSize}
    >
      <div className="invoice-centre-head">
        <strong>{centreName}</strong>
        {centreAddr ? <div className="invoice-centre-addr">{centreAddr}</div> : null}
        <div className="invoice-gstin">CENTRE GSTIN: {centreGst}</div>
      </div>

      <div className="invoice-sheet-top">
        <h2>INVOICE CUM DELIVERY CHALLAN</h2>
      </div>

      <div className="invoice-meta-grid">
        <div className="invoice-party">
          <div>
            <span>Bill To:</span> {view?.partyName || ''}
          </div>
          <div>{view?.partyAddress || ''}</div>
          <div>
            <span>CUSTOMER GSTIN:</span> {view?.partyGstin || ''}
          </div>
          <div>
            <span>Gold CML Number:</span> {view?.partyCml || ''}
          </div>
          <div>
            <span>Place of Supply:</span>{' '}
            {view?.placeOfSupply
              ? `${view.placeOfSupply}${view.stateCode ? ` (Code: ${view.stateCode})` : ''}`
              : ''}
          </div>
        </div>
        <div className="invoice-doc">
          <div>
            <span>Invoice No:</span> {view?.invoiceNo || ''}
          </div>
          <div>
            <span>Invoice Date:</span> {dateShown}
          </div>
          <div>
            <span>SAC:</span> {view?.sac || '998346'}
          </div>
          <div>
            <span>Request No:</span> {view?.requestNo || ''}
          </div>
          <div>
            <span>Request Date:</span>{' '}
            {view?.requestDate ? formatInvoiceDateTime(view.requestDate).slice(0, 10) : ''}
          </div>
          <div>
            <span>C/O:</span> {view?.careOf || (view ? 'N/A' : '')}
          </div>
        </div>
      </div>

      <table className="invoice-items">
        <thead>
          <tr>
            {cols.sno !== false && <th>S.No.</th>}
            {cols.description !== false && <th>Description</th>}
            {cols.purity !== false && <th>Purity</th>}
            {cols.pcsRec !== false && <th>Pcs Rec</th>}
            {cols.hm !== false && <th>HM</th>}
            {cols.rej !== false && <th>Rej</th>}
            {cols.melt !== false && <th>Melt</th>}
            {cols.ratePcs !== false && <th>Rate For PCS</th>}
            {cols.amount !== false && <th>Amount in RS</th>}
          </tr>
        </thead>
        <tbody>
          {!view || view.lines.length === 0 ? (
            <tr>
              <td colSpan={9} className="invoice-empty">
                &nbsp;
              </td>
            </tr>
          ) : (
            view.lines.map((line, i) => (
              <tr key={`${line.description}-${i}`}>
                {cols.sno !== false && <td>{i + 1}</td>}
                {cols.description !== false && <td>{line.description}</td>}
                {cols.purity !== false && <td>{line.purity}</td>}
                {cols.pcsRec !== false && <td>{line.pcsRec}</td>}
                {cols.hm !== false && <td>{line.hm}</td>}
                {cols.rej !== false && <td>{line.rej}</td>}
                {cols.melt !== false && <td>{line.melt}</td>}
                {cols.ratePcs !== false && <td>{money(line.rate)}</td>}
                {cols.amount !== false && <td>{money(line.amount)}</td>}
              </tr>
            ))
          )}
          <tr className="invoice-total-row">
            <td
              colSpan={
                [
                  cols.sno !== false,
                  cols.description !== false,
                  cols.purity !== false,
                ].filter(Boolean).length
              }
            >
              <strong>Total</strong>
            </td>
            {cols.pcsRec !== false && (
              <td>
                <strong>{view ? totPcs : ''}</strong>
              </td>
            )}
            {cols.hm !== false && (
              <td>
                <strong>{view ? totHm : ''}</strong>
              </td>
            )}
            {cols.rej !== false && (
              <td>
                <strong>{view ? totRej : ''}</strong>
              </td>
            )}
            {cols.melt !== false && (
              <td>
                <strong>{view ? totMelt : ''}</strong>
              </td>
            )}
            {cols.ratePcs !== false && <td />}
            {cols.amount !== false && (
              <td>
                <strong>{view ? money(view.taxable) : ''}</strong>
              </td>
            )}
          </tr>
        </tbody>
      </table>

      <div className="invoice-bottom-grid">
        <div className="invoice-weights">
          <div className="invoice-weight-pair">
            <span>
              Weight Received: {view ? view.weightReceived.toFixed(3) : ''}
            </span>
            <span>
              Sample Weight: {view ? view.sampleWeight.toFixed(3) : ''}
            </span>
          </div>
          <div>
            <span>Unused Sample Return:</span> {view ? view.unusedSample.toFixed(3) : ''}
          </div>
          <div>
            <span>Wt. of Residue Sample Returned:</span>{' '}
            {view ? view.fireboxScrap.toFixed(3) : ''}
          </div>
          <div>
            <span>Weight Returned:</span> {view ? view.weightReturned.toFixed(3) : ''}
          </div>
        </div>
        <div className="invoice-tax">
          <div>
            <span>CGST @ 9.00 %</span>
            <strong>{view && !view.useIgst ? money(view.cgst) : '0.00'}</strong>
          </div>
          <div>
            <span>SGST @ 9.00 %</span>
            <strong>{view && !view.useIgst ? money(view.sgst) : '0.00'}</strong>
          </div>
          <div>
            <span>IGST @ 18.00 %</span>
            <strong>{view?.useIgst ? money(view.igst) : '0.00'}</strong>
          </div>
          <div className="invoice-grand">
            <span>Grand Total</span>
            <strong>{view ? money(view.grandTotal) : ''}</strong>
          </div>
        </div>
      </div>

      <p className="invoice-received-note">
        Received the precious Metal / Jewellery in satisfactory condition
      </p>

      <div className="invoice-sign-grid">
        <div>
          <div className="invoice-sign-label">CUSTOMER&apos;S SIGNATURE</div>
          <label className="invoice-check">
            <input type="checkbox" /> By Courier
          </label>
          <label className="invoice-check">
            <input type="checkbox" /> By Hand
          </label>
        </div>
        <div className="invoice-auth">
          <div>FOR, {centreName}</div>
          {settings.sealDataUrl ? (
            <img src={settings.sealDataUrl} alt="Seal" className="invoice-seal" />
          ) : (
            <div className="invoice-sign-space" />
          )}
          <div className="invoice-sign-label">Authorized Signatory</div>
        </div>
      </div>

      <div className="invoice-bank">
        {firm.bankName || 'ICICI BANK'}
        {firm.accountNo ? ` | AC No. ${firm.accountNo}` : ''}
        {firm.ifsc ? ` | IFSC Code: ${firm.ifsc}` : ''}
      </div>
      {settings.qrDataUrl && (
        <div className="invoice-qr">
          <img src={settings.qrDataUrl} alt="Payment QR" />
        </div>
      )}
    </div>
  )
}
