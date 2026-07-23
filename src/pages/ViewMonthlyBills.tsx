import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Home, Search } from 'lucide-react'
import { formatInvoiceDateTime } from '../components/InvoiceChallan'
import { useToast } from '../components/ui'
import { getFirmProfile } from '../data/firmProfile'
import { store, type MonthlyInvoice } from '../data/store'

function money(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ViewMonthlyBills() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const firm = getFirmProfile()
  const [selectedKey, setSelectedKey] = useState('')
  const [preview, setPreview] = useState<MonthlyInvoice | null>(null)
  const [tick, setTick] = useState(0)
  void tick

  const options = useMemo(
    () =>
      (data.monthlyInvoices || []).map((inv) => ({
        key: inv.id,
        label: `${inv.invoiceNo} · ${inv.partyName} · ${inv.date}`,
      })),
    [data.monthlyInvoices],
  )

  const getBill = () => {
    if (!selectedKey) {
      toast('Select a monthly invoice')
      return
    }
    const inv = store.getMonthlyInvoiceById(selectedKey)
    if (!inv) {
      toast('Not found')
      return
    }
    setPreview(inv)
    toast(`Loaded ${inv.invoiceNo}`)
  }

  const deleteBill = () => {
    if (!preview) {
      toast('Get a bill first')
      return
    }
    if (!window.confirm(`Delete monthly invoice ${preview.invoiceNo}?`)) return
    store.deleteMonthlyInvoice(preview.id)
    setPreview(null)
    setSelectedKey('')
    setTick((t) => t + 1)
    toast('Deleted · data pushed')
  }

  return (
    <div className="generated-bills-page">
      <nav className="gb-subnav no-print" aria-label="Billing navigation">
        <Link to="/">
          <Home size={14} /> Home
        </Link>
        <Link to="/billing">Billing</Link>
        <Link to="/monthly-billing">Monthly Billing</Link>
        <Link to="/generated-bills">View Bills</Link>
        <Link to="/monthly-bills" className="active">
          View Monthly Bills
        </Link>
      </nav>

      <h1 className="gb-page-title no-print">View Monthly Bills</h1>

      <section className="gb-card no-print">
        <header className="gb-card-head">
          <Search size={18} />
          <h2>Search Monthly Invoice</h2>
        </header>
        <div className="gb-search-row">
          <label className="gb-select-wrap">
            <span>Select Monthly Invoice</span>
            <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
              <option value="">Select Monthly Invoice No</option>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="gb-actions">
            <button type="button" className="gb-btn gb-btn-get" onClick={getBill}>
              Get
            </button>
            <button
              type="button"
              className="gb-btn gb-btn-print"
              onClick={() => {
                if (!preview) return toast('Get first')
                window.print()
              }}
            >
              Print
            </button>
            <button
              type="button"
              className="gb-btn gb-btn-pdf"
              onClick={() => {
                if (!preview) return toast('Get first')
                toast('Print → Save as PDF')
                setTimeout(() => window.print(), 200)
              }}
            >
              Download PDF
            </button>
            <button type="button" className="gb-btn gb-btn-del" onClick={deleteBill}>
              Delete
            </button>
          </div>
        </div>
      </section>

      <section className="gb-card gb-preview-card">
        <header className="gb-card-head no-print">
          <FileText size={18} />
          <h2>Invoice Preview</h2>
        </header>
        <div className="invoice-sheet">
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
                <span>Invoice No:</span> {preview?.invoiceNo || ''}
              </div>
              <div>
                <span>Invoice Date:</span>{' '}
                {preview ? formatInvoiceDateTime(preview.invoiceDateTime || preview.date) : ''}
              </div>
              <div>
                <span>SAC:</span> {preview?.sac || '998346'}
              </div>
              <div>
                <span>Period:</span> {preview?.period || 'Monthly Summary'}
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
            </tbody>
          </table>
          <div className="invoice-bottom-grid">
            <div />
            <div className="invoice-tax">
              <div>
                <span>Total Taxable</span>
                <strong>{preview ? money(preview.amount) : '0.00'}</strong>
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
                <strong>{preview ? money(preview.total) : '0.00'}</strong>
              </div>
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
