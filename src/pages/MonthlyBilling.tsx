import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, FileText, Home, Printer, Search } from 'lucide-react'
import { formatInvoiceDateTime } from '../components/InvoiceChallan'
import { useToast } from '../components/ui'
import { getFirmProfile } from '../data/firmProfile'
import { store, type MonthlyInvoiceLine } from '../data/store'
import { tenantGet } from '../data/tenant'

function money(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function nextMonthlyNo(existingCount: number) {
  let prefix = 'M-'
  let start = 1
  try {
    const raw = tenantGet('shrija-invoice-settings')
    if (raw) {
      const parsed = JSON.parse(raw) as { prefix?: string; startFrom?: string }
      if (parsed.prefix) prefix = `${parsed.prefix}M-`
      start = Number(parsed.startFrom) || 1
    }
  } catch {
    /* defaults */
  }
  return `${prefix}${start + existingCount}`
}

type Preview = {
  invoiceNo: string
  invoiceDateTime: string
  partyName: string
  partyGstin: string
  partyCml: string
  placeOfSupply: string
  stateCode: string
  lines: MonthlyInvoiceLine[]
  taxable: number
  cgst: number
  sgst: number
  igst: number
  grandTotal: number
  useIgst: boolean
}

export function MonthlyBilling() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const firm = getFirmProfile()
  const [partyId, setPartyId] = useState('')
  const [selectedReqs, setSelectedReqs] = useState<string[]>([])
  const [billDate, setBillDate] = useState(() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [preview, setPreview] = useState<Preview | null>(null)
  const [tick, setTick] = useState(0)
  void tick

  const partyRequests = useMemo(() => {
    if (!partyId) return []
    return data.requests.filter((r) => r.partyId === partyId)
  }, [data.requests, partyId])

  const billedForParty = useMemo(() => {
    if (!partyId) return []
    return data.invoices.filter((i) => i.partyId === partyId || partyRequests.some((r) => r.requestNo === i.requestNo))
  }, [data.invoices, partyId, partyRequests])

  const buildPreview = (): Preview | null => {
    const party = data.parties.find((p) => p.id === partyId)
    if (!party) {
      toast('Select a party')
      return null
    }
    if (selectedReqs.length === 0) {
      toast('Select at least one request number')
      return null
    }

    const lines: MonthlyInvoiceLine[] = selectedReqs.map((reqNo) => {
      const inv = data.invoices.find((i) => i.requestNo === reqNo)
      const req = data.requests.find((r) => r.requestNo === reqNo)
      const articlesHm =
        inv?.lines?.reduce((s, l) => s + l.hm, 0) ??
        req?.pieces ??
        0
      const amount = inv?.amount ?? Number(((articlesHm) * (data.categories.find((c) => c.id === req?.categoryId)?.rate || 45)).toFixed(2))
      return {
        requestNo: reqNo,
        partyName: party.name,
        date: inv?.date || req?.date || billDate.slice(0, 10),
        articlesHm,
        amount,
      }
    })

    const taxable = Number(lines.reduce((s, l) => s + l.amount, 0).toFixed(2))
    const useIgst = Boolean(party.igstApplicable)
    const cgst = useIgst ? 0 : Number((taxable * 0.09).toFixed(2))
    const sgst = useIgst ? 0 : Number((taxable * 0.09).toFixed(2))
    const igst = useIgst ? Number((taxable * 0.18).toFixed(2)) : 0
    const invoiceNo = nextMonthlyNo(data.monthlyInvoices?.length || 0)

    return {
      invoiceNo,
      invoiceDateTime: billDate,
      partyName: party.name,
      partyGstin: party.gstin || '',
      partyCml: party.licenseNo || '',
      placeOfSupply: party.state || '',
      stateCode: party.stateCode || '',
      lines,
      taxable,
      cgst,
      sgst,
      igst,
      grandTotal: Number((taxable + cgst + sgst + igst).toFixed(2)),
      useIgst,
    }
  }

  const getData = () => {
    const p = buildPreview()
    if (!p) return
    setPreview(p)
    toast(`Loaded ${p.lines.length} request(s)`)
  }

  const generate = () => {
    const party = data.parties.find((p) => p.id === partyId)
    const p = buildPreview()
    if (!p || !party) return
    const tax = p.cgst + p.sgst + p.igst
    store.addMonthlyInvoice({
      invoiceNo: p.invoiceNo,
      partyId: party.id,
      partyName: p.partyName,
      partyGstin: p.partyGstin,
      partyCml: p.partyCml,
      placeOfSupply: p.placeOfSupply,
      stateCode: p.stateCode,
      invoiceDateTime: p.invoiceDateTime,
      period: 'Monthly Summary',
      sac: '998346',
      requestNos: selectedReqs,
      lines: p.lines,
      amount: p.taxable,
      cgst: p.cgst,
      sgst: p.sgst,
      igst: p.igst,
      tax,
      total: p.grandTotal,
      useIgst: p.useIgst,
      status: 'Unpaid',
    })
    setPreview(p)
    setTick((t) => t + 1)
    toast(`Monthly invoice ${p.invoiceNo} generated · data pushed`)
  }

  const toggleReq = (reqNo: string) => {
    setSelectedReqs((prev) =>
      prev.includes(reqNo) ? prev.filter((x) => x !== reqNo) : [...prev, reqNo],
    )
  }

  const selectAllBilled = () => {
    const nos = billedForParty.map((i) => i.requestNo)
    const fromReqs = partyRequests
      .filter((r) => ['Billed', 'Hallmarked', 'Assayed', 'Delivered'].includes(r.status))
      .map((r) => r.requestNo)
    setSelectedReqs([...new Set([...nos, ...fromReqs])])
  }

  return (
    <div className="generated-bills-page">
      <nav className="gb-subnav no-print" aria-label="Billing navigation">
        <Link to="/billing">Back to Selection</Link>
        <Link to="/">
          <Home size={14} /> Home
        </Link>
        <Link to="/monthly-bills">View Monthly Bills</Link>
      </nav>

      <h1 className="gb-page-title no-print">
        <CalendarDays size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
        Monthly Consolidated Billing
      </h1>

      <section className="gb-card no-print">
        <div className="gb-search-row">
          <label className="billing-field">
            <span>Select Party</span>
            <select
              value={partyId}
              onChange={(e) => {
                setPartyId(e.target.value)
                setSelectedReqs([])
                setPreview(null)
              }}
            >
              <option value="">Select a Party</option>
              {data.parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="billing-field billing-field-wide">
            <span>Select Request Numbers</span>
            <div className="mb-req-box">
              {partyId === '' ? (
                <em>Select a party first</em>
              ) : partyRequests.length === 0 ? (
                <em>No requests for this party</em>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={selectAllBilled}>
                    Select billed / hallmarked
                  </button>
                  <div className="mb-req-list">
                    {partyRequests.map((r) => (
                      <label key={r.id} className="mb-req-item">
                        <input
                          type="checkbox"
                          checked={selectedReqs.includes(r.requestNo)}
                          onChange={() => toggleReq(r.requestNo)}
                        />
                        {r.requestNo} · {r.status} · {r.pieces} pcs
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </label>
          <label className="billing-field">
            <span>Invoice Date</span>
            <input
              type="datetime-local"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
            />
          </label>
          <div className="gb-actions">
            <button type="button" className="gb-btn gb-btn-get" onClick={getData}>
              <Search size={14} /> Get Data
            </button>
            <button type="button" className="gb-btn gb-btn-upd" onClick={generate}>
              <FileText size={14} /> Generate Invoice
            </button>
            <button
              type="button"
              className="gb-btn gb-btn-print"
              onClick={() => {
                if (!preview) return toast('Get or Generate first')
                window.print()
              }}
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>
      </section>

      <section className="gb-card gb-preview-card">
        <header className="gb-card-head no-print">
          <FileText size={18} />
          <h2>Invoice Preview</h2>
        </header>
        <div className="invoice-sheet" id="monthly-invoice-print">
          <div className="invoice-centre-head">
            <strong>{firm.firmName || 'Hallmarking Centre'}</strong>
            {firm.address ? <div className="invoice-centre-addr">{firm.address}</div> : null}
            <div className="invoice-gstin">CENTRE GSTIN: {firm.gstNo || '—'}</div>
          </div>
          <div className="invoice-sheet-top">
            <h2>MONTHLY CONSOLIDATED INVOICE</h2>
          </div>
          <div className="invoice-meta-grid">
            <div className="invoice-party">
              <div>
                <span>Bill To:</span> {preview?.partyName || ''}
              </div>
              <div>
                <span>GSTIN:</span> {preview?.partyGstin || ''}
              </div>
              <div>
                <span>CML:</span> {preview?.partyCml || ''}
              </div>
              <div>
                <span>Place of Supply:</span>{' '}
                {preview?.placeOfSupply
                  ? `${preview.placeOfSupply}${preview.stateCode ? ` (Code: ${preview.stateCode})` : ''}`
                  : ''}
              </div>
            </div>
            <div className="invoice-doc">
              <div>
                <span>Invoice No:</span> {preview?.invoiceNo || '—'}
              </div>
              <div>
                <span>Invoice Date:</span>{' '}
                {preview ? formatInvoiceDateTime(preview.invoiceDateTime) : ''}
              </div>
              <div>
                <span>SAC:</span> 998346
              </div>
              <div>
                <span>Period:</span> Monthly Summary
              </div>
            </div>
          </div>
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
              {!preview || preview.lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="invoice-empty">
                    &nbsp;
                  </td>
                </tr>
              ) : (
                preview.lines.map((line, i) => (
                  <tr key={line.requestNo}>
                    <td>{i + 1}</td>
                    <td>{line.requestNo}</td>
                    <td>{line.partyName}</td>
                    <td>{line.date}</td>
                    <td>{line.articlesHm}</td>
                    <td>{money(line.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="invoice-bottom-grid">
            <div />
            <div className="invoice-tax">
              <div>
                <span>Total Taxable</span>
                <strong>{preview ? money(preview.taxable) : '0.00'}</strong>
              </div>
              <div>
                <span>CGST @ 9%</span>
                <strong>{preview && !preview.useIgst ? money(preview.cgst) : '0.00'}</strong>
              </div>
              <div>
                <span>SGST @ 9%</span>
                <strong>{preview && !preview.useIgst ? money(preview.sgst) : '0.00'}</strong>
              </div>
              <div>
                <span>IGST @ 18%</span>
                <strong>{preview?.useIgst ? money(preview.igst) : '0.00'}</strong>
              </div>
              <div className="invoice-grand">
                <span>Grand Total (Incl. Tax)</span>
                <strong>{preview ? money(preview.grandTotal) : '0.00'}</strong>
              </div>
            </div>
          </div>
          <div className="invoice-sign-grid">
            <div className="invoice-sign-label">CUSTOMER&apos;S SIGNATURE</div>
            <div className="invoice-auth">
              <div>FOR, {firm.firmName || 'Hallmarking Centre'}</div>
              <div className="invoice-sign-space" />
              <div className="invoice-sign-label">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </section>

      <div className="gb-back-wrap no-print">
        <Link to="/" className="gb-btn gb-btn-back">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}
