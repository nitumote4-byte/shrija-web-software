import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useToast } from '../components/ui'
import { store } from '../data/store'
import { CENTRE_NAME } from '../data/modules'
import { getFirmProfile, saveFirmProfile, type CentreOutlet } from '../data/firmProfile'
import { tenantGet, tenantSet } from '../data/tenant'

function SubPageShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="others-subpage">
      <Link to="/others" className="back-link">
        <ArrowLeft size={16} /> Back to Others
      </Link>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function flagLabel(on: boolean) {
  return on ? 'Checked' : 'Unchecked'
}

export function PartyDetails() {
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)
  const parties = useMemo(() => {
    void tick
    return store.getAll().parties
  }, [tick])
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('All')
  const [page, setPage] = useState(1)
  const pageSize = 15
  const [editing, setEditing] = useState<null | (typeof parties)[0]>(null)

  const groups = useMemo(
    () => [...new Set(parties.map((p) => p.groupName).filter(Boolean))].sort(),
    [parties],
  )

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return parties.filter((p) => {
      const matchQ =
        !s ||
        p.name.toLowerCase().includes(s) ||
        p.phone.includes(s) ||
        p.gstin.toLowerCase().includes(s) ||
        p.licenseNo.toLowerCase().includes(s)
      const matchG = group === 'All' || p.groupName === group
      return matchQ && matchG
    })
  }, [parties, q, group])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const rows = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize)

  const exportAll = () => {
    const header = [
      'Date',
      'Party Name',
      'Address',
      'Contact No',
      'GSTNO',
      'CMLNO',
      'IGST',
      'Skip Minimum Bill Charger',
      'Skip Rejected Pic Charger',
      'Skip Cutting Charger',
      'State',
      'State Code',
      'Discount',
      'Min. Bill Calc.',
      'Transaction',
      'Group',
    ]
    const lines = filtered.map((p) =>
      [
        p.createdAt,
        p.name,
        p.address,
        p.phone,
        p.gstin,
        p.licenseNo,
        flagLabel(p.igstApplicable),
        flagLabel(p.skipMinBill),
        flagLabel(p.skipRejectedPics),
        flagLabel(p.skipCutting),
        p.state,
        p.stateCode,
        (p.discount ?? 0).toFixed(2),
        flagLabel(p.minBillCalc),
        p.transactionType,
        p.groupName,
      ]
        .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `party-details-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast(`Exported ${filtered.length} partie(s)`)
  }

  const remove = (id: string, name: string) => {
    if (!window.confirm(`Delete party "${name}"?`)) return
    if (store.deleteParty(id)) {
      setTick((t) => t + 1)
      toast('Party deleted')
      if (editing?.id === id) setEditing(null)
    }
  }

  const saveEdit = (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    if (!editing.name.trim()) {
      toast('Party name is required')
      return
    }
    store.updateParty(editing.id, {
      name: editing.name.trim(),
      address: editing.address.trim(),
      phone: editing.phone.trim(),
      gstin: editing.gstin.trim().toUpperCase(),
      licenseNo: editing.licenseNo.trim(),
      state: editing.state.trim(),
      stateCode: editing.stateCode.trim(),
      groupName: editing.groupName.trim(),
      transactionType: editing.transactionType,
      igstApplicable: editing.igstApplicable,
      skipMinBill: editing.skipMinBill,
      skipRejectedPics: editing.skipRejectedPics,
      skipCutting: editing.skipCutting,
      discount: Number(editing.discount) || 0,
      minBillCalc: editing.minBillCalc,
    })
    setEditing(null)
    setTick((t) => t + 1)
    toast('Party updated')
  }

  return (
    <div className="others-subpage party-details-page">
      <Link to="/others" className="back-link">
        <ArrowLeft size={16} /> Back to Others
      </Link>
      <div className="page-header">
        <div>
          <h1>Party Details</h1>
          <p>View, edit and delete centre parties (Gold Shark style).</p>
        </div>
      </div>

      <div className="panel party-details-panel">
        <div className="party-details-toolbar">
          <div className="field">
            <label>Search by Party Name</label>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              placeholder="Search by Party Name"
            />
          </div>
          <div className="field">
            <label>Filter By Group</label>
            <select
              value={group}
              onChange={(e) => {
                setGroup(e.target.value)
                setPage(1)
              }}
            >
              <option value="All">{groups.length ? 'All groups' : 'No parties found'}</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-navy" onClick={exportAll}>
            Export All
          </button>
        </div>

        <div className="table-wrap party-details-table-wrap">
          <table className="data-table party-details-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Party Name</th>
                <th>Address</th>
                <th>Contact No</th>
                <th>GSTNO</th>
                <th>CMLNO</th>
                <th>IGST</th>
                <th>Skip Minimum Bill Charger</th>
                <th>Skip Rejected Pic Charger</th>
                <th>Skip Cutting Charger</th>
                <th>State</th>
                <th>State Code</th>
                <th>Discount</th>
                <th>Min. Bill Calc.</th>
                <th>Transaction</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.createdAt}</td>
                  <td>{p.name}</td>
                  <td>{p.address || '—'}</td>
                  <td>{p.phone || '—'}</td>
                  <td>{p.gstin || '—'}</td>
                  <td>{p.licenseNo || '—'}</td>
                  <td>{flagLabel(p.igstApplicable)}</td>
                  <td>{flagLabel(p.skipMinBill)}</td>
                  <td>{flagLabel(p.skipRejectedPics)}</td>
                  <td>{flagLabel(p.skipCutting)}</td>
                  <td>{p.state || '—'}</td>
                  <td>{p.stateCode || '—'}</td>
                  <td>{(p.discount ?? 0).toFixed(2)}</td>
                  <td>{flagLabel(p.minBillCalc)}</td>
                  <td>{p.transactionType}</td>
                  <td>
                    <div className="party-row-actions">
                      <button
                        type="button"
                        className="btn btn-navy party-action-btn"
                        onClick={() => setEditing({ ...p })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn party-action-btn party-action-delete"
                        onClick={() => remove(p.id, p.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={16} className="empty-state">
                    No parties found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="party-details-footer">
          <div className="party-details-pager">
            <button type="button" className="btn btn-ghost" disabled={pageSafe <= 1} onClick={() => setPage(1)}>
              First
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="party-page-num">{pageSafe}</span>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage(totalPages)}
            >
              Last
            </button>
          </div>
          <Link to="/others" className="btn btn-navy">
            Back
          </Link>
        </div>
      </div>

      {editing && (
        <div className="party-edit-overlay" role="dialog" aria-modal="true">
          <form className="panel party-edit-modal" onSubmit={saveEdit}>
            <h2>Edit Party</h2>
            <div className="form-grid">
              <div className="field">
                <label>Party Name</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Contact No</label>
                <input
                  value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Address</label>
                <input
                  value={editing.address}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                />
              </div>
              <div className="field">
                <label>GSTNO</label>
                <input
                  value={editing.gstin}
                  onChange={(e) => setEditing({ ...editing, gstin: e.target.value })}
                />
              </div>
              <div className="field">
                <label>CMLNO</label>
                <input
                  value={editing.licenseNo}
                  onChange={(e) => setEditing({ ...editing, licenseNo: e.target.value })}
                />
              </div>
              <div className="field">
                <label>State</label>
                <input
                  value={editing.state}
                  onChange={(e) => setEditing({ ...editing, state: e.target.value })}
                />
              </div>
              <div className="field">
                <label>State Code</label>
                <input
                  value={editing.stateCode}
                  onChange={(e) => setEditing({ ...editing, stateCode: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Discount</label>
                <input
                  type="number"
                  step="0.01"
                  value={editing.discount ?? 0}
                  onChange={(e) =>
                    setEditing({ ...editing, discount: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="field">
                <label>Transaction</label>
                <select
                  value={editing.transactionType}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      transactionType: e.target.value as typeof editing.transactionType,
                    })
                  }
                >
                  <option value="Cash">Cash</option>
                  <option value="Credit">Credit</option>
                  <option value="Bank">Bank</option>
                </select>
              </div>
              <div className="field">
                <label>Group</label>
                <input
                  value={editing.groupName}
                  onChange={(e) => setEditing({ ...editing, groupName: e.target.value })}
                />
              </div>
            </div>
            <div className="party-edit-flags">
              {(
                [
                  ['igstApplicable', 'IGST'],
                  ['skipMinBill', 'Skip Minimum Bill Charger'],
                  ['skipRejectedPics', 'Skip Rejected Pic Charger'],
                  ['skipCutting', 'Skip Cutting Charger'],
                  ['minBillCalc', 'Min. Bill Calc.'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="party-edit-flag">
                  <input
                    type="checkbox"
                    checked={Boolean(editing[key])}
                    onChange={(e) => setEditing({ ...editing, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="auto-manak-actions">
              <button type="submit" className="btn btn-navy">
                Save
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      {Toast}
    </div>
  )
}

export function CompanyProfile() {
  const { toast, Toast } = useToast()
  const UNLOCK_PASSWORD = 'admin123'

  const defaults = {
    firmName: CENTRE_NAME,
    email: 'info@shrija-hallmarking.in',
    address: 'Main Market, City',
    gstNo: '27AAAAA0000A1Z5',
    bankName: 'ICICI BANK',
    accountNo: '',
    ifsc: '',
    city: '',
    state: '',
  }

  const loadProfile = () => {
    const saved = getFirmProfile()
    return { ...defaults, ...saved, firmName: saved.firmName || defaults.firmName }
  }

  const initial = loadProfile()
  const [locked, setLocked] = useState(true)
  const [password, setPassword] = useState('')
  const [firmName, setFirmName] = useState(initial.firmName)
  const [email, setEmail] = useState(initial.email)
  const [address, setAddress] = useState(initial.address)
  const [gstNo, setGstNo] = useState(initial.gstNo)
  const [bankName, setBankName] = useState(initial.bankName)
  const [accountNo, setAccountNo] = useState(initial.accountNo)
  const [ifsc, setIfsc] = useState(initial.ifsc)
  const [city, setCity] = useState(initial.city)
  const [state, setState] = useState(initial.state)
  const [oscOutlets, setOscOutlets] = useState<CentreOutlet[]>(() =>
    (initial.centres || []).filter((c) => c.kind === 'osc'),
  )

  const checkUnlock = () => {
    if (password === UNLOCK_PASSWORD) {
      setLocked(false)
      setPassword('')
      toast('Form unlocked')
      return
    }
    toast('Incorrect password')
  }

  const addOsc = () => {
    setOscOutlets((list) => [
      ...list,
      {
        id: `osc-${Date.now()}`,
        kind: 'osc',
        name: `${firmName.trim() || CENTRE_NAME} — Off-Site Centre`,
        address: '',
        city: '',
        state: '',
      },
    ])
  }

  const updateOsc = (id: string, patch: Partial<CentreOutlet>) => {
    setOscOutlets((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const removeOsc = (id: string) => {
    setOscOutlets((list) => list.filter((c) => c.id !== id))
  }

  const save = () => {
    if (locked) {
      toast('Unlock the form first')
      return
    }
    const name = firmName.trim()
    if (!name) {
      toast('Firm name is required')
      return
    }
    for (const o of oscOutlets) {
      if (!o.name.trim()) {
        toast('Off-Site Centre name is required')
        return
      }
      if (!o.address.trim()) {
        toast('Off-Site Centre outlet address is required')
        return
      }
    }
    saveFirmProfile({
      firmName: name,
      email,
      address,
      gstNo,
      bankName,
      accountNo,
      ifsc,
      city,
      state,
      centres: [
        { id: 'main', kind: 'main', name, address, city, state },
        ...oscOutlets.map((o) => ({
          ...o,
          kind: 'osc' as const,
          name: o.name.trim(),
          address: o.address.trim(),
        })),
      ],
    })
    toast('Firm details saved')
    setLocked(true)
  }

  return (
    <div className="firm-page">
      <Link to="/others" className="back-link">
        <ArrowLeft size={16} /> Back to Others
      </Link>

      <div className="firm-card">
        <div className="firm-lock-bar">
          <span className={`firm-lock-badge ${locked ? 'locked' : 'unlocked'}`}>
            {locked ? 'Locked' : 'Unlocked'}
          </span>
          <input
            type="password"
            placeholder="Enter password to unlock"
            value={password}
            disabled={!locked}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkUnlock()}
          />
          <button type="button" className="btn btn-navy" onClick={checkUnlock} disabled={!locked}>
            Check
          </button>
        </div>

        <h1 className="firm-title">Firm Details</h1>
        <p className="field-hint" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
          One GSTIN for the firm. Off-Site Centres are outlets under the same GST — invoices show Main
          GSTIN with the outlet address.
        </p>

        <div className={`firm-form ${locked ? 'is-locked' : ''}`}>
          <div className="field">
            <label>Firm Name (Main Centre)</label>
            <input
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              disabled={locked}
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={locked}
            />
          </div>
          <div className="field">
            <label>Main Centre Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={locked}
            />
          </div>

          <div className="firm-bank-grid">
            <div className="field">
              <label>GST No (shared with outlets)</label>
              <input value={gstNo} onChange={(e) => setGstNo(e.target.value)} disabled={locked} />
            </div>
            <div className="field">
              <label>Bank Name</label>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="field">
              <label>Account No</label>
              <input
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="field">
              <label>IFSC Code</label>
              <input value={ifsc} onChange={(e) => setIfsc(e.target.value)} disabled={locked} />
            </div>
            <div className="field">
              <label>City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} disabled={locked} />
            </div>
            <div className="field">
              <label>State</label>
              <input value={state} onChange={(e) => setState(e.target.value)} disabled={locked} />
            </div>
          </div>

          <div className="firm-osc-section" style={{ marginTop: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Off-Site Centres (Outlets)</h2>
                <p className="field-hint" style={{ margin: '0.25rem 0 0' }}>
                  Same GST · separate outlet address · lab stays at Main
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={addOsc} disabled={locked}>
                Add Off-Site Centre
              </button>
            </div>

            {oscOutlets.length === 0 ? (
              <p className="field-hint">No Off-Site outlet added yet.</p>
            ) : (
              oscOutlets.map((o, idx) => (
                <div
                  key={o.id}
                  className="firm-bank-grid"
                  style={{
                    border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: 8,
                    padding: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Outlet {idx + 1} — Name</label>
                    <input
                      value={o.name}
                      onChange={(e) => updateOsc(o.id, { name: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Outlet address (on invoice)</label>
                    <input
                      value={o.address}
                      onChange={(e) => updateOsc(o.id, { address: e.target.value })}
                      disabled={locked}
                      placeholder="OSC full address"
                    />
                  </div>
                  <div className="field">
                    <label>City</label>
                    <input
                      value={o.city || ''}
                      onChange={(e) => updateOsc(o.id, { city: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                  <div className="field">
                    <label>State</label>
                    <input
                      value={o.state || ''}
                      onChange={(e) => updateOsc(o.id, { state: e.target.value })}
                      disabled={locked}
                    />
                  </div>
                  <div className="field" style={{ alignSelf: 'end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => removeOsc(o.id)}
                      disabled={locked}
                    >
                      Remove outlet
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="firm-actions">
            <button type="button" className="btn btn-firm-save" onClick={save} disabled={locked}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
      {Toast}
    </div>
  )
}

const DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const

function money2(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function loadOpening(date: string, channel: 'bank' | 'cash') {
  try {
    const raw = tenantGet(`shrija-cashflow-open-${date}-${channel}`)
    if (raw != null) return Number(raw) || 0
  } catch {
    /* ignore */
  }
  return 0
}

function saveOpening(date: string, channel: 'bank' | 'cash', value: number) {
  tenantSet(`shrija-cashflow-open-${date}-${channel}`, String(value))
}

function loadDenoms(date: string): Record<string, string> {
  try {
    const raw = tenantGet(`shrija-denom-${date}`)
    if (raw) return JSON.parse(raw) as Record<string, string>
  } catch {
    /* ignore */
  }
  return Object.fromEntries(DENOMS.map((d) => [String(d), '']))
}

export function DailyCashFlow() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [bankOpen, setBankOpen] = useState(() => loadOpening(date, 'bank'))
  const [cashOpen, setCashOpen] = useState(() => loadOpening(date, 'cash'))
  const [qty, setQty] = useState<Record<string, string>>(() => loadDenoms(date))

  useEffect(() => {
    setBankOpen(loadOpening(date, 'bank'))
    setCashOpen(loadOpening(date, 'cash'))
    setQty(loadDenoms(date))
  }, [date])

  const dayFunds = data.funds.filter((f) => f.date === date)
  const dayExpenses = data.expenses.filter((e) => e.date === date)

  const bankReceived = dayFunds.filter((f) => f.mode === 'Bank' || f.mode === 'Cheque' || f.mode === 'UPI')
  const cashReceived = dayFunds.filter((f) => f.mode === 'Cash')
  // Expenses without mode → treat as Cash (matches Gold Shark cash expense rows)
  const bankExpenses = dayExpenses.filter((e) => /bank|cheque|upi/i.test(`${e.remarks} ${e.category}`))
  const cashExpenses = dayExpenses.filter((e) => !/bank|cheque|upi/i.test(`${e.remarks} ${e.category}`))

  const bankRecvTotal = bankReceived.reduce((s, f) => s + f.amount, 0)
  const cashRecvTotal = cashReceived.reduce((s, f) => s + f.amount, 0)
  const bankExpTotal = bankExpenses.reduce((s, e) => s + e.amount, 0)
  const cashExpTotal = cashExpenses.reduce((s, e) => s + e.amount, 0)

  const bankClosing = bankOpen + bankRecvTotal - bankExpTotal
  const cashClosing = cashOpen + cashRecvTotal - cashExpTotal

  const denomRows = DENOMS.map((d) => {
    const q = Number(qty[String(d)]) || 0
    return { denom: d, qty: q, total: d * q }
  })
  const grandTotal = denomRows.reduce((s, r) => s + r.total, 0)
  const closingDiff = cashClosing - grandTotal

  const saveDenoms = () => {
    tenantSet(`shrija-denom-${date}`, JSON.stringify(qty))
    saveOpening(date, 'bank', bankOpen)
    saveOpening(date, 'cash', cashOpen)
    toast('Denomination & opening balances saved')
  }

  const ChannelBox = ({
    title,
    opening,
    onOpening,
    received,
    expenses,
    recvTotal,
    expTotal,
    closing,
  }: {
    title: string
    opening: number
    onOpening: (n: number) => void
    received: { name: string; amount: number }[]
    expenses: { name: string; amount: number }[]
    recvTotal: number
    expTotal: number
    closing: number
  }) => (
    <div className="dcf-channel">
      <h2>{title}</h2>

      <div className="dcf-block">
        <div className="dcf-block-head">
          <strong>Received</strong>
          <label className="dcf-open">
            Opening Balance
            <input
              type="number"
              value={opening}
              onChange={(e) => onOpening(Number(e.target.value) || 0)}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table className="data-table dcf-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Party Name</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {received.length === 0 ? (
                <tr>
                  <td colSpan={3} className="empty-state">
                    —
                  </td>
                </tr>
              ) : (
                received.map((r, i) => (
                  <tr key={`${r.name}-${i}`}>
                    <td>{i + 1}</td>
                    <td>{r.name}</td>
                    <td>{money2(r.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                <td>
                  <strong>{money2(recvTotal)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="dcf-block">
        <div className="dcf-block-head">
          <strong>Expense</strong>
        </div>
        <div className="table-wrap">
          <table className="data-table dcf-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Expense</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={3} className="empty-state">
                    —
                  </td>
                </tr>
              ) : (
                expenses.map((r, i) => (
                  <tr key={`${r.name}-${i}`}>
                    <td>{i + 1}</td>
                    <td>{r.name}</td>
                    <td>{money2(r.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                <td>
                  <strong>{money2(expTotal)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className={`dcf-closing ${closing < 0 ? 'neg' : ''}`}>
        Closing Amount <strong>{money2(closing)}</strong>
      </div>
    </div>
  )

  return (
    <div className="dcf-page">
      <Link to="/others" className="back-link">
        <ArrowLeft size={16} /> Back to Others
      </Link>

      <div className="dcf-top-grid">
        <ChannelBox
          title="Bank"
          opening={bankOpen}
          onOpening={setBankOpen}
          received={bankReceived.map((f) => ({
            name: f.partyName || f.source,
            amount: f.amount,
          }))}
          expenses={bankExpenses.map((e) => ({
            name: e.category,
            amount: e.amount,
          }))}
          recvTotal={bankRecvTotal}
          expTotal={bankExpTotal}
          closing={bankClosing}
        />
        <ChannelBox
          title="Cash"
          opening={cashOpen}
          onOpening={setCashOpen}
          received={cashReceived.map((f) => ({
            name: f.partyName || f.source,
            amount: f.amount,
          }))}
          expenses={cashExpenses.map((e) => ({
            name: e.category,
            amount: e.amount,
          }))}
          recvTotal={cashRecvTotal}
          expTotal={cashExpTotal}
          closing={cashClosing}
        />
      </div>

      <section className="dcf-denom-card">
        <h2 className="dcf-denom-title">Denomination Calculator</h2>

        <div className="field dcf-date-field">
          <label>Search By Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="table-wrap dcf-denom-wrap">
          <table className="data-table navy-head-table dcf-denom-table">
            <thead>
              <tr>
                <th>Notes &amp; Coins</th>
                <th>Qty</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {denomRows.map((r) => (
                <tr key={r.denom}>
                  <td>{r.denom}</td>
                  <td>
                    <input
                      className="table-input"
                      type="number"
                      min="0"
                      value={qty[String(r.denom)] ?? ''}
                      onChange={(e) =>
                        setQty((prev) => ({ ...prev, [String(r.denom)]: e.target.value }))
                      }
                    />
                  </td>
                  <td>{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="dcf-denom-footer">
          <div className="dcf-grand">
            Grand Total: <strong>{grandTotal}</strong>
          </div>
          <button type="button" className="btn btn-navy" onClick={saveDenoms}>
            Save
          </button>
        </div>

        <div className="field dcf-diff-field">
          <label>Cash Closing Total - Total Denomination</label>
          <input
            readOnly
            className={closingDiff < 0 ? 'dcf-diff-neg' : ''}
            value={closingDiff}
          />
        </div>
      </section>

      <div className="manual-actions">
        <Link to="/others" className="btn btn-navy">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}

export function RejectedRequest() {
  const rejected = store.getAll().roughSheets.filter((r) => r.status === 'Rejected')

  return (
    <SubPageShell title="Rejected Request" subtitle="View declined requests.">
      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Party</th>
                <th>Item</th>
                <th>PIC</th>
                <th>Weight</th>
                <th>Purity</th>
                <th>CML</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rejected.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    No rejected requests
                  </td>
                </tr>
              ) : (
                rejected.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td>{r.partyName}</td>
                    <td>{r.item}</td>
                    <td>{r.pic}</td>
                    <td>{r.weight.toFixed(3)}</td>
                    <td>{r.purity}</td>
                    <td>{r.cml}</td>
                    <td>{r.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SubPageShell>
  )
}

export function ExtraHallmark() {
  const { toast, Toast } = useToast()
  const data = store.getAll()
  const [partyId, setPartyId] = useState(data.parties[0]?.id ?? '')
  const [item, setItem] = useState('')
  const [pic, setPic] = useState('1')
  const [weight, setWeight] = useState('')
  const [purity, setPurity] = useState('22K916')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const party = data.parties.find((p) => p.id === partyId)
    if (!party || !item || !weight) return
    const purityCode = purity.replace(/\D/g, '') || '916'
    const category =
      data.categories.find((c) => purity.includes(c.purity)) ?? data.categories[0]
    store.addRequest({
      partyId: party.id,
      partyName: party.name,
      categoryId: category.id,
      categoryName: category.name,
      pieces: Number(pic) || 1,
      weight: Number(weight),
      purity: purityCode,
      status: 'Pending',
      source: 'Manual',
      remarks: `Extra hallmark · ${item}`,
    })
    toast('Extra hallmark request created')
    setItem('')
    setWeight('')
  }

  return (
    <SubPageShell title="Extra Hallmark Request" subtitle="Additional hallmark entries.">
      <div className="panel">
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>Party</label>
              <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                {data.parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Item</label>
              <input value={item} onChange={(e) => setItem(e.target.value)} required />
            </div>
            <div className="field">
              <label>PIC</label>
              <input value={pic} onChange={(e) => setPic(e.target.value)} />
            </div>
            <div className="field">
              <label>Weight</label>
              <input
                type="number"
                step="0.01"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Purity</label>
              <select value={purity} onChange={(e) => setPurity(e.target.value)}>
                {['22K916', '18K750', '14K585', '24K999', 'Silver925'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save Extra Request
            </button>
          </div>
        </form>
      </div>
      {Toast}
    </SubPageShell>
  )
}

export function AddToGroup() {
  const { toast, Toast } = useToast()
  const parties = store.getAll().parties
  const [partyId, setPartyId] = useState(parties[0]?.id ?? '')
  const [group, setGroup] = useState('Main Group')

  const save = () => {
    store.updatePartyGroup(partyId, group)
    const party = parties.find((p) => p.id === partyId)
    toast(`${party?.name ?? 'Party'} linked to ${group}`)
  }

  return (
    <SubPageShell title="Add to Group" subtitle="Organize parties into groups.">
      <div className="panel">
        <div className="form-grid">
          <div className="field">
            <label>Party</label>
            <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.groupName ? `(${p.groupName})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Group</label>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option>Main Group</option>
              <option>Wholesale</option>
              <option>Retail</option>
              <option>VIP</option>
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={save}>
            Assign Group
          </button>
        </div>
      </div>
      {Toast}
    </SubPageShell>
  )
}

export function TouchFundEntry() {
  const { toast, Toast } = useToast()
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    store.addFund({
      date: new Date().toISOString().slice(0, 10),
      source: 'Touch Fund',
      amount: Number(amount),
      mode: 'Cash',
      remarks: remarks || 'Touch fund entry',
    })
    toast('Touch fund recorded')
    setAmount('')
    setRemarks('')
  }

  return (
    <SubPageShell title="Touch Fund Entry" subtitle="File touch fund records.">
      <div className="panel">
        <form onSubmit={save}>
          <div className="form-grid">
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
              <label>Remarks</label>
              <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save Touch Fund
            </button>
          </div>
        </form>
      </div>
      {Toast}
    </SubPageShell>
  )
}

export { ManagePassword } from './AccessManagement'

type Staff = {
  id: string
  name: string
  role: string
  phone: string
  salary: number
  joiningDate?: string
  shift?: string
  city?: string
  address?: string
  bankName?: string
  accountNo?: string
  upiId?: string
}

function normalizeStaff(s: Staff): Staff {
  return {
    id: s.id,
    name: s.name,
    role: s.role || '',
    phone: s.phone || '',
    salary: Number(s.salary) || 0,
    joiningDate: s.joiningDate || new Date().toISOString().slice(0, 10),
    shift: s.shift || 'Day',
    city: s.city || '',
    address: s.address || '',
    bankName: s.bankName || '',
    accountNo: s.accountNo || '',
    upiId: s.upiId || '',
  }
}

function loadStaff(): Staff[] {
  try {
    const raw = tenantGet('shrija-staff')
    if (raw) {
      const list = (JSON.parse(raw) as Staff[]).map(normalizeStaff)
      tenantSet('shrija-staff', JSON.stringify(list))
      return list
    }
  } catch {
    /* ignore */
  }
  const seed: Staff[] = [
    normalizeStaff({
      id: 'st1',
      name: 'RAHUL',
      role: 'RECIPTION & DELIVERY SYSTEM',
      phone: '8000132051',
      salary: 10000,
      joiningDate: '2026-07-21',
      shift: 'Day',
      city: 'DARBHANGA',
    }),
  ]
  tenantSet('shrija-staff', JSON.stringify(seed))
  return seed
}

function saveStaffList(list: Staff[]) {
  tenantSet('shrija-staff', JSON.stringify(list.map(normalizeStaff)))
}

type DayStatus = 'full' | 'half' | 'abs' | ''

function attendanceKey(staffId: string, year: number, month: number) {
  return `shrija-att-${staffId}-${year}-${String(month + 1).padStart(2, '0')}`
}

function loadMonthAttendance(staffId: string, year: number, month: number): Record<number, DayStatus> {
  try {
    const raw = tenantGet(attendanceKey(staffId, year, month))
    if (raw) return JSON.parse(raw) as Record<number, DayStatus>
  } catch {
    /* ignore */
  }
  return {}
}

function saveMonthAttendance(
  staffId: string,
  year: number,
  month: number,
  map: Record<number, DayStatus>,
) {
  tenantSet(attendanceKey(staffId, year, month), JSON.stringify(map))
}

const emptyStaffForm = () => ({
  name: '',
  joiningDate: new Date().toISOString().slice(0, 10),
  role: '',
  shift: 'Day',
  phone: '',
  salary: '',
  city: '',
  address: '',
  bankName: '',
  accountNo: '',
  upiId: '',
})

export function AddStaff() {
  const { toast, Toast } = useToast()
  const [staff, setStaff] = useState(loadStaff)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyStaffForm)

  const setField = (key: keyof ReturnType<typeof emptyStaffForm>, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const resetForm = () => {
    setEditId(null)
    setForm(emptyStaffForm())
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast('Enter full name')
      return
    }
    const entry = normalizeStaff({
      id: editId || `st-${Date.now()}`,
      name: form.name.trim(),
      role: form.role.trim() || 'Staff',
      phone: form.phone.trim(),
      salary: Number(form.salary) || 0,
      joiningDate: form.joiningDate,
      shift: form.shift,
      city: form.city.trim(),
      address: form.address.trim(),
      bankName: form.bankName.trim(),
      accountNo: form.accountNo.trim(),
      upiId: form.upiId.trim(),
    })

    const next = editId
      ? staff.map((s) => (s.id === editId ? entry : s))
      : [entry, ...staff]
    saveStaffList(next)
    setStaff(next)
    toast(editId ? `${entry.name} updated` : `${entry.name} saved`)
    resetForm()
  }

  const startEdit = (s: Staff) => {
    setEditId(s.id)
    setForm({
      name: s.name,
      joiningDate: s.joiningDate || new Date().toISOString().slice(0, 10),
      role: s.role,
      shift: s.shift || 'Day',
      phone: s.phone,
      salary: String(s.salary || ''),
      city: s.city || '',
      address: s.address || '',
      bankName: s.bankName || '',
      accountNo: s.accountNo || '',
      upiId: s.upiId || '',
    })
  }

  const remove = (id: string) => {
    const target = staff.find((s) => s.id === id)
    if (!target) return
    if (!confirm(`Delete ${target.name}?`)) return
    const next = staff.filter((s) => s.id !== id)
    saveStaffList(next)
    setStaff(next)
    if (editId === id) resetForm()
    toast(`${target.name} deleted`)
  }

  return (
    <div className="staff-page">
      <Link to="/others" className="back-link">
        <ArrowLeft size={16} /> Back to Others
      </Link>

      <div className="staff-layout">
        <section className="staff-card">
          <div className="staff-card-head">
            <h2>{editId ? 'Edit Employee' : 'Add Employee'}</h2>
            <p>{editId ? 'Update staff details' : 'New Staff Registration'}</p>
          </div>

          <form onSubmit={save} className="staff-form">
            <div className="field">
              <label>Full Name</label>
              <input
                placeholder="John Doe"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
              />
            </div>
            <div className="staff-two">
              <div className="field">
                <label>Joining Date</label>
                <input
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => setField('joiningDate', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Designation</label>
                <input
                  placeholder="Manager"
                  value={form.role}
                  onChange={(e) => setField('role', e.target.value)}
                />
              </div>
            </div>
            <div className="staff-two">
              <div className="field">
                <label>Shift</label>
                <select value={form.shift} onChange={(e) => setField('shift', e.target.value)}>
                  <option>Day</option>
                  <option>Night</option>
                </select>
              </div>
              <div className="field">
                <label>Mobile</label>
                <input
                  placeholder="98765..."
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                />
              </div>
            </div>
            <div className="staff-two">
              <div className="field">
                <label>Salary (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.salary}
                  onChange={(e) => setField('salary', e.target.value)}
                />
              </div>
              <div className="field">
                <label>City</label>
                <input value={form.city} onChange={(e) => setField('city', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Address</label>
              <textarea
                rows={3}
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
              />
            </div>

            <h3 className="staff-bank-title">BANK DETAILS</h3>
            <div className="field">
              <label>Bank Name</label>
              <input value={form.bankName} onChange={(e) => setField('bankName', e.target.value)} />
            </div>
            <div className="staff-two">
              <div className="field">
                <label>Account No</label>
                <input
                  value={form.accountNo}
                  onChange={(e) => setField('accountNo', e.target.value)}
                />
              </div>
              <div className="field">
                <label>UPI ID</label>
                <input value={form.upiId} onChange={(e) => setField('upiId', e.target.value)} />
              </div>
            </div>

            <div className="staff-form-actions">
              {editId && (
                <button type="button" className="btn btn-reset" onClick={resetForm}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn-staff-save">
                {editId ? 'Update Employee' : '+ Save Employee'}
              </button>
            </div>
          </form>
        </section>

        <section className="staff-card staff-list-card">
          <div className="staff-card-head">
            <h2>Staff List</h2>
            <p>View and Manage Employees</p>
          </div>

          <div className="table-wrap">
            <table className="data-table navy-head-table staff-table">
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>ROLE</th>
                  <th>SHIFT</th>
                  <th>CITY</th>
                  <th>MOBILE</th>
                  <th>SALARY</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      No employees yet
                    </td>
                  </tr>
                ) : (
                  staff.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                        <div className="staff-join">{s.joiningDate || '—'}</div>
                      </td>
                      <td>{s.role}</td>
                      <td>
                        <span className="staff-shift-badge">{s.shift || 'Day'}</span>
                      </td>
                      <td>{s.city || '—'}</td>
                      <td>{s.phone || '—'}</td>
                      <td>₹{s.salary.toLocaleString('en-IN')}</td>
                      <td>
                        <div className="staff-actions">
                          <button
                            type="button"
                            className="staff-act edit"
                            title="Edit"
                            onClick={() => startEdit(s)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="staff-act del"
                            title="Delete"
                            onClick={() => remove(s.id)}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {Toast}
    </div>
  )
}

export function StaffAttendance() {
  const { toast, Toast } = useToast()
  const navigate = useNavigate()
  const [staffList, setStaffList] = useState(loadStaff)
  const [employeeId, setEmployeeId] = useState(() => loadStaff()[0]?.id || '')
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()

  const [marks, setMarks] = useState<Record<number, DayStatus>>(() =>
    loadMonthAttendance(loadStaff()[0]?.id || '', year, month),
  )
  const [increment, setIncrement] = useState('0')
  const [bonus, setBonus] = useState('0')

  const employee = staffList.find((s) => s.id === employeeId) || staffList[0]

  useEffect(() => {
    if (!employee) return
    setMarks(loadMonthAttendance(employee.id, year, month))
  }, [employee?.id, year, month])

  const stats = useMemo(() => {
    let present = 0
    let half = 0
    let absent = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const s = marks[d]
      if (s === 'full') present += 1
      else if (s === 'half') half += 1
      else if (s === 'abs') absent += 1
    }
    return { present, half, absent }
  }, [marks, daysInMonth])

  const baseSalary = employee?.salary || 0
  const daily = daysInMonth > 0 ? baseSalary / daysInMonth : 0
  const deduction = (stats.absent + stats.half * 0.5) * daily
  const net =
    baseSalary - deduction + (Number(increment) || 0) + (Number(bonus) || 0)

  const setDay = (day: number, status: DayStatus) => {
    if (!employee) return
    setMarks((prev) => {
      const next = { ...prev }
      next[day] = prev[day] === status ? '' : status
      saveMonthAttendance(employee.id, year, month, next)
      return next
    })
  }

  const exportExcel = () => {
    if (!employee) return
    const rows = [['Date', 'Status']]
    for (let d = 1; d <= daysInMonth; d++) {
      const s = marks[d] || 'Unmarked'
      rows.push([
        `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        s === 'full' ? 'Full' : s === 'half' ? 'Half' : s === 'abs' ? 'Absent' : 'Unmarked',
      ])
    }
    rows.push([])
    rows.push(['Base Salary', String(baseSalary)])
    rows.push(['Present', String(stats.present)])
    rows.push(['Half', String(stats.half)])
    rows.push(['Absent', String(stats.absent)])
    rows.push(['Deduction', String(Math.round(deduction))])
    rows.push(['Increment', increment])
    rows.push(['Bonus', bonus])
    rows.push(['Net Payable', String(Math.round(net))])
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${employee.name}-${year}-${month + 1}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('Excel exported')
  }

  const exportPdf = () => {
    if (!employee) return
    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    const monthLabel = monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    const dayRows = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const s = marks[d]
      const label =
        s === 'full' ? 'Full' : s === 'half' ? 'Half' : s === 'abs' ? 'Absent' : '—'
      return `<tr><td>${d}</td><td>${label}</td></tr>`
    }).join('')
    w.document.write(`<!doctype html><html><head><title>Attendance ${employee.name}</title>
      <style>body{font-family:Segoe UI,Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}
      td,th{border:1px solid #cbd5e1;padding:6px 8px;font-size:13px}h1{font-size:18px}</style></head><body>
      <h1>${employee.name} — ${monthLabel}</h1>
      <p>Base: ₹${baseSalary.toLocaleString('en-IN')} · P:${stats.present} H:${stats.half} A:${stats.absent}</p>
      <p><strong>Net Payable: ₹${Math.round(net).toLocaleString('en-IN')}</strong> (deduction ₹${Math.round(deduction).toLocaleString('en-IN')})</p>
      <table><thead><tr><th>Day</th><th>Status</th></tr></thead><tbody>${dayRows}</tbody></table>
      <script>window.print()</script></body></html>`)
    w.document.close()
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  if (!employee) {
    return (
      <div className="att-page">
        <p>No staff found. Add staff first.</p>
        <Link to="/others/add-staff" className="btn btn-navy">
          Add Staff
        </Link>
      </div>
    )
  }

  const monthLabel = monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <div className="att-page">
      <Link to="/others" className="back-link">
        <ArrowLeft size={16} /> Back to Others
      </Link>

      <div className="att-layout">
        <aside className="att-side">
          <div className="att-side-head">
            <h2>Attendance</h2>
            <button
              type="button"
              className="btn att-new-btn"
              onClick={() => navigate('/others/add-staff')}
            >
              + New
            </button>
          </div>

          <div className="field">
            <label>SELECT EMPLOYEE</label>
            <select
              value={employee.id}
              onChange={(e) => {
                setEmployeeId(e.target.value)
                setStaffList(loadStaff())
              }}
            >
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="att-base">
            Base Salary <strong>₹{baseSalary.toLocaleString('en-IN')}</strong>
          </div>

          <div className="att-stats">
            <div className="att-stat present">
              <span>Present (P)</span>
              <strong>{stats.present}</strong>
            </div>
            <div className="att-stat half">
              <span>Half Day (H)</span>
              <strong>{stats.half}</strong>
            </div>
            <div className="att-stat absent">
              <span>Absent (A)</span>
              <strong>{stats.absent}</strong>
            </div>
          </div>

          <ul className="att-notes">
            <li>Select a date to mark attendance.</li>
            <li>&apos;Half Day&apos; deducts 50% of daily wage.</li>
          </ul>
        </aside>

        <section className="att-main">
          <div className="att-cal-card">
            <div className="att-cal-head">
              <div className="att-cal-nav">
                <button
                  type="button"
                  onClick={() =>
                    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
                  }
                >
                  ‹
                </button>
                <strong>{monthLabel}</strong>
                <button
                  type="button"
                  onClick={() =>
                    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
                  }
                >
                  ›
                </button>
              </div>
              <span className="att-cal-emp">{employee.name}</span>
            </div>

            <div className="att-cal-dow">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="att-cal-grid">
              {cells.map((day, i) =>
                day == null ? (
                  <div key={`e-${i}`} className="att-day empty" />
                ) : (
                  <div
                    key={day}
                    className={`att-day ${marks[day] === 'full' ? 'full' : ''} ${
                      marks[day] === 'half' ? 'half' : ''
                    } ${marks[day] === 'abs' ? 'abs' : ''}`}
                  >
                    <span className="att-day-num">{day}</span>
                    <div className="att-day-btns">
                      <button
                        type="button"
                        className={marks[day] === 'full' ? 'on' : ''}
                        onClick={() => setDay(day, 'full')}
                      >
                        Full
                      </button>
                      <button
                        type="button"
                        className={marks[day] === 'half' ? 'on' : ''}
                        onClick={() => setDay(day, 'half')}
                      >
                        Half
                      </button>
                      <button
                        type="button"
                        className={marks[day] === 'abs' ? 'on' : ''}
                        onClick={() => setDay(day, 'abs')}
                      >
                        Abs
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="att-salary-card">
            <h3>💰 Salary Calculator</h3>
            <div className="att-salary-grid">
              <div className="field">
                <label>Add Increment (+)</label>
                <input
                  type="number"
                  value={increment}
                  onChange={(e) => setIncrement(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Add Bonus (+)</label>
                <input type="number" value={bonus} onChange={(e) => setBonus(e.target.value)} />
              </div>
              <div className="att-net">
                <span>Net Payable Salary</span>
                <strong>₹ {Math.round(net).toLocaleString('en-IN')}</strong>
                <small>(- ₹{Math.round(deduction).toLocaleString('en-IN')} for absences)</small>
              </div>
            </div>
            <div className="att-salary-actions">
              <button
                type="button"
                className="btn btn-navy att-pay-btn"
                onClick={() =>
                  toast(
                    `Salary paid to ${employee.name}: ₹${Math.round(net).toLocaleString('en-IN')}`,
                  )
                }
              >
                Pay Salary
              </button>
              <button type="button" className="btn btn-green" onClick={exportExcel}>
                Excel
              </button>
              <button type="button" className="btn btn-pdf" onClick={exportPdf}>
                PDF
              </button>
            </div>
          </div>
        </section>
      </div>
      {Toast}
    </div>
  )
}

const INVOICE_COLS = [
  { id: 'sno', label: 'S No.' },
  { id: 'description', label: 'Description' },
  { id: 'purity', label: 'Purity' },
  { id: 'pcsRec', label: 'Pcs Rec' },
  { id: 'hm', label: 'HM' },
  { id: 'rej', label: 'Rej' },
  { id: 'melt', label: 'Melt' },
  { id: 'ratePcs', label: 'Rate For PCS' },
  { id: 'amount', label: 'Amount in RS' },
] as const

type InvoiceColId = (typeof INVOICE_COLS)[number]['id']

type InvoiceSettingsData = {
  startFrom: string
  prefix: string
  qrDataUrl: string
  sealDataUrl: string
  columns: Record<InvoiceColId, boolean>
  minBillCharges: boolean
}

const DEFAULT_INVOICE_SETTINGS: InvoiceSettingsData = {
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

function loadInvoiceSettings(): InvoiceSettingsData {
  try {
    const raw = tenantGet('shrija-invoice-settings')
    if (!raw) return DEFAULT_INVOICE_SETTINGS
    const parsed = JSON.parse(raw) as Partial<InvoiceSettingsData>
    return {
      ...DEFAULT_INVOICE_SETTINGS,
      ...parsed,
      columns: { ...DEFAULT_INVOICE_SETTINGS.columns, ...(parsed.columns || {}) },
    }
  } catch {
    return DEFAULT_INVOICE_SETTINGS
  }
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function InvoiceSettings() {
  const { toast, Toast } = useToast()
  const initial = loadInvoiceSettings()
  const [startFrom, setStartFrom] = useState(initial.startFrom)
  const [prefix, setPrefix] = useState(initial.prefix)
  const [qrDataUrl, setQrDataUrl] = useState(initial.qrDataUrl)
  const [sealDataUrl, setSealDataUrl] = useState(initial.sealDataUrl)
  const [columns, setColumns] = useState(initial.columns)
  const [minBillCharges, setMinBillCharges] = useState(initial.minBillCharges)

  const onUpload = async (
    file: File | null | undefined,
    setter: (v: string) => void,
    label: string,
  ) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file')
      return
    }
    try {
      const dataUrl = await readImageFile(file)
      setter(dataUrl)
      toast(`${label} uploaded`)
    } catch {
      toast('Upload failed')
    }
  }

  const save = () => {
    const data: InvoiceSettingsData = {
      startFrom,
      prefix,
      qrDataUrl,
      sealDataUrl,
      columns,
      minBillCharges,
    }
    tenantSet('shrija-invoice-settings', JSON.stringify(data))
    toast('Invoice settings saved')
  }

  return (
    <div className="invset-page">
      <Link to="/others" className="back-link">
        <ArrowLeft size={16} /> Back to Others
      </Link>

      <div className="invset-card">
        <div className="invset-head">
          <span className="invset-head-icon">📄</span>
          <div>
            <h1>Invoice Settings</h1>
            <p>Configure your invoice numbering and branding details</p>
          </div>
        </div>

        <div className="invset-section">
          <h2>General Settings</h2>
          <div className="invset-general-grid">
            <div className="field">
              <label>Invoice Start From</label>
              <input
                value={startFrom}
                onChange={(e) => setStartFrom(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="field">
              <label>Invoice Prefix</label>
              <input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. VH/2024/"
              />
            </div>
          </div>

          <div className="invset-uploads">
            <div className="invset-upload">
              <label>Payment QR Code</label>
              <label className="invset-file-btn">
                Choose File
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) =>
                    onUpload(e.target.files?.[0], setQrDataUrl, 'QR code').finally(() => {
                      e.target.value = ''
                    })
                  }
                />
              </label>
              {qrDataUrl ? (
                <div className="invset-preview">
                  <img src={qrDataUrl} alt="Payment QR" />
                  <button type="button" className="link-btn" onClick={() => setQrDataUrl('')}>
                    Remove
                  </button>
                </div>
              ) : (
                <p className="invset-hint">No QR code uploaded</p>
              )}
            </div>

            <div className="invset-upload">
              <label>Authorized Signature / Seal</label>
              <label className="invset-file-btn">
                Choose File
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) =>
                    onUpload(e.target.files?.[0], setSealDataUrl, 'Signature/seal').finally(
                      () => {
                        e.target.value = ''
                      },
                    )
                  }
                />
              </label>
              {sealDataUrl ? (
                <div className="invset-preview">
                  <img src={sealDataUrl} alt="Signature seal" />
                  <button type="button" className="link-btn" onClick={() => setSealDataUrl('')}>
                    Remove
                  </button>
                </div>
              ) : (
                <p className="invset-hint">No signature/seal uploaded</p>
              )}
            </div>
          </div>
        </div>

        <div className="invset-section">
          <h2>Table Column Visibility</h2>
          <div className="invset-cols">
            {INVOICE_COLS.map((col) => (
              <label key={col.id} className="invset-check">
                <input
                  type="checkbox"
                  checked={columns[col.id]}
                  onChange={(e) =>
                    setColumns((prev) => ({ ...prev, [col.id]: e.target.checked }))
                  }
                />
                <span>{col.label}</span>
              </label>
            ))}
            <label className={`invset-check invset-check-global ${minBillCharges ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={minBillCharges}
                onChange={(e) => setMinBillCharges(e.target.checked)}
              />
              <span>Min. bill Charges per Job card (Global)</span>
            </label>
          </div>
        </div>

        <div className="invset-actions">
          <Link to="/others" className="btn btn-reset">
            Back to Menu
          </Link>
          <button type="button" className="btn btn-navy" onClick={save}>
            Save Settings
          </button>
        </div>
      </div>
      {Toast}
    </div>
  )
}
