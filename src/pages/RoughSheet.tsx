import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, Plus, Trash2, X } from 'lucide-react'
import { statusBadge, useToast } from '../components/ui'
import { store } from '../data/store'

const ITEM_OPTIONS = [
  'Locket',
  'Necklace',
  'Bangles',
  'Earrings',
  'Ring',
  'Chain',
  'Pendant',
  'Bracelet',
  'Coin',
  'Other',
]

const PURITY_OPTIONS = ['22K916', '18K750', '14K585', '24K999', 'Silver925']

const SAMPLING_METHODS = ['Drill', 'Cut', 'Scrap', 'Touch'] as const

type SamplingMethod = (typeof SAMPLING_METHODS)[number] | ''

type SummaryRow = {
  key: string
  partyId: string
  partyName: string
  item: string
  pic: number
  weight: number
  purity: string
  sampleWeight: number
  sampleQty: number
  samplingMethod: string
  cml: string
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Completed'
  shift: string
  date: string
  address: string
}

type EntryForm = {
  item: string
  pic: string
  weight: string
  purity: string
  samplingMethod: SamplingMethod
  sampleQty: string
  sampleWeight: string
}

function toInputDate(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function emptyEntry(): EntryForm {
  return {
    item: '',
    pic: '',
    weight: '',
    purity: '',
    samplingMethod: '',
    sampleQty: '',
    sampleWeight: '',
  }
}

/** Auto sample qty/weight from sampling method (disabled fields). */
function sampleForMethod(method: SamplingMethod): { qty: string; weight: string } {
  switch (method) {
    case 'Drill':
      return { qty: '1', weight: '0.500' }
    case 'Cut':
      return { qty: '1', weight: '0.800' }
    case 'Scrap':
      return { qty: '1', weight: '1.000' }
    case 'Touch':
      return { qty: '1', weight: '0.250' }
    default:
      return { qty: '', weight: '' }
  }
}

export function RoughSheet() {
  const data = store.getAll()
  const { toast, Toast } = useToast()

  const [partyQuery, setPartyQuery] = useState('')
  const [partyOpen, setPartyOpen] = useState(false)
  const [partyId, setPartyId] = useState('')
  const [shift, setShift] = useState('Day')
  const [date, setDate] = useState(toInputDate())
  const [entry, setEntry] = useState<EntryForm>(emptyEntry)
  const [itemOpen, setItemOpen] = useState(false)
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([])
  const [selected, setSelected] = useState<string[]>([])

  const party = data.parties.find((p) => p.id === partyId)
  const partySelected = Boolean(partyId && party)

  const partyMatches = useMemo(() => {
    const q = partyQuery.trim().toLowerCase()
    if (!q) return data.parties
    return data.parties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.licenseNo.toLowerCase().includes(q),
    )
  }, [data.parties, partyQuery])

  const itemMatches = useMemo(() => {
    const q = entry.item.trim().toLowerCase()
    if (!q) return ITEM_OPTIONS
    return ITEM_OPTIONS.filter((i) => i.toLowerCase().includes(q))
  }, [entry.item])

  const entryTotals = {
    pic: Number(entry.pic) || 0,
    weight: Number(entry.weight) || 0,
    sampleQty: Number(entry.sampleQty) || 0,
    sampleWeight: Number(entry.sampleWeight) || 0,
  }

  const summaryTotals = summaryRows.reduce(
    (acc, r) => ({
      pic: acc.pic + r.pic,
      weight: acc.weight + r.weight,
      sampleQty: acc.sampleQty + r.sampleQty,
      sampleWeight: acc.sampleWeight + r.sampleWeight,
    }),
    { pic: 0, weight: 0, sampleQty: 0, sampleWeight: 0 },
  )

  const loadPartySummary = (id: string, shiftFilter: string) => {
    const existing = store.getRoughSheetRows({
      partyId: id,
      shift: shiftFilter || undefined,
    })
    setSummaryRows(
      existing.map((r) => ({
        key: r.id,
        partyId: r.partyId,
        partyName: r.partyName,
        item: r.item,
        pic: r.pic,
        weight: r.weight,
        purity: r.purity,
        sampleWeight: r.sampleWeight,
        sampleQty: r.sampleQty,
        samplingMethod: r.samplingMethod,
        cml: r.cml,
        status: r.status,
        shift: r.shift,
        date: r.date,
        address: r.address,
      })),
    )
    setSelected([])
  }

  const pickParty = (id: string, name: string) => {
    setPartyId(id)
    setPartyQuery(name)
    setPartyOpen(false)
    setEntry(emptyEntry())
    loadPartySummary(id, shift)
  }

  const clearParty = () => {
    setPartyId('')
    setPartyQuery('')
    setSummaryRows([])
    setSelected([])
    setEntry(emptyEntry())
  }

  const onShiftChange = (value: string) => {
    setShift(value)
    if (partyId) loadPartySummary(partyId, value)
  }

  const setEntryField = <K extends keyof EntryForm>(key: K, value: EntryForm[K]) => {
    setEntry((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'samplingMethod') {
        const auto = sampleForMethod(value as SamplingMethod)
        next.sampleQty = auto.qty
        next.sampleWeight = auto.weight
      }
      return next
    })
  }

  const saveEntryToSummary = () => {
    if (!party) {
      toast('Please select a Party Name')
      return
    }
    if (!entry.item.trim()) {
      toast('Items is required')
      return
    }
    if (!entry.pic.trim()) {
      toast('PIC is required')
      return
    }
    if (!entry.weight.trim() || Number(entry.weight) <= 0) {
      toast('Valid Weight is required')
      return
    }
    if (!entry.purity) {
      toast('Purity is required')
      return
    }
    if (!entry.samplingMethod) {
      toast('Sampling Method is required')
      return
    }

    const saved = store.addRoughSheet({
      partyId: party.id,
      partyName: party.name,
      item: entry.item.trim(),
      pic: Number(entry.pic) || 1,
      weight: Number(entry.weight),
      purity: entry.purity,
      sampleWeight: Number(entry.sampleWeight) || 0,
      sampleQty: Number(entry.sampleQty) || 1,
      samplingMethod: entry.samplingMethod,
      cml: party.licenseNo || '',
      shift,
      address: party.address || '',
      status: 'Pending',
    })

    setSummaryRows((prev) => [
      ...prev,
      {
        key: saved.id,
        partyId: saved.partyId,
        partyName: saved.partyName,
        item: saved.item,
        pic: saved.pic,
        weight: saved.weight,
        purity: saved.purity,
        sampleWeight: saved.sampleWeight,
        sampleQty: saved.sampleQty,
        samplingMethod: saved.samplingMethod,
        cml: saved.cml,
        status: 'Pending',
        shift: saved.shift,
        date: saved.date,
        address: saved.address,
      },
    ])
    setEntry(emptyEntry())
    setItemOpen(false)
    toast(`${saved.item} saved to rough sheet`)
  }

  const clearEntry = () => {
    setEntry(emptyEntry())
    setItemOpen(false)
  }

  const toggleRow = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]))
  }

  const toggleAll = () => {
    if (selected.length === summaryRows.length) setSelected([])
    else setSelected(summaryRows.map((r) => r.key))
  }

  const accept = () => {
    if (!partyId) {
      toast('Please select a Party Name')
      return
    }
    if (selected.length === 0) {
      toast('Please check at least one row')
      return
    }
    const accepted = store.acceptRoughSheets(selected)
    setSummaryRows((prev) => prev.filter((r) => !selected.includes(r.key)))
    setSelected([])
    toast(
      `${accepted.length} entr${accepted.length === 1 ? 'y' : 'ies'} accepted (sample weight added to weight)`,
    )
  }

  const reject = () => {
    if (selected.length === 0) {
      toast('Please check at least one row')
      return
    }
    const count = store.rejectRoughSheets(selected)
    setSummaryRows((prev) => prev.filter((r) => !selected.includes(r.key)))
    setSelected([])
    toast(`${count} entr${count === 1 ? 'y' : 'ies'} rejected`)
  }

  const removeRow = (key: string) => {
    store.removeRoughSheet(key)
    setSummaryRows((prev) => prev.filter((r) => r.key !== key))
    setSelected((prev) => prev.filter((x) => x !== key))
    toast('Row removed')
  }

  return (
    <div className="rough-sheet-page">
      {/* Party header */}
      <div className="panel rough-filter-panel">
        <div className="rough-party-top">
          <div className="field party-search-field">
            <label>Party Name</label>
            <div className="party-search">
              <div className="party-input-wrap">
                <input
                  type="text"
                  placeholder="Search and select Party"
                  value={partyQuery}
                  onChange={(e) => {
                    setPartyQuery(e.target.value)
                    setPartyOpen(true)
                    if (!e.target.value) clearParty()
                  }}
                  onFocus={() => setPartyOpen(true)}
                  onBlur={() => setTimeout(() => setPartyOpen(false), 150)}
                  autoComplete="off"
                />
                {partyId && (
                  <button
                    type="button"
                    className="party-clear"
                    onClick={clearParty}
                    aria-label="Clear party"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {partyOpen && (
                <div className="party-dropdown">
                  {partyMatches.length === 0 ? (
                    <div className="party-empty">No party found</div>
                  ) : (
                    partyMatches.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="party-option"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickParty(p.id, p.name)}
                      >
                        <strong>{p.name}</strong>
                        <span>{p.address || p.phone}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="field">
            <label>Select Shift</label>
            <select value={shift} onChange={(e) => onShiftChange(e.target.value)}>
              <option value="Day">Day</option>
              <option value="Night">Night</option>
            </select>
          </div>
        </div>

        <div className="rough-party-meta">
          <span>
            <strong>Address:</strong> {party?.address || ''}
          </span>
          <span>
            <strong>CML:</strong> {party?.licenseNo || ''}
          </span>
        </div>

        {partySelected && (
          <div className="rough-calc-icon" title="Totals">
            <Calculator size={18} />
          </div>
        )}
      </div>

      {/* Entry Grid — only when party selected */}
      {partySelected && (
        <div className="panel pending-table-panel rough-entry-panel">
          <div className="table-wrap">
            <table className="data-table navy-head-table manual-entry-table">
              <thead>
                <tr>
                  <th>Items</th>
                  <th>PIC</th>
                  <th>Weight</th>
                  <th>Purity</th>
                  <th>Sampling Method</th>
                  <th>Sample Qty</th>
                  <th>Sample Weight</th>
                  <th style={{ width: 56 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="party-search">
                      <input
                        className="table-input"
                        placeholder="Search and select ..."
                        value={entry.item}
                        onChange={(e) => {
                          setEntryField('item', e.target.value)
                          setItemOpen(true)
                        }}
                        onFocus={() => setItemOpen(true)}
                        onBlur={() => setTimeout(() => setItemOpen(false), 150)}
                      />
                      {itemOpen && (
                        <div className="party-dropdown">
                          {itemMatches.map((item) => (
                            <button
                              key={item}
                              type="button"
                              className="party-option"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setEntryField('item', item)
                                setItemOpen(false)
                              }}
                            >
                              <strong>{item}</strong>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      className="table-input"
                      value={entry.pic}
                      onChange={(e) => setEntryField('pic', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="table-input"
                      type="number"
                      step="0.001"
                      value={entry.weight}
                      onChange={(e) => setEntryField('weight', e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="table-input"
                      value={entry.purity}
                      onChange={(e) => setEntryField('purity', e.target.value)}
                    >
                      <option value="">Select</option>
                      {PURITY_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="table-input"
                      value={entry.samplingMethod}
                      onChange={(e) =>
                        setEntryField('samplingMethod', e.target.value as SamplingMethod)
                      }
                    >
                      <option value="">Select</option>
                      {SAMPLING_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input className="table-input table-input-disabled" value={entry.sampleQty} readOnly />
                  </td>
                  <td>
                    <input
                      className="table-input table-input-disabled"
                      value={entry.sampleWeight}
                      readOnly
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="add-line-btn"
                      onClick={clearEntry}
                      title="Clear entry"
                    >
                      <Plus size={18} />
                    </button>
                  </td>
                </tr>
                <tr className="rough-total-row">
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td>{entryTotals.pic || 0}</td>
                  <td>{entryTotals.weight.toFixed(3)}</td>
                  <td />
                  <td />
                  <td>{entryTotals.sampleQty || 0}</td>
                  <td>{entryTotals.sampleWeight.toFixed(3)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="manual-row-saves">
            <button type="button" className="btn btn-navy btn-row-save" onClick={saveEntryToSummary}>
              Save
            </button>
          </div>
        </div>
      )}

      {/* Date + Accept / Reject */}
      <div className="rough-mid-controls">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="btn btn-accept" onClick={accept}>
          Accept
        </button>
        <button type="button" className="btn btn-reject" onClick={reject}>
          Reject
        </button>
      </div>

      <div className="rough-note">
        Note: Sample Weight Automatically Add in Weight After Save Entry (Eg : Weight = 5.200 ,
        Sample Weight = 0.800 || Weight = 6.000)
      </div>

      {/* Summary Grid */}
      <div className="panel pending-table-panel rough-table-panel">
        <div className="table-wrap">
          <table className="data-table navy-head-table rough-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={summaryRows.length > 0 && selected.length === summaryRows.length}
                    onChange={toggleAll}
                    aria-label="Select all"
                    disabled={!partySelected || summaryRows.length === 0}
                  />{' '}
                  check
                </th>
                <th>Party Name</th>
                <th>Item</th>
                <th>PIC</th>
                <th>Weight</th>
                <th>Purity</th>
                <th>Sample Weight</th>
                <th>Sample Qty</th>
                <th>Sampling Method</th>
                <th>Cml</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {!partySelected ? (
                <tr>
                  <td colSpan={12} className="empty-state" />
                </tr>
              ) : summaryRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="empty-state summary-empty">
                    No rough sheet entries — add via Entry Grid above
                  </td>
                </tr>
              ) : (
                summaryRows.map((row) => (
                  <tr key={row.key} className={selected.includes(row.key) ? 'row-selected' : ''}>
                    <td className="col-check">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.key)}
                        onChange={() => toggleRow(row.key)}
                      />
                    </td>
                    <td>{row.partyName}</td>
                    <td>{row.item}</td>
                    <td>{row.pic}</td>
                    <td>{row.weight.toFixed(3)}</td>
                    <td>{row.purity}</td>
                    <td>{row.sampleWeight.toFixed(3)}</td>
                    <td>{row.sampleQty}</td>
                    <td>{row.samplingMethod}</td>
                    <td>{row.cml}</td>
                    <td>{statusBadge(row.status)}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-action danger"
                        title="Delete"
                        onClick={() => removeRow(row.key)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {partySelected && summaryRows.length > 0 && (
          <div className="rough-summary-totals">
            Total PIC: <strong>{summaryTotals.pic}</strong>
            {' · '}
            Weight: <strong>{summaryTotals.weight.toFixed(3)}</strong>
            {' · '}
            Sample Qty: <strong>{summaryTotals.sampleQty}</strong>
            {' · '}
            Sample Weight: <strong>{summaryTotals.sampleWeight.toFixed(3)}</strong>
          </div>
        )}
      </div>

      <div className="manual-actions">
        <Link to="/" className="btn btn-back">
          Back
        </Link>
      </div>

      {Toast}
    </div>
  )
}
