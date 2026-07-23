import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Home, Search } from 'lucide-react'
import {
  MonthlyInvoicePreviewPanel,
  monthlyInvoiceToPreview,
  type MonthlyPreview,
} from '../components/MonthlyInvoiceSheet'
import { useToast } from '../components/ui'
import { store } from '../data/store'
import {
  applyInvoicePaperForPrint,
  loadInvoicePaperSize,
  printInvoiceSheet,
  saveInvoicePaperSize,
  type InvoicePaperSize,
} from '../utils/invoicePaper'

export function ViewMonthlyBills() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const [selectedKey, setSelectedKey] = useState('')
  const [preview, setPreview] = useState<MonthlyPreview | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [paperSize, setPaperSize] = useState<InvoicePaperSize>(() => loadInvoicePaperSize())
  const [tick, setTick] = useState(0)
  void tick

  const setPaper = (size: InvoicePaperSize) => {
    setPaperSize(size)
    saveInvoicePaperSize(size)
    applyInvoicePaperForPrint(size)
  }

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
    setPreview(monthlyInvoiceToPreview(inv))
    setActiveId(inv.id)
    toast(`Loaded ${inv.invoiceNo}`)
  }

  const deleteBill = () => {
    if (!preview || !activeId) {
      toast('Get a bill first')
      return
    }
    if (!window.confirm(`Delete monthly invoice ${preview.invoiceNo}?`)) return
    store.deleteMonthlyInvoice(activeId)
    setPreview(null)
    setActiveId(null)
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
                printInvoiceSheet(paperSize)
              }}
            >
              Print
            </button>
            <button
              type="button"
              className="gb-btn gb-btn-pdf"
              onClick={() => {
                if (!preview) return toast('Get first')
                toast(`Print → Save as PDF (${paperSize})`)
                setTimeout(() => printInvoiceSheet(paperSize), 200)
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

      <MonthlyInvoicePreviewPanel
        view={preview}
        paperSize={paperSize}
        onPaperChange={setPaper}
      />

      <div className="gb-back-wrap no-print">
        <Link to="/" className="gb-btn gb-btn-back">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}
