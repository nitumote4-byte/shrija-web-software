import { useMemo, useState } from 'react'
import { History, PackageOpen, Plus, Printer, RefreshCw, X } from 'lucide-react'
import { useToast } from '../components/ui'
import { getInvoiceHeader } from '../data/firmProfile'
import { calcPartyBalance, store, type FundEntry, type Party } from '../data/store'

function money(n: number) {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatReceiptDate(iso: string) {
  try {
    const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function partyBalance(partyName: string, excludeVoucherNo?: string) {
  const data = store.getAll()
  return calcPartyBalance(data.invoices, data.funds, partyName, excludeVoucherNo)
}

function formatBalanceLabel(balance: number) {
  if (balance < -0.009) {
    return { label: 'ADVANCE / CREDIT', value: money(Math.abs(balance)), isCredit: true }
  }
  if (Math.abs(balance) <= 0.009) {
    return { label: 'CURRENT BALANCE', value: money(0), isCredit: false }
  }
  return { label: 'CURRENT BALANCE', value: money(balance), isCredit: false }
}

type ReceiptView = {
  voucherNo?: string
  date: string
  partyName: string
  mode: string
  amount: number
  bankName?: string
  chequeNo?: string
  remarks: string
  /** Balance before this payment */
  currentBalance: number
}

function buildReceiptView(f: FundEntry): ReceiptView {
  const partyName = f.partyName || f.source
  const currentBalance = partyBalance(partyName, f.voucherNo)
  return {
    voucherNo: f.voucherNo,
    date: f.date,
    partyName,
    mode: f.mode,
    amount: f.amount,
    bankName: f.bankName,
    chequeNo: f.chequeNo,
    remarks: f.remarks,
    currentBalance,
  }
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Dedicated print window — avoids blank preview from app @media print CSS */
function openFundReceiptPrint(
  receipt: ReceiptView,
  header: { centreName: string; centreAddress: string; centreGstin: string },
) {
  const balanceDue = Math.max(0, receipt.currentBalance - receipt.amount)
  const modeCash = receipt.mode === 'Cash'
  const modeCheque = receipt.mode === 'Cheque'
  const modeBank = receipt.mode === 'Bank' || receipt.mode === 'UPI'
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) return false
  w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt Voucher #${escapeHtml(String(receipt.voucherNo || ''))}</title>
  <style>
    @page { size: A5; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: "Segoe UI", Arial, sans-serif;
      color: #0f172a;
      background: #fff;
    }
    .sheet { max-width: 148mm; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 14px; }
    .firm strong { display: block; font-size: 15px; margin-bottom: 4px; }
    .firm div { font-size: 12px; color: #475569; line-height: 1.35; }
    .meta { text-align: right; flex-shrink: 0; }
    .meta h1 { margin: 0 0 6px; font-size: 18px; letter-spacing: 0.02em; }
    .meta div { font-size: 13px; }
    .row { display: grid; grid-template-columns: 140px 1fr; gap: 8px; margin: 8px 0; font-size: 14px; }
    .row .lbl { color: #64748b; font-weight: 600; font-size: 11px; letter-spacing: 0.04em; }
    .foot { display: flex; justify-content: space-between; gap: 16px; margin-top: 16px; padding-top: 12px; border-top: 1px dashed #cbd5e1; }
    .bal { font-size: 13px; display: flex; flex-direction: column; gap: 4px; }
    .modes { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 13px; min-width: 140px; }
    .modes label { display: flex; align-items: center; gap: 6px; margin: 3px 0; }
    .sign { margin-top: 36px; text-align: center; font-size: 13px; color: #334155; }
    @media print {
      body { padding: 0; }
      .sheet { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div class="firm">
        <strong>${escapeHtml(header.centreName)}</strong>
        <div>${escapeHtml(header.centreAddress || '—')}</div>
        ${
          header.centreGstin && header.centreGstin !== '—'
            ? `<div>GSTIN: ${escapeHtml(header.centreGstin)}</div>`
            : ''
        }
      </div>
      <div class="meta">
        <h1>RECEIPT VOUCHER</h1>
        <div>Receipt No: <strong>${escapeHtml(String(receipt.voucherNo || '—'))}</strong></div>
        <div>Date: ${escapeHtml(formatReceiptDate(receipt.date))}</div>
      </div>
    </div>
    <div class="row"><span class="lbl">RECEIVED FROM:</span><strong>${escapeHtml(receipt.partyName)}</strong></div>
    <div class="row"><span class="lbl">THE AMOUNT OF:</span><strong>${money(receipt.amount)}</strong></div>
    <div class="row"><span class="lbl">FOR (INVOICE / REMARKS):</span><span>${escapeHtml(receipt.remarks || '—')}</span></div>
    <div class="row"><span class="lbl">CHEQUE NO:</span><span>${escapeHtml(receipt.chequeNo || '—')}</span></div>
    <div class="row"><span class="lbl">BANK NAME:</span><span>${escapeHtml(receipt.bankName || '—')}</span></div>
    <div class="foot">
      <div class="bal">
        <div>Current Balance: <strong>${money(receipt.currentBalance)}</strong></div>
        <div>Payment Amount: <strong>${money(receipt.amount)}</strong></div>
        <div>Balance Due: <strong>${money(balanceDue)}</strong></div>
      </div>
      <div class="modes">
        <label><input type="checkbox" ${modeCash ? 'checked' : ''} onclick="return false" /> Cash</label>
        <label><input type="checkbox" ${modeCheque ? 'checked' : ''} onclick="return false" /> Cheque</label>
        <label><input type="checkbox" ${modeBank ? 'checked' : ''} onclick="return false" /> Bank Transfer</label>
      </div>
    </div>
    <div class="sign">Received by: ____________________</div>
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    };
  </script>
</body>
</html>`)
  w.document.close()
  return true
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
  const [receipt, setReceipt] = useState<ReceiptView | null>(null)

  const header = getInvoiceHeader()
  const funds = data.funds
  const balance = useMemo(() => {
    void balanceKey
    if (!party) return 0
    return partyBalance(party.name)
  }, [party, balanceKey, tick])
  const balanceView = formatBalanceLabel(balance)

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

  const openReceipt = (f: FundEntry) => {
    setReceipt(buildReceiptView(f))
  }

  const printReceiptSheet = () => {
    if (!receipt) return
    const ok = openFundReceiptPrint(receipt, {
      centreName: header.centreName,
      centreAddress: header.centreAddress,
      centreGstin: header.centreGstin,
    })
    if (!ok) toast('Allow pop-ups to print the receipt')
  }

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
    const balanceBefore = partyBalance(party.name)
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
    // GoldShark: auto receipt popup after save
    setReceipt({
      voucherNo: entry.voucherNo,
      date: entry.date,
      partyName: party.name,
      mode: entry.mode,
      amount: entry.amount,
      bankName: entry.bankName,
      chequeNo: entry.chequeNo,
      remarks: entry.remarks,
      currentBalance: balanceBefore,
    })
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
    openReceipt(found)
  }

  const balanceDue = receipt ? Math.max(0, receipt.currentBalance - receipt.amount) : 0
  const modeCash = receipt?.mode === 'Cash'
  const modeCheque = receipt?.mode === 'Cheque'
  const modeBank = receipt?.mode === 'Bank' || receipt?.mode === 'UPI'

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
              {party?.address ? (
                <div className="fund-party-addr">Address: {party.address}</div>
              ) : null}
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
                  <span>{party ? balanceView.label : 'CURRENT BALANCE'}</span>
                  <button
                    type="button"
                    className="fund-sync-btn"
                    title="Sync balance"
                    onClick={() => {
                      if (party) store.syncInvoicePaymentStatuses(party.name)
                      setBalanceKey((k) => k + 1)
                      setTick((t) => t + 1)
                      toast(party ? 'Balance synced' : 'Select a party first')
                    }}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                <strong className={party && balanceView.isCredit ? 'fund-balance-credit' : undefined}>
                  {party ? balanceView.value : money(0)}
                </strong>
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
                          onClick={() => openReceipt(f)}
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

      {receipt && (
        <div className="fund-receipt-backdrop no-print" onClick={() => setReceipt(null)}>
          <div
            className="fund-receipt-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fund-receipt-title"
          >
            <div className="fund-receipt-toolbar no-print">
              <button type="button" className="btn btn-teal" onClick={printReceiptSheet}>
                <Printer size={16} /> Print (A5)
              </button>
              <button
                type="button"
                className="btn btn-reset fund-receipt-close"
                onClick={() => setReceipt(null)}
                aria-label="Close"
              >
                <X size={16} /> Close
              </button>
            </div>

            <div className="fund-receipt-sheet" id="fund-receipt-print">
              <div className="fund-rv-head">
                <div className="fund-rv-firm">
                  <strong>{header.centreName}</strong>
                  <div>{header.centreAddress || '—'}</div>
                  {header.centreGstin && header.centreGstin !== '—' ? (
                    <div>GSTIN: {header.centreGstin}</div>
                  ) : null}
                </div>
                <div className="fund-rv-meta">
                  <h2 id="fund-receipt-title">RECEIPT VOUCHER</h2>
                  <div>
                    Receipt No: <strong>{receipt.voucherNo || '—'}</strong>
                  </div>
                  <div>Date: {formatReceiptDate(receipt.date)}</div>
                </div>
              </div>

              <div className="fund-rv-body">
                <div className="fund-rv-row">
                  <span>RECEIVED FROM:</span>
                  <strong>{receipt.partyName}</strong>
                </div>
                <div className="fund-rv-row">
                  <span>THE AMOUNT OF:</span>
                  <strong>{money(receipt.amount)}</strong>
                </div>
                <div className="fund-rv-row">
                  <span>FOR (INVOICE / REMARKS):</span>
                  <span>{receipt.remarks || '—'}</span>
                </div>
                <div className="fund-rv-row">
                  <span>CHEQUE NO:</span>
                  <span>{receipt.chequeNo || '—'}</span>
                </div>
                <div className="fund-rv-row">
                  <span>BANK NAME:</span>
                  <span>{receipt.bankName || '—'}</span>
                </div>
              </div>

              <div className="fund-rv-foot">
                <div className="fund-rv-balances">
                  <div>
                    Current Balance: <strong>{money(receipt.currentBalance)}</strong>
                  </div>
                  <div>
                    Payment Amount: <strong>{money(receipt.amount)}</strong>
                  </div>
                  <div>
                    Balance Due: <strong>{money(balanceDue)}</strong>
                  </div>
                </div>
                <div className="fund-rv-modes">
                  <label>
                    <input type="checkbox" checked={modeCash} readOnly /> Cash
                  </label>
                  <label>
                    <input type="checkbox" checked={modeCheque} readOnly /> Cheque
                  </label>
                  <label>
                    <input type="checkbox" checked={modeBank} readOnly /> Bank Transfer
                  </label>
                </div>
              </div>

              <div className="fund-rv-sign">Received by: ____________________</div>
            </div>
          </div>
        </div>
      )}

      {Toast}
    </div>
  )
}
