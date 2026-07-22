import { useMemo, useState } from 'react'
import { History, PackageOpen, Plus, Printer, RefreshCw } from 'lucide-react'
import { useToast } from '../components/ui'
import { store, type Party } from '../data/store'

function money(n: number) {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function partyBalance(partyName: string) {
  const data = store.getAll()
  const billed = data.invoices
    .filter((i) => i.partyName === partyName)
    .reduce((s, i) => s + i.total, 0)
  const paid = data.funds
    .filter((f) => (f.partyName || f.source) === partyName)
    .reduce((s, f) => s + f.amount, 0)
  return billed - paid
}

function printFundReceipt(f: {
  voucherNo?: string
  date: string
  partyName?: string
  source: string
  mode: string
  amount: number
  bankName?: string
  chequeNo?: string
  remarks: string
}) {
  const w = window.open('', '_blank', 'width=720,height=900')
  if (!w) return
  w.document.write(`<!doctype html><html><head><title>Fund Voucher #${f.voucherNo || ''}</title>
    <style>
      body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#0f172a}
      h1{font-size:18px;margin:0 0 4px}
      .muted{color:#64748b;font-size:13px;margin:0 0 18px}
      table{width:100%;border-collapse:collapse}
      td{padding:8px 4px;border-bottom:1px solid #e2e8f0;font-size:14px}
      td:first-child{color:#64748b;width:38%}
      .amt{font-size:22px;font-weight:800;margin-top:18px}
    </style></head><body>
    <h1>SHRIJA ASSAYING & HALLMARKING CENTRE</h1>
    <p class="muted">Fund Receipt Voucher</p>
    <table>
      <tr><td>Voucher No</td><td><strong>#${f.voucherNo || '—'}</strong></td></tr>
      <tr><td>Date</td><td>${f.date}</td></tr>
      <tr><td>Party</td><td>${f.partyName || f.source}</td></tr>
      <tr><td>Type</td><td>${f.mode}</td></tr>
      <tr><td>Bank</td><td>${f.bankName || '—'}</td></tr>
      <tr><td>Cheque No</td><td>${f.chequeNo || '—'}</td></tr>
      <tr><td>Remarks</td><td>${f.remarks || '—'}</td></tr>
    </table>
    <div class="amt">${money(f.amount)}</div>
    <script>window.print()</script>
    </body></html>`)
  w.document.close()
}

export function FundEntry() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)
  void tick

  const [partyQuery, setPartyQuery] = useState('')
  const [partyOpen, setPartyOpen] = useState(false)
  const [party, setParty] = useState<Party | null>(null)
  const [txnType, setTxnType] = useState<'Cash' | 'UPI' | 'Bank' | 'Cheque'>('Cash')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [chequeNo, setChequeNo] = useState('')
  const [bankName, setBankName] = useState('')
  const [remarks, setRemarks] = useState('')
  const [printVoucher, setPrintVoucher] = useState('')
  const [balanceKey, setBalanceKey] = useState(0)

  const funds = data.funds
  const balance = useMemo(() => {
    void balanceKey
    if (!party) return 0
    return partyBalance(party.name)
  }, [party, balanceKey, tick])

  const partyOptions = useMemo(() => {
    const q = partyQuery.trim().toLowerCase()
    return data.parties.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.licenseNo.toLowerCase().includes(q),
    )
  }, [data.parties, partyQuery])

  const reset = () => {
    setParty(null)
    setPartyQuery('')
    setTxnType('Cash')
    setDate(new Date().toISOString().slice(0, 10))
    setAmount('')
    setChequeNo('')
    setBankName('')
    setRemarks('')
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!party) {
      toast('Search and select a party')
      return
    }
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      toast('Enter a valid amount')
      return
    }
    const entry = store.addFund({
      date,
      source: party.name,
      partyId: party.id,
      partyName: party.name,
      amount: amt,
      mode: txnType,
      remarks,
      chequeNo,
      bankName,
    })
    setTick((t) => t + 1)
    setBalanceKey((k) => k + 1)
    toast(`Transaction saved · Voucher #${entry.voucherNo}`)
    setAmount('')
    setChequeNo('')
    setBankName('')
    setRemarks('')
  }

  const printByNumber = () => {
    const no = printVoucher.trim()
    if (!no) {
      toast('Enter a voucher number')
      return
    }
    const found = funds.find((f) => String(f.voucherNo) === no || f.id.endsWith(no))
    if (!found) {
      toast(`Voucher #${no} not found`)
      return
    }
    printFundReceipt(found)
  }

  return (
    <div className="fund-page">
      <div className="fund-layout">
        <section className="fund-card">
          <div className="fund-card-head">
            <span className="fund-card-icon blue">
              <Plus size={18} />
            </span>
            <div>
              <h2>New Transaction</h2>
              <p>Record a new fund entry</p>
            </div>
          </div>

          <form onSubmit={submit} className="fund-form">
            <div className="field">
              <label>Select Party</label>
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
                        onClick={() => {
                          setParty(p)
                          setPartyQuery(p.name)
                          setPartyOpen(false)
                          setBalanceKey((k) => k + 1)
                        }}
                      >
                        <strong>{p.name}</strong>
                        <span>
                          {p.phone || '—'} · {p.transactionType}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="fund-two-col">
              <div className="field">
                <label>Transaction Type</label>
                <select
                  value={txnType}
                  onChange={(e) => setTxnType(e.target.value as typeof txnType)}
                >
                  {(['Cash', 'UPI', 'Bank', 'Cheque'] as const).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>

            <div className="field">
              <label>Jeweller Name</label>
              <input
                value={party?.name || ''}
                readOnly
                placeholder="Select a party above"
                className="table-input-disabled"
              />
            </div>

            <div className="fund-amount-row">
              <div className="field">
                <label>Total Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="fund-balance-box">
                <div className="fund-balance-top">
                  <span>CURRENT BALANCE</span>
                  <button
                    type="button"
                    className="fund-sync-btn"
                    title="Sync balance"
                    onClick={() => {
                      setBalanceKey((k) => k + 1)
                      toast(party ? 'Balance synced' : 'Select a party first')
                    }}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                <strong>{money(balance)}</strong>
              </div>
            </div>

            <div className="fund-two-col">
              <div className="field">
                <label>Cheque No</label>
                <input
                  placeholder="Enter cheque number"
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Bank Name</label>
                <input
                  placeholder="Enter bank name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>Remarks</label>
              <textarea
                rows={3}
                placeholder="Add any notes or remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            <div className="fund-form-actions">
              <button type="submit" className="btn btn-navy">
                Save Transaction
              </button>
              <button type="button" className="btn btn-reset" onClick={reset}>
                Reset
              </button>
            </div>
          </form>
        </section>

        <section className="fund-card fund-right">
          <div className="fund-card-head">
            <span className="fund-card-icon purple">
              <History size={18} />
            </span>
            <div>
              <h2>Recent Transactions</h2>
              <p>View latest fund entries</p>
            </div>
            <button
              type="button"
              className="fund-refresh"
              title="Refresh"
              onClick={() => setTick((t) => t + 1)}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="table-wrap fund-table-wrap">
            <table className="data-table navy-head-table">
              <thead>
                <tr>
                  <th># VOUCHER</th>
                  <th>TYPE</th>
                  <th>PARTY</th>
                  <th>AMOUNT</th>
                  <th>BANK</th>
                  <th>REMARKS</th>
                  <th>PRINT</th>
                </tr>
              </thead>
              <tbody>
                {funds.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state fund-empty">
                      <PackageOpen size={28} strokeWidth={1.5} />
                      <span>No transactions found</span>
                    </td>
                  </tr>
                ) : (
                  funds.slice(0, 12).map((f) => (
                    <tr key={f.id}>
                      <td>#{f.voucherNo || '—'}</td>
                      <td>{f.mode}</td>
                      <td>{f.partyName || f.source}</td>
                      <td>{money(f.amount)}</td>
                      <td>{f.bankName || '—'}</td>
                      <td>{f.remarks || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="fund-print-icon"
                          title="Print"
                          onClick={() => printFundReceipt(f)}
                        >
                          <Printer size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="fund-print-box">
            <div className="fund-card-head compact">
              <span className="fund-card-icon green">
                <Printer size={16} />
              </span>
              <div>
                <h2>Print Voucher by Number</h2>
                <p>Enter a voucher number to print its receipt directly</p>
              </div>
            </div>
            <div className="fund-print-row">
              <div className="field">
                <label># Voucher Number</label>
                <input
                  placeholder="e.g. 42"
                  value={printVoucher}
                  onChange={(e) => setPrintVoucher(e.target.value)}
                />
              </div>
              <button type="button" className="btn btn-green" onClick={printByNumber}>
                Print Receipt
              </button>
            </div>
          </div>
        </section>
      </div>
      {Toast}
    </div>
  )
}
