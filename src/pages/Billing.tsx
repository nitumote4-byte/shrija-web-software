import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/ui'
import { getFirmProfile } from '../data/firmProfile'
import { store, type HallmarkRequest, type Party, type RoughSheetEntry } from '../data/store'
import { tenantGet } from '../data/tenant'

type InvoiceSettings = {
  startFrom: string
  prefix: string
  qrDataUrl: string
  sealDataUrl: string
  columns: Record<string, boolean>
  minBillCharges: boolean
}

type FirmProfile = {
  firmName: string
  email: string
  address: string
  gstNo: string
  bankName: string
  accountNo: string
  ifsc: string
  city: string
  state: string
}

type LineItem = {
  description: string
  purity: string
  pcsRec: number
  hm: number
  rej: number
  melt: number
  rate: number
  amount: number
}

type BillPreview = {
  request: HallmarkRequest
  party?: Party
  lines: LineItem[]
  invoiceNo: string
  date: string
  weightReceived: number
  sampleWeight: number
  unusedSample: number
  residueSample: number
  weightReturned: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  grandTotal: number
  useIgst: boolean
}

function loadInvoiceSettings(): InvoiceSettings {
  const defaults: InvoiceSettings = {
    startFrom: '1',
    prefix: '',
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
    minBillCharges: false,
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

function loadFirm(): FirmProfile {
  const saved = getFirmProfile()
  return {
    firmName: saved.firmName,
    email: saved.email || '',
    address: saved.address || '',
    gstNo: saved.gstNo || '',
    bankName: saved.bankName || 'ICICI BANK',
    accountNo: saved.accountNo || '',
    ifsc: saved.ifsc || '',
    city: saved.city || '',
    state: saved.state || '',
  }
}

function money(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function nextInvoiceNo(prefix: string, startFrom: string, existingCount: number) {
  const start = Number(startFrom) || 1
  const num = start + existingCount
  return `${prefix || ''}${num}`
}

function buildLines(
  request: HallmarkRequest,
  rough: RoughSheetEntry[],
  rate: number,
  minBill: boolean,
): LineItem[] {
  const related = rough.filter(
    (r) =>
      r.requestNo === request.requestNo ||
      (r.partyId === request.partyId && r.date === request.date),
  )
  if (related.length > 0) {
    return related.map((r) => {
      const pcs = r.pic || 0
      const rej = r.rejectPic || 0
      const hm = Math.max(0, pcs - rej)
      const amt = Number((hm * rate).toFixed(2))
      return {
        description: r.item || request.categoryName,
        purity: r.purity || request.purity,
        pcsRec: pcs,
        hm,
        rej,
        melt: 0,
        rate,
        amount: amt,
      }
    })
  }
  const pcs = request.pieces || 0
  let amount = Number((pcs * rate).toFixed(2))
  if (minBill && amount < rate) amount = rate
  return [
    {
      description: request.categoryName,
      purity: request.purity,
      pcsRec: pcs,
      hm: pcs,
      rej: 0,
      melt: 0,
      rate,
      amount,
    },
  ]
}

export function Billing() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const settings = loadInvoiceSettings()
  const firm = loadFirm()

  const billable = data.requests.filter((r) =>
    ['Assayed', 'Hallmarked', 'In Progress', 'Pending', 'Billed'].includes(r.status),
  )
  const requestOptions = billable.length ? billable : data.requests

  const [requestQuery, setRequestQuery] = useState('')
  const [selectedNo, setSelectedNo] = useState(requestOptions[0]?.requestNo ?? '')
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [preview, setPreview] = useState<BillPreview | null>(null)
  const [tick, setTick] = useState(0)
  void tick

  const filteredOptions = useMemo(() => {
    const q = requestQuery.trim().toLowerCase()
    if (!q) return requestOptions
    return requestOptions.filter(
      (r) =>
        r.requestNo.toLowerCase().includes(q) ||
        r.partyName.toLowerCase().includes(q),
    )
  }, [requestOptions, requestQuery])

  const getBill = (persist: boolean) => {
    const request =
      data.requests.find((r) => r.requestNo === selectedNo) ||
      data.requests.find((r) => r.requestNo.toLowerCase() === requestQuery.trim().toLowerCase())
    if (!request) {
      toast('Select or enter a valid request number')
      return
    }
    const party = data.parties.find((p) => p.id === request.partyId)
    const category = data.categories.find((c) => c.id === request.categoryId)
    const rate = category?.rate ?? 40
    const lines = buildLines(request, data.roughSheets, rate, settings.minBillCharges)
    const taxable = lines.reduce((s, l) => s + l.amount, 0)
    const useIgst = Boolean(party?.igstApplicable)
    const cgst = useIgst ? 0 : Number((taxable * 0.09).toFixed(2))
    const sgst = useIgst ? 0 : Number((taxable * 0.09).toFixed(2))
    const igst = useIgst ? Number((taxable * 0.18).toFixed(2)) : 0
    const tax = cgst + sgst + igst
    const grandTotal = Number((taxable + tax).toFixed(2))

    const related = data.roughSheets.filter(
      (r) =>
        r.requestNo === request.requestNo ||
        (r.partyId === request.partyId && r.date === request.date),
    )
    const weightReceived =
      related.reduce((s, r) => s + r.weight, 0) || request.weight
    const sampleWeight = related.reduce((s, r) => s + r.sampleWeight, 0)
    const invoiceNo = nextInvoiceNo(settings.prefix, settings.startFrom, data.invoices.length)

    const bill: BillPreview = {
      request,
      party,
      lines,
      invoiceNo,
      date: billDate,
      weightReceived,
      sampleWeight,
      unusedSample: 0,
      residueSample: 0,
      weightReturned: Number((weightReceived - sampleWeight).toFixed(3)),
      taxable,
      cgst,
      sgst,
      igst,
      grandTotal,
      useIgst,
    }
    setPreview(bill)
    setSelectedNo(request.requestNo)

    if (persist) {
      store.addInvoice({
        partyName: request.partyName,
        requestNo: request.requestNo,
        amount: taxable,
        tax,
        total: grandTotal,
        status: 'Unpaid',
        invoiceNo,
        date: billDate,
      })
      if (request.status !== 'Billed' && request.status !== 'Delivered') {
        store.updateRequestStatus(request.id, 'Billed')
      }
      setTick((t) => t + 1)
      toast(`Invoice ${invoiceNo} generated`)
    } else {
      toast('Bill loaded')
    }
  }

  const printBill = () => {
    if (!preview) {
      toast('Get or Generate a bill first')
      return
    }
    window.print()
  }

  const cols = settings.columns
  const centreGst = firm.gstNo || '—'
  const centreName = firm.firmName || 'Hallmarking Centre'

  return (
    <div className="billing-page">
      <h1 className="billing-title">Billing</h1>

      <div className="billing-controls no-print">
        <input
          placeholder="Request number"
          value={requestQuery}
          onChange={(e) => setRequestQuery(e.target.value)}
        />
        <select
          value={selectedNo}
          onChange={(e) => {
            setSelectedNo(e.target.value)
            setRequestQuery(e.target.value)
          }}
          required
          aria-label="Select Request Number"
        >
          <option value="">Select Request Number *</option>
          {filteredOptions.map((r) => (
            <option key={r.id} value={r.requestNo}>
              {r.requestNo} — {r.partyName}
            </option>
          ))}
        </select>
        <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
        <button type="button" className="btn btn-navy" onClick={() => getBill(false)}>
          Get
        </button>
        <button type="button" className="btn btn-navy" onClick={() => getBill(true)}>
          Generate
        </button>
        <button type="button" className="btn btn-navy" onClick={printBill}>
          Print
        </button>
      </div>

      <div className="invoice-sheet" id="invoice-print-area">
        <div className="invoice-sheet-top">
          <div>
            <div className="invoice-gstin">CENTRE GSTIN: {centreGst}</div>
          </div>
          <h2>INVOICE CUM DELIVERY CHALLAN</h2>
          <div className="invoice-format">FORMAT NO: F-30</div>
        </div>

        <div className="invoice-meta-grid">
          <div className="invoice-party">
            <div>
              <span>M/s:</span> {preview?.party?.name || preview?.request.partyName || ''}
            </div>
            <div>
              <span>C/o:</span> {preview?.party?.address?.split(',')[0] || ''}
            </div>
            <div>
              <span>CML:</span> {preview?.party?.licenseNo || ''}
            </div>
            <div>
              <span>CUSTOMER GSTIN:</span> {preview?.party?.gstin || ''}
            </div>
            <div>
              <span>Place of Supply:</span> {preview?.party?.state || firm.state || ''}
            </div>
            <div>
              <span>State Code:</span> {preview?.party?.stateCode || ''}
            </div>
          </div>
          <div className="invoice-doc">
            <div>
              <span>Invoice No:</span> {preview?.invoiceNo || ''}
            </div>
            <div>
              <span>Date:</span> {preview?.date || ''}
            </div>
            <div>
              <span>SAC:</span> 998246
            </div>
            <div>
              <span>Request No:</span> {preview?.request.requestNo || ''}
            </div>
            <div>
              <span>Request Date:</span> {preview?.request.date || ''}
            </div>
          </div>
        </div>

        <table className="invoice-items">
          <thead>
            <tr>
              {cols.sno !== false && <th>S No.</th>}
              {cols.description !== false && <th>Description</th>}
              {cols.purity !== false && <th>Purity</th>}
              {cols.pcsRec !== false && <th>Pcs Rec</th>}
              {cols.hm !== false && <th>HM</th>}
              {cols.rej !== false && <th>Rej</th>}
              {cols.melt !== false && <th>Melt</th>}
              {cols.ratePcs !== false && <th>Rate For PCS</th>}
              {cols.amount !== false && <th>Amount In RS</th>}
            </tr>
          </thead>
          <tbody>
            {!preview || preview.lines.length === 0 ? (
              <tr>
                <td colSpan={9} className="invoice-empty">
                  &nbsp;
                </td>
              </tr>
            ) : (
              preview.lines.map((line, i) => (
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
                    cols.pcsRec !== false,
                    cols.hm !== false,
                    cols.rej !== false,
                    cols.melt !== false,
                    cols.ratePcs !== false,
                  ].filter(Boolean).length
                }
              >
                <strong>Total</strong>
              </td>
              {cols.amount !== false && (
                <td>
                  <strong>{preview ? money(preview.taxable) : ''}</strong>
                </td>
              )}
            </tr>
          </tbody>
        </table>

        <div className="invoice-bottom-grid">
          <div className="invoice-weights">
            <div>
              <span>Weight Received:</span> {preview ? preview.weightReceived.toFixed(3) : ''}
            </div>
            <div>
              <span>Sample Weight:</span> {preview ? preview.sampleWeight.toFixed(3) : ''}
            </div>
            <div>
              <span>Unused Sample Return:</span> {preview ? preview.unusedSample.toFixed(3) : ''}
            </div>
            <div>
              <span>Wt. of Residue Sample Returned:</span>{' '}
              {preview ? preview.residueSample.toFixed(3) : ''}
            </div>
            <div>
              <span>Weight Returned:</span> {preview ? preview.weightReturned.toFixed(3) : ''}
            </div>
          </div>
          <div className="invoice-tax">
            <div>
              <span>CGST @ 9.00 %</span>
              <strong>{preview && !preview.useIgst ? money(preview.cgst) : '0.00'}</strong>
            </div>
            <div>
              <span>SGST @ 9.00 %</span>
              <strong>{preview && !preview.useIgst ? money(preview.sgst) : '0.00'}</strong>
            </div>
            <div>
              <span>IGST @ 18.00 %</span>
              <strong>{preview?.useIgst ? money(preview.igst) : '0.00'}</strong>
            </div>
            <div className="invoice-grand">
              <span>Grand Total</span>
              <strong>{preview ? money(preview.grandTotal) : ''}</strong>
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
            <div>FOR. {centreName}</div>
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

      <div className="manual-actions no-print">
        <Link to="/" className="btn btn-reset">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}
