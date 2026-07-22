import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { store } from '../data/store'

export function ExpenseEntry() {
  const [tick, setTick] = useState(0)
  const { toast, Toast } = useToast()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState('Chemicals')
  const [amount, setAmount] = useState('')
  const [paidTo, setPaidTo] = useState('')
  const [remarks, setRemarks] = useState('')
  void tick

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    store.addExpense({
      date,
      category,
      amount: Number(amount),
      paidTo,
      remarks,
    })
    setTick((t) => t + 1)
    toast('Expense logged')
    setAmount('')
    setPaidTo('')
    setRemarks('')
  }

  const expenses = store.getAll().expenses
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <>
      <PageHeader title="Expense Entry" subtitle="Log daily operational expenses." />
      <div className="stats-row">
        <div className="stat-card">
          <span>Total Expenses</span>
          <strong>₹ {total.toLocaleString('en-IN')}</strong>
        </div>
      </div>
      <div className="panel">
        <h2>New Expense</h2>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {['Chemicals', 'Utilities', 'Maintenance', 'Stationery', 'Transport', 'Other'].map(
                  (c) => (
                    <option key={c}>{c}</option>
                  ),
                )}
              </select>
            </div>
            <div className="field">
              <label>Amount (₹)</label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Paid To</label>
              <input value={paidTo} onChange={(e) => setPaidTo(e.target.value)} required />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Remarks</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save Expense
            </button>
          </div>
        </form>
      </div>
      <div className="panel">
        <h2>Expense Register</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Paid To</th>
                <th>Amount</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td>{e.category}</td>
                  <td>{e.paidTo}</td>
                  <td>₹ {e.amount.toLocaleString('en-IN')}</td>
                  <td>{e.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {Toast}
    </>
  )
}
