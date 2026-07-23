import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'
import { InvoiceChallan, type ChallanView } from '../components/InvoiceChallan'
import { useToast } from '../components/ui'
import { store, type HallmarkRequest, type InvoiceLine, type RoughSheetEntry } from '../data/store'
import { tenantGet } from '../data/tenant'

type InvoiceSettings = {
  startFrom: string
  prefix: string
  minBillCharges: boolean
}

function loadInvoiceSettings(): InvoiceSettings {
  const defaults: InvoiceSettings = {
    startFrom: '1',
    prefix: '',
    minBillCharges: false,
  }
  try {
    const raw = tenantGet('shrija-invoice-settings')
    if (!raw) return defaults
    return { ...defaults, ...(JSON.parse(raw) as Partial<InvoiceSettings>) }
  } catch {
    return defaults
  }
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
): InvoiceLine[] {
  const related = rough.filter(
    (r) =>
      r.requestNo === request.requestNo ||
      (r.partyId === request.partyId && r.date === request.date),
  )
  if (related.length > 0) {
    return related.map((r) => {
      const pcs = r.pic || 0
      const rej = r.rejectPic || 0
      const melt = 0
      const hm = Math.max(0, pcs - rej - melt)
      const amt = Number((hm * rate).toFixed(2))
      return {
        description: r.item || request.categoryName,
        purity: r.purity || request.purity,
        pcsRec: pcs,
        hm,
        rej,
        melt,
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

  const billable = data.requests.filter((r) =>
    ['Assayed', 'Hallmarked', 'In Progress', 'Pending', 'Billed'].includes(r.status),
  )
  const requestOptions = billable.length ? billable : data.requests

  const [requestQuery, setRequestQuery] = useState('')
  const [selectedNo, setSelectedNo] = useState(requestOptions[0]?.requestNo ?? '')
  const [billDate, setBillDate] = useState(() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [preview, setPreview] = useState<ChallanView | null>(null)
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
    const unusedSample = 0
    const fireboxScrap = 0
    const weightReturned = Number(
      (weightReceived - sampleWeight + unusedSample - fireboxScrap).toFixed(3),
    )
    const invoiceNo = nextInvoiceNo(settings.prefix, settings.startFrom, data.invoices.length)
    const dateOnly = billDate.slice(0, 10)

    const bill: ChallanView = {
      invoiceNo,
      date: dateOnly,
      requestNo: request.requestNo,
      requestDate: request.date,
      partyName: party?.name || request.partyName,
      partyAddress: party?.address || '',
      partyGstin: party?.gstin || '',
      partyCml: party?.licenseNo || '',
      placeOfSupply: party?.state || '',
      stateCode: party?.stateCode || '',
      sac: '998346',
      lines,
      weightReceived,
      sampleWeight,
      unusedSample,
      fireboxScrap,
      weightReturned,
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
        partyName: bill.partyName,
        requestNo: bill.requestNo,
        amount: taxable,
        tax,
        total: grandTotal,
        status: 'Unpaid',
        invoiceNo,
        date: dateOnly,
        requestDate: request.date,
        partyId: party?.id,
        partyAddress: bill.partyAddress,
        partyGstin: bill.partyGstin,
        partyCml: bill.partyCml,
        placeOfSupply: bill.placeOfSupply,
        stateCode: bill.stateCode,
        sac: '998346',
        lines,
        weightReceived,
        sampleWeight,
        unusedSample,
        fireboxScrap,
        weightReturned,
        cgst,
        sgst,
        igst,
        useIgst,
      })
      if (request.status !== 'Billed' && request.status !== 'Delivered') {
        store.updateRequestStatus(request.id, 'Billed')
      }
      setTick((t) => t + 1)
      toast(`Invoice ${invoiceNo} generated · data pushed`)
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

  return (
    <div className="billing-page">
      <nav className="gb-subnav no-print" aria-label="Billing navigation">
        <Link to="/">
          <Home size={14} /> Home
        </Link>
        <Link to="/billing" className="active">
          Billing
        </Link>
        <Link to="/reports/gst-credit">Monthly Billing</Link>
        <Link to="/generated-bills">View Bills</Link>
        <Link to="/reports/invoice-list">View Monthly Bills</Link>
      </nav>

      <h1 className="billing-title no-print">Invoice Generation</h1>

      <div className="billing-controls no-print">
        <label className="billing-field">
          <span># Request Number</span>
          <input
            placeholder="Enter request number"
            value={requestQuery}
            onChange={(e) => setRequestQuery(e.target.value)}
          />
        </label>
        <label className="billing-field">
          <span>Select from List</span>
          <select
            value={selectedNo}
            onChange={(e) => {
              setSelectedNo(e.target.value)
              setRequestQuery(e.target.value)
            }}
            aria-label="Select Request Number"
          >
            <option value="">Select Request Number</option>
            {filteredOptions.map((r) => (
              <option key={r.id} value={r.requestNo}>
                {r.requestNo} — {r.partyName}
              </option>
            ))}
          </select>
        </label>
        <label className="billing-field">
          <span>Invoice Date & Time</span>
          <input
            type="datetime-local"
            value={billDate}
            onChange={(e) => setBillDate(e.target.value)}
          />
        </label>
        <button type="button" className="btn btn-navy" onClick={() => getBill(false)}>
          Get Data
        </button>
        <button type="button" className="btn btn-green" onClick={() => getBill(true)}>
          Generate Invoice
        </button>
        <button type="button" className="btn btn-secondary" onClick={printBill}>
          Print
        </button>
      </div>

      <h2 className="billing-preview-label no-print">Invoice Preview</h2>
      <InvoiceChallan view={preview} />

      <div className="manual-actions no-print">
        <Link to="/" className="btn btn-reset">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}
