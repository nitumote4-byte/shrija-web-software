import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import { useToast } from '../components/ui'
import { store } from '../data/store'
import { readVoucherFile } from '../utils/voucherReader'

const PURITY_OPTIONS = ['22K916', '18K750', '14K585', '24K999', 'Silver925']

const FALLBACK_ITEMS = [
  'jhumka',
  'TOPS',
  'Locket',
  'Necklace',
  'Bangles',
  'Earrings',
  'Ring',
  'Chain',
  'Pendant',
  'Bracelet',
  'Coin',
  'Mangalsutra',
  'Other',
]

type ItemEntry = {
  key: string
  item: string
  pic: string
  weight: string
  purity: string
  requestNo: string
  receiptNo: string
  jobCardNo: string
  selected: boolean
}

function toInputDate(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function defaultNos() {
  const stamp = Date.now().toString().slice(-9)
  return {
    requestNo: stamp,
    receiptNo: String(Math.max(10000000, Number(stamp.slice(0, 8)) - 90000000)),
  }
}

function emptyEntry(nos: { requestNo: string; receiptNo: string }): ItemEntry {
  return {
    key: `entry-${Date.now()}`,
    item: '',
    pic: '',
    weight: '',
    purity: '',
    requestNo: nos.requestNo,
    receiptNo: nos.receiptNo,
    jobCardNo: '',
    selected: true,
  }
}

/**
 * Gold Shark Manual Entry flow:
 * 1) Open → party / Day / date / Upload AHC + empty Pending rough table
 * 2) Load voucher → all lines in editable grid + add-row (+)
 * 3) Save → persist + “Data saved successfully!”
 * 4) After save → full clear back to step 1
 */
export function ManualRequest() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const voucherFileRef = useRef<File | null>(null)

  const [partyQuery, setPartyQuery] = useState('')
  const [partyOpen, setPartyOpen] = useState(false)
  const [partyId, setPartyId] = useState('')
  const [partyName, setPartyName] = useState('')
  const [night, setNight] = useState('Day')
  const [date, setDate] = useState(toInputDate())
  const [ahcFileName, setAhcFileName] = useState('')
  const [batchNos, setBatchNos] = useState(defaultNos)
  const [rows, setRows] = useState<ItemEntry[]>([])
  const [entry, setEntry] = useState<ItemEntry>(() => emptyEntry(defaultNos()))
  const [itemOpen, setItemOpen] = useState(false)
  const [reading, setReading] = useState(false)
  const [voucherLoaded, setVoucherLoaded] = useState(false)

  const party = data.parties.find((p) => p.id === partyId)
  const hasRows = rows.length > 0

  const partyMatches = useMemo(() => {
    const q = partyQuery.trim().toLowerCase()
    if (!q) return data.parties
    return data.parties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.address.toLowerCase().includes(q),
    )
  }, [data.parties, partyQuery])

  const itemOptions = useMemo(() => {
    const fromStore = store.getAll().jewelleryCategories.map((c) => c.name)
    return fromStore.length > 0 ? fromStore : FALLBACK_ITEMS
  }, [data.jewelleryCategories])

  const itemMatches = useMemo(() => {
    const q = entry.item.trim().toLowerCase()
    if (!q) return itemOptions
    return itemOptions.filter((i) => i.toLowerCase().includes(q))
  }, [entry.item, itemOptions])

  const resetEntry = (nos = batchNos) => {
    setEntry(emptyEntry(nos))
    setItemOpen(false)
  }

  /** Step 4 — clear everything like Gold Shark after save */
  const clearAll = () => {
    setPartyId('')
    setPartyName('')
    setPartyQuery('')
    setNight('Day')
    setDate(toInputDate())
    setAhcFileName('')
    voucherFileRef.current = null
    if (fileRef.current) fileRef.current.value = ''
    const nos = defaultNos()
    setBatchNos(nos)
    setRows([])
    resetEntry(nos)
    setVoucherLoaded(false)
  }

  const fillFromVoucher = async (file: File, selectedPartyName: string) => {
    setReading(true)
    try {
      const { lines } = await readVoucherFile(file, selectedPartyName)
      const nos = {
        requestNo: lines[0]?.requestNo || defaultNos().requestNo,
        receiptNo: lines[0]?.receiptNo || defaultNos().receiptNo,
      }
      setBatchNos(nos)
      // Gold Shark: ALL voucher lines go into the main editable grid
      setRows(
        lines.map((line, i) => ({
          key: `v-${Date.now()}-${i}`,
          item: line.item,
          pic: line.pic,
          weight: line.weight,
          purity: line.purity || '22K916',
          requestNo: line.requestNo || nos.requestNo,
          receiptNo: line.receiptNo || nos.receiptNo,
          jobCardNo: line.jobCardNo || '',
          selected: true,
        })),
      )
      resetEntry(nos)
      setVoucherLoaded(true)
      toast(`Voucher loaded · ${lines.length} item(s)`)
    } catch (err) {
      console.error(err)
      toast('Failed to read voucher file')
    } finally {
      setReading(false)
    }
  }

  const tryAutoRead = async (overrides?: {
    partyId?: string
    partyName?: string
    night?: string
    file?: File | null
  }) => {
    const pid = overrides?.partyId ?? partyId
    const pname = overrides?.partyName ?? partyName
    const shift = overrides?.night ?? night
    const file = overrides?.file === undefined ? voucherFileRef.current : overrides.file
    if (!pid || !shift || !file) return
    await fillFromVoucher(file, pname)
  }

  const pickParty = (id: string, name: string) => {
    setPartyId(id)
    setPartyName(name)
    setPartyQuery(name)
    setPartyOpen(false)
    void tryAutoRead({ partyId: id, partyName: name })
  }

  const clearParty = () => {
    setPartyId('')
    setPartyName('')
    setPartyQuery('')
  }

  const onNightChange = (value: string) => {
    setNight(value)
    void tryAutoRead({ night: value })
  }

  const onFileChosen = (file: File | null) => {
    voucherFileRef.current = file
    setAhcFileName(file?.name ?? '')
    if (!file) {
      setRows([])
      setVoucherLoaded(false)
      resetEntry(batchNos)
      return
    }
    if (!partyId) {
      toast('Select Party first, then voucher will be read')
      return
    }
    if (!night) {
      toast('Select Day/Night, then voucher will be read')
      return
    }
    void tryAutoRead({ file })
  }

  const updateRow = (key: string, patch: Partial<ItemEntry>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  /** + adds current entry line into grid (Gold Shark Actions +) */
  const addEntryRow = () => {
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
    const nos = {
      requestNo: entry.requestNo || batchNos.requestNo,
      receiptNo: entry.receiptNo || batchNos.receiptNo,
    }
    setRows((prev) => [
      ...prev,
      {
        ...entry,
        key: `row-${Date.now()}`,
        item: entry.item.trim(),
        pic: entry.pic.trim(),
        weight: entry.weight.trim(),
        requestNo: nos.requestNo,
        receiptNo: nos.receiptNo,
        selected: true,
      },
    ])
    setBatchNos(nos)
    resetEntry(nos)
    setVoucherLoaded(true)
  }

  /**
   * Step 3 — Save Request (Gold Shark)
   * Persist → alert success → clear form (step 4)
   */
  const saveRequest = () => {
    if (!partyId) {
      toast('Please select a Party Name')
      return
    }
    if (!night) {
      toast('Please select Day/Night')
      return
    }
    const selected = rows.filter((r) => r.selected)
    if (selected.length === 0) {
      toast('Add or load at least one item before saving')
      return
    }

    const ids: string[] = []
    for (const row of selected) {
      const purity = row.purity.replace(/^[^\d]*/, '').replace(/\D/g, '') || row.purity
      const pr = store.addPendingRough({
        partyId,
        partyName,
        item: row.item,
        pic: Number(row.pic) || 1,
        weight: Number(row.weight),
        purity: purity || '916',
        requestNo: row.requestNo,
        receiptNo: row.receiptNo,
        jobCardNo: row.jobCardNo || '',
        cml: party?.licenseNo || '',
        night,
        date,
        ahcFileName: ahcFileName || undefined,
      })
      ids.push(pr.id)
    }

    const created = store.saveManualRequest({
      partyId,
      partyName,
      night,
      date,
      ahcFileName: ahcFileName || undefined,
      selectedIds: ids,
      source: 'Manual',
    })

    window.alert('Data saved successfully!')
    toast(`Saved ${created.length} request(s)`)
    clearAll()
  }

  const setEntryField = <K extends keyof ItemEntry>(key: K, value: ItemEntry[K]) => {
    setEntry((prev) => ({ ...prev, [key]: value }))
  }

  const toggleAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })))
  }

  const allSelected = hasRows && rows.every((r) => r.selected)

  return (
    <div className="manual-request-page">
      {/* ——— Header form (Gold Shark step 1/2) ——— */}
      <div className="panel manual-form-panel">
        <div className="manual-form-row">
          <div className="field party-search-field">
            <label>Party Name:</label>
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
            <label>Shift:</label>
            <select value={night} onChange={(e) => onNightChange(e.target.value)}>
              <option value="Day">Day</option>
              <option value="Night">Night</option>
            </select>
          </div>

          <div className="field">
            <label>Date:</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="field ahc-field">
            <label>Upload AHC</label>
            <div className="ahc-box">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.csv,.tsv,.txt,.jpg,.jpeg,.png"
                className="ahc-file-input"
                onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="btn btn-secondary ahc-choose"
                onClick={() => fileRef.current?.click()}
                disabled={reading}
              >
                Choose File
              </button>
              <span className="ahc-filename-text">
                {reading ? (
                  <>
                    <Loader2 size={14} className="spin" /> Reading…
                  </>
                ) : (
                  ahcFileName || 'No file chosen'
                )}
              </span>
            </div>
          </div>
        </div>

        {party && <div className="party-address-bar">{party.address || '—'}</div>}

        {(partyName || voucherLoaded) && (
          <div className="party-echo-field">
            <input type="text" readOnly value={partyName} placeholder="Party" />
          </div>
        )}
      </div>

      {/* ——— Step 1: empty Pending rough Requests ——— */}
      {!voucherLoaded && !hasRows && (
        <div className="panel pending-table-panel">
          <h2 className="pending-title">Pending rough Requests</h2>
          <div className="table-wrap">
            <table className="data-table navy-head-table">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Party Name</th>
                  <th>Item</th>
                  <th>PIC</th>
                  <th>Weight</th>
                  <th>Purity</th>
                  <th>Request No</th>
                  <th>Receipt No</th>
                  <th>Job Card No</th>
                  <th>CML</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={10} className="empty-state">
                    Select party, Day/Night, and upload AHC voucher to load items.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="manual-actions">
            <button type="button" className="btn btn-navy btn-save-request" onClick={saveRequest}>
              Save Request
            </button>
            <Link to="/" className="btn btn-back">
              Back
            </Link>
          </div>
        </div>
      )}

      {/* ——— Step 2: voucher loaded — editable rows + add line ——— */}
      {(voucherLoaded || hasRows) && (
        <>
          <div className="panel pending-table-panel manual-entry-panel">
            <div className="table-wrap">
              <table className="data-table navy-head-table manual-entry-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => toggleAll(e.target.checked)}
                        aria-label="Select all"
                      />
                    </th>
                    <th>Items</th>
                    <th>PIC</th>
                    <th>Weight</th>
                    <th>Purity</th>
                    <th>Request No</th>
                    <th>Receipt No</th>
                    <th>Job Card No</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) => updateRow(row.key, { selected: e.target.checked })}
                        />
                      </td>
                      <td>
                        <input
                          className="table-input"
                          value={row.item}
                          onChange={(e) => updateRow(row.key, { item: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="table-input"
                          value={row.pic}
                          onChange={(e) => updateRow(row.key, { pic: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="table-input"
                          value={row.weight}
                          onChange={(e) => updateRow(row.key, { weight: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          className="table-input"
                          value={row.purity}
                          onChange={(e) => updateRow(row.key, { purity: e.target.value })}
                        >
                          {PURITY_OPTIONS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                          {!PURITY_OPTIONS.includes(row.purity) && row.purity && (
                            <option value={row.purity}>{row.purity}</option>
                          )}
                        </select>
                      </td>
                      <td>
                        <input
                          className="table-input"
                          value={row.requestNo}
                          onChange={(e) => updateRow(row.key, { requestNo: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="table-input"
                          value={row.receiptNo}
                          onChange={(e) => updateRow(row.key, { receiptNo: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="table-input"
                          placeholder="Job Card No"
                          value={row.jobCardNo}
                          onChange={(e) => updateRow(row.key, { jobCardNo: e.target.value })}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon-action danger"
                          title="Delete row"
                          onClick={() => removeRow(row.key)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="manual-row-saves">
              <button type="button" className="btn btn-navy btn-row-save" onClick={saveRequest}>
                Save
              </button>
            </div>
          </div>

          <div className="panel pending-table-panel manual-entry-panel">
            <div className="table-wrap">
              <table className="data-table navy-head-table manual-entry-table">
                <thead>
                  <tr>
                    <th>Items</th>
                    <th>PIC</th>
                    <th>Weight</th>
                    <th>Purity</th>
                    <th>Request No</th>
                    <th>Receipt No</th>
                    <th>Job Card No</th>
                    <th style={{ width: 56 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="party-search">
                        <input
                          className="table-input"
                          placeholder="Search and select..."
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
                        placeholder="PIC"
                        value={entry.pic}
                        onChange={(e) => setEntryField('pic', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        placeholder="Weight"
                        type="number"
                        step="0.01"
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
                      <input
                        className="table-input"
                        value={entry.requestNo}
                        onChange={(e) => setEntryField('requestNo', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={entry.receiptNo}
                        onChange={(e) => setEntryField('receiptNo', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        placeholder="Job Card No"
                        value={entry.jobCardNo}
                        onChange={(e) => setEntryField('jobCardNo', e.target.value)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="add-line-btn"
                        onClick={addEntryRow}
                        title="Add row"
                      >
                        <Plus size={18} />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="manual-row-saves">
              <button type="button" className="btn btn-navy btn-row-save" onClick={saveRequest}>
                Save
              </button>
            </div>
          </div>
        </>
      )}

      {Toast}
    </div>
  )
}
