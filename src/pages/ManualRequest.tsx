import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import { useToast } from '../components/ui'
import { store } from '../data/store'
import { readVoucherFile } from '../utils/voucherReader'

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

type ItemEntry = {
  key: string
  item: string
  pic: string
  weight: string
  purity: string
  requestNo: string
  receiptNo: string
  jobCardNo: string
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
  }
}

export function ManualRequest() {
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const voucherFileRef = useRef<File | null>(null)

  const [partyQuery, setPartyQuery] = useState('')
  const [partyOpen, setPartyOpen] = useState(false)
  const [partyId, setPartyId] = useState('')
  const [partyName, setPartyName] = useState('')
  const [night, setNight] = useState('')
  const [date, setDate] = useState(toInputDate())
  const [ahcFileName, setAhcFileName] = useState('')
  const [batchNos, setBatchNos] = useState(defaultNos)
  const [summaryRows, setSummaryRows] = useState<ItemEntry[]>([])
  const [entry, setEntry] = useState<ItemEntry>(() => emptyEntry(defaultNos()))
  const [itemOpen, setItemOpen] = useState(false)
  const [reading, setReading] = useState(false)
  const [readNote, setReadNote] = useState('')

  const party = data.parties.find((p) => p.id === partyId)

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

  const itemMatches = useMemo(() => {
    const q = entry.item.trim().toLowerCase()
    if (!q) return ITEM_OPTIONS
    return ITEM_OPTIONS.filter((i) => i.toLowerCase().includes(q))
  }, [entry.item])

  const canRead = Boolean(partyId && night && voucherFileRef.current)

  const resetEntry = (nos = batchNos) => {
    setEntry(emptyEntry(nos))
    setItemOpen(false)
  }

  const fillFromVoucher = async (file: File, selectedPartyName: string) => {
    setReading(true)
    setReadNote('Reading voucher…')
    try {
      const { lines, source } = await readVoucherFile(file, selectedPartyName)
      const nos = {
        requestNo: lines[0]?.requestNo || defaultNos().requestNo,
        receiptNo: lines[0]?.receiptNo || defaultNos().receiptNo,
      }
      setBatchNos(nos)

      // First voucher line goes into Entry grid for review/Save;
      // remaining lines accumulate in Summary grid.
      const [first, ...rest] = lines
      if (first) {
        setEntry({
          key: `entry-${Date.now()}`,
          item: first.item,
          pic: first.pic,
          weight: first.weight,
          purity: first.purity,
          requestNo: first.requestNo || nos.requestNo,
          receiptNo: first.receiptNo || nos.receiptNo,
          jobCardNo: first.jobCardNo,
        })
      } else {
        resetEntry(nos)
      }

      setSummaryRows(
        rest.map((line, i) => ({
          key: `sum-${Date.now()}-${i}`,
          item: line.item,
          pic: line.pic,
          weight: line.weight,
          purity: line.purity,
          requestNo: line.requestNo || nos.requestNo,
          receiptNo: line.receiptNo || nos.receiptNo,
          jobCardNo: line.jobCardNo,
        })),
      )

      setReadNote(
        `Loaded ${lines.length} line(s) from ${source} — review Entry grid, then Save`,
      )
      toast(`Voucher read · ${lines.length} item(s) ready`)
    } catch (err) {
      console.error(err)
      setReadNote('Could not read voucher')
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
    setSummaryRows([])
    const nos = defaultNos()
    setBatchNos(nos)
    resetEntry(nos)
    setReadNote('')
  }

  const onNightChange = (value: string) => {
    setNight(value)
    void tryAutoRead({ night: value })
  }

  const onFileChosen = (file: File | null) => {
    voucherFileRef.current = file
    setAhcFileName(file?.name ?? '')
    if (!file) {
      setSummaryRows([])
      resetEntry(batchNos)
      setReadNote('')
      return
    }
    if (!partyId) {
      toast('Select Party first, then voucher will be read')
      return
    }
    if (!night) {
      toast('Select Night/Day shift, then voucher will be read')
      return
    }
    void tryAutoRead({ file })
  }

  const setEntryField = <K extends keyof ItemEntry>(key: K, value: ItemEntry[K]) => {
    setEntry((prev) => ({ ...prev, [key]: value }))
  }

  /** Save entry row → push into Summary grid, then clear Entry grid */
  const saveEntryToSummary = () => {
    if (!partyId) {
      toast('Please select a Party Name')
      return
    }
    if (!night) {
      toast('Please select Night/Day')
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

    const next: ItemEntry = {
      ...entry,
      key: `sum-${Date.now()}`,
      item: entry.item.trim(),
      pic: entry.pic.trim(),
      weight: entry.weight.trim(),
      requestNo: entry.requestNo || batchNos.requestNo,
      receiptNo: entry.receiptNo || batchNos.receiptNo,
    }

    setSummaryRows((prev) => [...prev, next])
    resetEntry({
      requestNo: next.requestNo,
      receiptNo: next.receiptNo,
    })
    toast(`${next.item} added to summary`)
  }

  const removeSummaryRow = (key: string) => {
    setSummaryRows((prev) => prev.filter((r) => r.key !== key))
  }

  /** + clears entry for next item (keeps request/receipt nos) */
  const clearEntryForNext = () => {
    resetEntry({
      requestNo: entry.requestNo || batchNos.requestNo,
      receiptNo: entry.receiptNo || batchNos.receiptNo,
    })
  }

  /** Final submit — persist all summary rows */
  const submitRequest = () => {
    if (!partyId) {
      toast('Please select a Party Name')
      return
    }
    if (!night) {
      toast('Please select Night/Day')
      return
    }
    if (summaryRows.length === 0) {
      toast('Add at least one item via Save before submitting')
      return
    }

    for (const row of summaryRows) {
      const purityCode = row.purity.replace(/^[^\d]*/, '').replace(/\D/g, '') || row.purity
      const category =
        data.categories.find((c) => row.purity.includes(c.purity) || c.purity === purityCode) ??
        data.categories[0]

      store.addRequest({
        partyId,
        partyName,
        categoryId: category.id,
        categoryName: category.name,
        pieces: Number(row.pic) || 1,
        weight: Number(row.weight),
        purity: purityCode || category.purity,
        status: 'Pending',
        source: 'Manual',
        remarks: [
          `Night: ${night}`,
          `Item: ${row.item}`,
          `Req: ${row.requestNo}`,
          `Rcpt: ${row.receiptNo}`,
          row.jobCardNo ? `JC: ${row.jobCardNo}` : '',
          ahcFileName ? `AHC: ${ahcFileName}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      })

      store.addPendingRough({
        partyId,
        partyName,
        item: row.item,
        pic: Number(row.pic) || 1,
        weight: Number(row.weight),
        purity: purityCode || category.purity,
        requestNo: row.requestNo,
        receiptNo: row.receiptNo,
        jobCardNo: row.jobCardNo || `JC-${row.requestNo.slice(-4)}`,
        cml: party?.licenseNo || '',
        night,
        date,
        ahcFileName: ahcFileName || undefined,
      })
    }

    toast(`Request submitted · ${summaryRows.length} item(s)`)
    setSummaryRows([])
    resetEntry(batchNos)
  }

  return (
    <div className="manual-request-page">
      <div className="panel manual-form-panel">
        <div className="manual-form-row">
          <div className="field party-search-field">
            <label>Party Name:</label>
            <div className="party-search">
              <div className="party-input-wrap">
                <input
                  type="text"
                  placeholder="Search and select Party."
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
            <label>Night:</label>
            <select value={night} onChange={(e) => onNightChange(e.target.value)}>
              <option value="">Select</option>
              <option value="Day">Day</option>
              <option value="Night">Night</option>
            </select>
          </div>

          <div className="field">
            <label>Date:</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="field ahc-field">
            <label>Upload AHC:</label>
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
              <input type="text" readOnly className="ahc-filename" value={ahcFileName} />
            </div>
          </div>
        </div>

        {party && <div className="party-address-bar">{party.address || '—'}</div>}

        <div className="party-echo-field">
          <input type="text" readOnly value={partyName} placeholder="Party" />
        </div>

        <div className="voucher-status">
          {reading ? (
            <span className="voucher-reading">
              <Loader2 size={14} className="spin" /> Reading voucher…
            </span>
          ) : readNote ? (
            <span className="voucher-ready">{readNote}</span>
          ) : (
            <span className="voucher-hint">
              Select Party + Night/Day, upload voucher — then Save each entry into the summary
              grid.
            </span>
          )}
          {canRead && !reading && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                voucherFileRef.current && fillFromVoucher(voucherFileRef.current, partyName)
              }
            >
              Re-read Voucher
            </button>
          )}
        </div>
      </div>

      {/* ——— Summary Grid (top) ——— */}
      <div className="panel pending-table-panel manual-entry-panel">
        <div className="grid-section-label">
          Summary Grid
          <span>{summaryRows.length} item(s)</span>
        </div>
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
                <th style={{ width: 56 }} />
              </tr>
            </thead>
            <tbody>
              {summaryRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state summary-empty">
                    Saved items will appear here
                  </td>
                </tr>
              ) : (
                summaryRows.map((row) => (
                  <tr key={row.key} className="summary-row">
                    <td>{row.item}</td>
                    <td>{row.pic}</td>
                    <td>{row.weight}</td>
                    <td>{row.purity}</td>
                    <td>{row.requestNo}</td>
                    <td>{row.receiptNo}</td>
                    <td>{row.jobCardNo || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-action danger"
                        title="Remove"
                        onClick={() => removeSummaryRow(row.key)}
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
      </div>

      {/* ——— Entry Grid (bottom) ——— */}
      <div className="panel pending-table-panel manual-entry-panel">
        <div className="grid-section-label">
          Entry Grid
          <span>Fill one item, then Save</span>
        </div>
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
                    onClick={clearEntryForNext}
                    title="Clear entry for next item"
                  >
                    <Plus size={18} />
                  </button>
                </td>
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

      <div className="manual-actions">
        <button type="button" className="btn btn-primary btn-save-request" onClick={submitRequest}>
          Save Request
        </button>
        <Link to="/" className="btn btn-back">
          Back
        </Link>
      </div>

      {Toast}
    </div>
  )
}
