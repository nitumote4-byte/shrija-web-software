import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Banknote,
  PieChart,
  Plus,
  Receipt,
  RefreshCw,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { store, type PurchaseParty } from '../data/store'

const EXPENSE_PRODUCTS = [
  'Food & Tea',
  'Chemicals',
  'Utilities',
  'Maintenance',
  'Stationery',
  'Transport',
  'Petrol / Diesel',
  'Labour',
  'Rent',
  'Other',
]

const GST_RATES = [0, 5, 12, 18, 28] as const

function localYmd(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function money(n: number) {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function expenseLabel(e: { product?: string; category: string }) {
  return e.product || e.category || 'Expense'
}

function expenseGross(e: { grossAmount?: number; amount: number; gstAmount?: number }) {
  if (e.grossAmount != null && !Number.isNaN(e.grossAmount)) return Number(e.grossAmount)
  return Number(((Number(e.amount) || 0) + (Number(e.gstAmount) || 0)).toFixed(2))
}

function expenseMode(e: { mode?: string }) {
  const m = (e.mode || 'Cash').toLowerCase()
  if (m === 'bank' || m === 'upi' || m === 'cheque') return 'Bank'
  return 'Cash'
}

function emptyPartyForm() {
  return {
    name: '',
    product: '',
    address: '',
    gstin: '',
    gstRate: 0,
    phone: '',
    igstApplicable: false,
  }
}

export function ExpenseEntry() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)
  void tick

  const [view, setView] = useState<'expense' | 'party'>('expense')
  const [date, setDate] = useState(() => localYmd())
  const [mode, setMode] = useState<'Cash' | 'Bank' | 'UPI' | 'Cheque'>('Cash')
  const [partyQuery, setPartyQuery] = useState('')
  const [partyOpen, setPartyOpen] = useState(false)
  const [party, setParty] = useState<PurchaseParty | null>(null)
  const [product, setProduct] = useState('')
  const [amount, setAmount] = useState('')
  const [gstAmount, setGstAmount] = useState('')
  const [gstRate, setGstRate] = useState(0)
  const [remarks, setRemarks] = useState('')

  const [partyForm, setPartyForm] = useState(emptyPartyForm)

  const purchaseParties = data.purchaseParties || []

  const partyOptions = useMemo(() => {
    const q = partyQuery.trim().toLowerCase()
    return purchaseParties.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.product.toLowerCase().includes(q) ||
        p.phone.includes(q),
    )
  }, [purchaseParties, partyQuery])

  const baseAmt = Number(amount) || 0
  const gstAmt = Number(gstAmount) || 0
  const gross = Number((baseAmt + gstAmt).toFixed(2))

  const todayExpenses = useMemo(
    () => data.expenses.filter((e) => e.date === date),
    [data.expenses, date, tick],
  )
  const cashToday = todayExpenses.filter((e) => expenseMode(e) === 'Cash')
  const bankToday = todayExpenses.filter((e) => expenseMode(e) === 'Bank')
  const cashTotal = cashToday.reduce((s, e) => s + expenseGross(e), 0)
  const bankTotal = bankToday.reduce((s, e) => s + expenseGross(e), 0)
  const grandTotal = cashTotal + bankTotal

  const selectParty = (p: PurchaseParty) => {
    setParty(p)
    setPartyQuery(p.name)
    setPartyOpen(false)
    setProduct(p.product || '')
    setGstRate(Number(p.gstRate) || 0)
    const amt = Number(amount) || 0
    if (amt > 0 && p.gstRate) {
      setGstAmount(((amt * p.gstRate) / 100).toFixed(2))
    } else if (!p.gstRate) {
      setGstAmount('0')
    }
  }

  const onAmountChange = (raw: string) => {
    setAmount(raw)
    const amt = Number(raw) || 0
    if (gstRate > 0) {
      setGstAmount(((amt * gstRate) / 100).toFixed(2))
    }
  }

  const resetExpense = () => {
    setMode('Cash')
    setParty(null)
    setPartyQuery('')
    setProduct('')
    setAmount('')
    setGstAmount('')
    setGstRate(0)
    setRemarks('')
    setDate(localYmd())
  }

  const submitExpense = (e: React.FormEvent) => {
    e.preventDefault()
    if (!party && !partyQuery.trim()) {
      toast('Select or enter a party name')
      return
    }
    if (!baseAmt || baseAmt <= 0) {
      toast('Enter a valid amount')
      return
    }
    const partyName = party?.name || partyQuery.trim()
    const prod = product.trim() || party?.product || 'Other'
    store.addExpense({
      date,
      category: prod,
      product: prod,
      amount: baseAmt,
      paidTo: partyName,
      partyName,
      partyId: party?.id,
      remarks,
      mode,
      gstAmount: gstAmt,
      gstRate,
      grossAmount: gross,
    })
    setTick((t) => t + 1)
    toast('Expense saved')
    setAmount('')
    setGstAmount(gstRate ? '' : '0')
    setRemarks('')
  }

  const submitParty = (e: React.FormEvent) => {
    e.preventDefault()
    if (!partyForm.name.trim()) {
      toast('Enter party name')
      return
    }
    if (!partyForm.address.trim()) {
      toast('Enter address')
      return
    }
    const saved = store.addPurchaseParty({
      name: partyForm.name.trim(),
      product: partyForm.product.trim(),
      address: partyForm.address.trim(),
      gstin: partyForm.gstin.trim(),
      gstRate: partyForm.gstRate,
      phone: partyForm.phone.trim(),
      igstApplicable: partyForm.igstApplicable,
    })
    setTick((t) => t + 1)
    toast(`Party "${saved.name}" saved`)
    setPartyForm(emptyPartyForm())
    setView('expense')
    selectParty(saved)
  }

  const productSuggestions = useMemo(() => {
    const fromParties = purchaseParties.map((p) => p.product).filter(Boolean)
    return [...new Set([...EXPENSE_PRODUCTS, ...fromParties])].sort()
  }, [purchaseParties])

  return (
    <div className="exp-page">
      <PageHeader
        title="Expense Entry"
        subtitle="Record and manage all business expenses efficiently."
      />

      {view === 'expense' ? (
        <div className="exp-layout">
          <section className="exp-card">
            <div className="exp-card-head">
              <span className="exp-card-icon red">
                <Receipt size={18} />
              </span>
              <div>
                <h2>New Expense</h2>
                <p>Record a new expense entry</p>
              </div>
              <button
                type="button"
                className="btn btn-navy exp-add-party-btn"
                onClick={() => setView('party')}
              >
                <Plus size={15} /> Add Party
              </button>
            </div>

            <form onSubmit={submitExpense} className="exp-form">
              <div className="exp-two-col">
                <div className="field">
                  <label>Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Transaction Type</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as typeof mode)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Party Name</label>
                <div className="party-search">
                  <input
                    placeholder="Search and select Party..."
                    value={party ? party.name : partyQuery}
                    onChange={(e) => {
                      setParty(null)
                      setPartyQuery(e.target.value)
                      setPartyOpen(true)
                    }}
                    onFocus={() => setPartyOpen(true)}
                    onBlur={() => setTimeout(() => setPartyOpen(false), 150)}
                  />
                  {partyOpen && partyOptions.length > 0 && (
                    <div className="party-dropdown">
                      {partyOptions.slice(0, 8).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="party-option"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectParty(p)}
                        >
                          <strong>{p.name}</strong>
                          <span>
                            {p.product || '—'}
                            {p.gstRate ? ` · GST ${p.gstRate}%` : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="field">
                <label>Product</label>
                <input
                  list="exp-products"
                  placeholder="Auto-filled from party"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                />
                <datalist id="exp-products">
                  {productSuggestions.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <div className="exp-two-col">
                <div className="field">
                  <label>Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => onAmountChange(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label>
                    GST Amount <span className="exp-gst-badge">{gstRate}%</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={gstAmount}
                    onChange={(e) => setGstAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="exp-gross-box">
                <span>GROSS AMOUNT</span>
                <strong>{gross.toFixed(2)}</strong>
              </div>

              <div className="field">
                <label>Remark</label>
                <textarea
                  rows={3}
                  placeholder="Add any notes..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <div className="exp-form-actions">
                <button type="submit" className="btn btn-navy">
                  Save Expense
                </button>
                <button type="button" className="btn btn-reset" onClick={resetExpense}>
                  Reset
                </button>
              </div>
            </form>
          </section>

          <section className="exp-card">
            <div className="exp-card-head">
              <span className="exp-card-icon orange">
                <PieChart size={18} />
              </span>
              <div>
                <h2>Today&apos;s Summary</h2>
                <p>Quick overview of expenses · {date}</p>
              </div>
              <button
                type="button"
                className="exp-refresh"
                title="Refresh"
                onClick={() => setTick((t) => t + 1)}
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="exp-summary-stack">
              <div className="exp-summary-tile cash">
                <span>Cash Expenses</span>
                <strong>{money(cashTotal)}</strong>
              </div>
              <div className="exp-summary-tile bank">
                <span>Bank Expenses</span>
                <strong>{money(bankTotal)}</strong>
              </div>
              <div className="exp-summary-tile grand">
                <span>Grand Total</span>
                <strong>{money(grandTotal)}</strong>
              </div>
            </div>
          </section>

          <section className="exp-card exp-list-card">
            <div className="exp-list-head cash">
              <Wallet size={16} /> Cash Expenses
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SR.</th>
                    <th>EXPENSE</th>
                    <th>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {cashToday.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty-state exp-empty">
                        <Banknote size={22} strokeWidth={1.5} />
                        <span>No cash expenses today</span>
                      </td>
                    </tr>
                  ) : (
                    cashToday.map((e, i) => (
                      <tr key={e.id}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{expenseLabel(e)}</strong>
                          <div className="exp-row-sub">{e.partyName || e.paidTo}</div>
                        </td>
                        <td>{money(expenseGross(e))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="exp-list-foot">
              <span>Total Cash Expense</span>
              <strong>{money(cashTotal)}</strong>
            </div>
          </section>

          <section className="exp-card exp-list-card">
            <div className="exp-list-head bank">
              <Wallet size={16} /> Bank Expenses
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SR.</th>
                    <th>EXPENSE</th>
                    <th>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {bankToday.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty-state exp-empty">
                        <Banknote size={22} strokeWidth={1.5} />
                        <span>No bank expenses today</span>
                      </td>
                    </tr>
                  ) : (
                    bankToday.map((e, i) => (
                      <tr key={e.id}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{expenseLabel(e)}</strong>
                          <div className="exp-row-sub">
                            {e.partyName || e.paidTo} · {e.mode || 'Bank'}
                          </div>
                        </td>
                        <td>{money(expenseGross(e))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="exp-list-foot">
              <span>Total Bank Expense</span>
              <strong>{money(bankTotal)}</strong>
            </div>
          </section>
        </div>
      ) : (
        <div className="exp-layout exp-party-layout">
          <section className="exp-card">
            <div className="exp-card-head">
              <span className="exp-card-icon blue">
                <UserPlus size={18} />
              </span>
              <div>
                <h2>Add Purchase Party</h2>
                <p>Register a new vendor / supplier</p>
              </div>
            </div>
            <form onSubmit={submitParty} className="exp-form">
              <div className="field">
                <label>
                  Party Name <span className="req">*</span>
                </label>
                <input
                  placeholder="Enter Party Name"
                  value={partyForm.name}
                  onChange={(e) => setPartyForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Expense Product</label>
                <input
                  list="exp-products-party"
                  placeholder="Search expense product..."
                  value={partyForm.product}
                  onChange={(e) => setPartyForm((f) => ({ ...f, product: e.target.value }))}
                />
                <datalist id="exp-products-party">
                  {EXPENSE_PRODUCTS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div className="field">
                <label>
                  Address <span className="req">*</span>
                </label>
                <input
                  placeholder="Enter Address"
                  value={partyForm.address}
                  onChange={(e) => setPartyForm((f) => ({ ...f, address: e.target.value }))}
                  required
                />
              </div>
              <div className="exp-two-col">
                <div className="field">
                  <label>GST Number</label>
                  <input
                    placeholder="GSTIN"
                    value={partyForm.gstin}
                    onChange={(e) => setPartyForm((f) => ({ ...f, gstin: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>% GST Rate</label>
                  <select
                    value={partyForm.gstRate}
                    onChange={(e) =>
                      setPartyForm((f) => ({ ...f, gstRate: Number(e.target.value) || 0 }))
                    }
                  >
                    {GST_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r === 0 ? 'No GST' : `${r}%`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Contact No</label>
                <input
                  placeholder="Phone"
                  value={partyForm.phone}
                  onChange={(e) => setPartyForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <label className="exp-igst-flag">
                <input
                  type="checkbox"
                  checked={partyForm.igstApplicable}
                  onChange={(e) =>
                    setPartyForm((f) => ({ ...f, igstApplicable: e.target.checked }))
                  }
                />
                IGST Applicable (Auto-detected from GST)
              </label>
              <div className="exp-form-actions">
                <button type="submit" className="btn btn-navy">
                  Save Party
                </button>
                <button
                  type="button"
                  className="btn btn-reset"
                  onClick={() => {
                    setPartyForm(emptyPartyForm())
                    setView('expense')
                  }}
                >
                  <ArrowLeft size={15} /> Back to Expense
                </button>
              </div>
            </form>
          </section>

          <section className="exp-card">
            <div className="exp-card-head">
              <span className="exp-card-icon orange">
                <PieChart size={18} />
              </span>
              <div>
                <h2>Today&apos;s Summary</h2>
                <p>Quick overview of expenses</p>
              </div>
            </div>
            <div className="exp-summary-stack">
              <div className="exp-summary-tile cash">
                <span>Cash Expenses</span>
                <strong>{money(cashTotal)}</strong>
              </div>
              <div className="exp-summary-tile bank">
                <span>Bank Expenses</span>
                <strong>{money(bankTotal)}</strong>
              </div>
              <div className="exp-summary-tile grand">
                <span>Grand Total</span>
                <strong>{money(grandTotal)}</strong>
              </div>
            </div>
          </section>
        </div>
      )}

      {Toast}
    </div>
  )
}
