import { getFirmProfile, getInvoiceHeader } from '../data/firmProfile'
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

export function invoiceToChallan(
  inv: Invoice,
  data?: {
    requests?: {
      requestNo: string
      categoryName?: string
      purity?: string
      pieces?: number
      date?: string
      weight?: number
      partyId?: string
      categoryId?: string
    }[]
    roughSheets?: {
      requestNo?: string
      partyId?: string
      date?: string
      item?: string
      pic?: number
      rejectPic?: number
      sampleQty?: number
      purity?: string
      weight?: number
      sampleWeight?: number
      co?: string
    }[]
    categories?: { id: string; rate: number }[]
    parties?: {
      id: string
      address?: string
      gstin?: string
      licenseNo?: string
      state?: string
      stateCode?: string
      name?: string
    }[]
  },
): ChallanView {
  const taxable = inv.amount
  const useIgst = Boolean(inv.useIgst)
  const cgst = inv.cgst ?? (useIgst ? 0 : Number((taxable * 0.09).toFixed(2)))
  const sgst = inv.sgst ?? (useIgst ? 0 : Number((taxable * 0.09).toFixed(2)))
  const igst = inv.igst ?? (useIgst ? Number((taxable * 0.18).toFixed(2)) : 0)
  const firebox = inv.fireboxScrap ?? 0
  const unused = inv.unusedSample ?? 0
  let wr = inv.weightReceived ?? 0
  let sw = inv.sampleWeight ?? 0

  let lines = inv.lines?.length ? [...inv.lines] : []
  let careOf = inv.careOf || ''
  let partyAddress = inv.partyAddress || ''
  let partyGstin = inv.partyGstin || ''
  let partyCml = inv.partyCml || ''
  let placeOfSupply = inv.placeOfSupply || ''
  let stateCode = inv.stateCode || ''
  let requestDate = inv.requestDate || inv.date

  if (data && (!lines.length || !(wr > 0))) {
    const req = data.requests?.find((r) => r.requestNo === inv.requestNo)
    const related =
      data.roughSheets?.filter(
        (r) =>
          r.requestNo === inv.requestNo ||
          (req && r.partyId === req.partyId && r.date === req.date),
      ) || []
    const party =
      data.parties?.find((p) => p.id === inv.partyId) ||
      data.parties?.find((p) => p.id === req?.partyId) ||
      data.parties?.find((p) => p.name === inv.partyName)
    const cat = data.categories?.find((c) => c.id === req?.categoryId)
    const rate = cat?.rate ?? (lines[0]?.rate || 45)

    if (!lines.length) {
      if (related.length > 0) {
        lines = related.map((r) => {
          const pcs = r.pic || 0
          const rej = r.rejectPic || 0
          const melt = Number(r.sampleQty) > 0 ? Number(r.sampleQty) : 0
          const hm = Math.max(0, pcs - rej)
          return {
            description: r.item || req?.categoryName || 'Jewellery',
            purity: r.purity || req?.purity || '916',
            pcsRec: pcs,
            hm,
            rej,
            melt,
            rate,
            amount: Number((hm * rate).toFixed(2)),
          }
        })
      } else if (req) {
        const pcs = req.pieces || 0
        lines = [
          {
            description: req.categoryName || 'Jewellery',
            purity: req.purity || '916',
            pcsRec: pcs,
            hm: pcs,
            rej: 0,
            melt: 0,
            rate,
            amount: Number((pcs * rate).toFixed(2)) || taxable,
          },
        ]
      } else if (taxable > 0) {
        lines = [
          {
            description: 'Hallmarking charges',
            purity: '916',
            pcsRec: 0,
            hm: 0,
            rej: 0,
            melt: 0,
            rate: 0,
            amount: taxable,
          },
        ]
      }
    }

    if (!(wr > 0) && related.length) {
      wr = related.reduce((s, r) => s + (r.weight || 0), 0) || req?.weight || 0
      sw = related.reduce((s, r) => s + (r.sampleWeight || 0), 0)
    }
    if (!careOf) careOf = related.map((r) => r.co).find((c) => c && String(c).trim()) || ''
    if (!partyAddress && party) partyAddress = party.address || ''
    if (!partyGstin && party) partyGstin = party.gstin || ''
    if (!partyCml && party) partyCml = party.licenseNo || ''
    if (!placeOfSupply && party) placeOfSupply = party.state || ''
    if (!stateCode && party) stateCode = party.stateCode || ''
    if (req?.date) requestDate = req.date
  }

  return {
    invoiceNo: inv.invoiceNo,
    date: inv.date,
    invoiceDateTime: inv.invoiceDateTime || inv.date,
    requestNo: inv.requestNo,
    requestDate,
    partyName: inv.partyName,
    partyAddress,
    partyGstin,
    partyCml,
    placeOfSupply,
    stateCode,
    careOf,
    sac: inv.sac || '998346',
    lines,
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
  const header = getInvoiceHeader()
  const cols = settings.columns
  const centreGst = header.centreGstin
  const centreName = header.centreName
  const centreAddr =
    header.centreKind === 'osc'
      ? `${header.centreAddress}${header.firmName ? ` (Outlet of ${header.firmName})` : ''}`
      : header.centreAddress
  const dateShown = formatInvoiceDateTime(view?.invoiceDateTime || view?.date)

  const totPcs = view?.lines.reduce((s, l) => s + l.pcsRec, 0) ?? 0
  const totHm = view?.lines.reduce((s, l) => s + l.hm, 0) ?? 0
  const totRej = view?.lines.reduce((s, l) => s + l.rej, 0) ?? 0
  const totMelt = view?.lines.reduce((s, l) => s + l.melt, 0) ?? 0
  const colSpan = 9

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
          <div className="invoice-gstin">CENTRE GSTIN: {centreGst}</div>
        </div>

        <div className="invoice-title-bar">
          <h2>INVOICE CUM DELIVERY CHALLAN</h2>
        </div>

        <div className="invoice-meta-grid">
          <div className="invoice-party invoice-meta-box">
            <div>
              <span>Bill To:</span> {view?.partyName || ''}
            </div>
            <div className="invoice-addr-line">{view?.partyAddress || '\u00A0'}</div>
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
          <div className="invoice-doc invoice-meta-box">
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
      </div>

      <div className="invoice-table-grow">
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
              <tr className="invoice-data-row">
                <td colSpan={colSpan} className="invoice-empty">
                  &nbsp;
                </td>
              </tr>
            ) : (
              view.lines.map((line, i) => (
                <tr key={`${line.description}-${i}`} className="invoice-data-row">
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
            {/* One row stretches so data fills full A4/A5 paper */}
            <tr className="invoice-spacer-row" aria-hidden="true">
              {cols.sno !== false && <td>&nbsp;</td>}
              {cols.description !== false && <td>&nbsp;</td>}
              {cols.purity !== false && <td>&nbsp;</td>}
              {cols.pcsRec !== false && <td>&nbsp;</td>}
              {cols.hm !== false && <td>&nbsp;</td>}
              {cols.rej !== false && <td>&nbsp;</td>}
              {cols.melt !== false && <td>&nbsp;</td>}
              {cols.ratePcs !== false && <td>&nbsp;</td>}
              {cols.amount !== false && <td>&nbsp;</td>}
            </tr>
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
      </div>

      <div className="invoice-sheet-foot">
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
    </div>
  )
}

