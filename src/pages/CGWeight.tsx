import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { useToast } from '../components/ui'
import { tenantGet, tenantSet } from '../data/tenant'
import { store } from '../data/store'

/**
 * Gold Shark cg_weight.php flow (QM Stock → CG WEIGHT)
 * 1) Enter Cg1 + Cg2 + Purity → Add CG Weight → Unused list
 * 2) Click row to move Unused ↔ Used
 * 3) Edit / Delete / Template upload / date+search filters
 */

type CgWeightRow = {
  id: number
  weight: number
  purity: string
  date: string
  used: boolean
  tag?: string
}

const CG_WEIGHT_KEY = 'shrija-qm-cg-weights'
const CG_PURITIES = ['999', '916', '750', '585', '925']

function loadCgWeights(): CgWeightRow[] {
  try {
    const raw = tenantGet(CG_WEIGHT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CgWeightRow[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCgWeights(rows: CgWeightRow[]) {
  tenantSet(CG_WEIGHT_KEY, JSON.stringify(rows))
  const unused = rows.filter((r) => !r.used).reduce((s, r) => s + r.weight, 0)
  store.upsertStockByName('QM cg weight unused', 'QM', Number(unused.toFixed(6)), 'g')
}

function nextCgId(rows: CgWeightRow[]) {
  const max = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 30000)
  return max + 1
}

function fmtCgDate(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}-${m}-${y}`
}

function parseCgWeight(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  if (!/^\d*\.?\d+$/.test(t) && !/^\.\d+$/.test(t)) return null
  const n = Number(t.startsWith('.') ? `0${t}` : t)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function QMCGWeightPage({ hubPath = '/qm-stock' }: { hubPath?: string }) {
  const { toast, Toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tick, setTick] = useState(0)
  const [cg1, setCg1] = useState('')
  const [cg2, setCg2] = useState('')
  const [purity, setPurity] = useState('916')

  const [unusedQ, setUnusedQ] = useState('')
  const [unusedStart, setUnusedStart] = useState('')
  const [unusedEnd, setUnusedEnd] = useState('')
  const [usedQ, setUsedQ] = useState('')
  const [usedStart, setUsedStart] = useState('')
  const [usedEnd, setUsedEnd] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editWeight, setEditWeight] = useState('')

  const rows = useMemo(() => {
    void tick
    return loadCgWeights()
  }, [tick])

  const filterList = (list: CgWeightRow[], q: string, start: string, end: string) => {
    const s = q.trim().toLowerCase()
    return list.filter((r) => {
      if (start && r.date < start) return false
      if (end && r.date > end) return false
      if (
        s &&
        !String(r.id).includes(s) &&
        !String(r.weight).includes(s) &&
        !r.weight.toFixed(3).includes(s) &&
        !(r.tag || '').toLowerCase().includes(s)
      ) {
        return false
      }
      return true
    })
  }

  const unused = useMemo(
    () => filterList(
      rows.filter((r) => !r.used),
      unusedQ,
      unusedStart,
      unusedEnd,
    ),
    [rows, unusedQ, unusedStart, unusedEnd],
  )
  const used = useMemo(
    () => filterList(
      rows.filter((r) => r.used),
      usedQ,
      usedStart,
      usedEnd,
    ),
    [rows, usedQ, usedStart, usedEnd],
  )

  const unusedTotal = unused.reduce((s, r) => s + r.weight, 0)
  const usedTotal = used.reduce((s, r) => s + r.weight, 0)

  const persist = (next: CgWeightRow[]) => {
    saveCgWeights(next)
    setTick((t) => t + 1)
  }

  const addCgWeights = () => {
    const w1 = parseCgWeight(cg1)
    const w2 = parseCgWeight(cg2)
    if (w1 == null && w2 == null) {
      toast('Enter Cg1 and/or Cg2 weight')
      return
    }
    if (!purity) {
      toast('Select purity')
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    let next = [...rows]
    let id = nextCgId(next)
    if (w1 != null) {
      next = [{ id, weight: w1, purity, date: today, used: false, tag: 'CG1' }, ...next]
      id += 1
    }
    if (w2 != null) {
      next = [{ id, weight: w2, purity, date: today, used: false, tag: 'CG2' }, ...next]
    }
    persist(next)
    setCg1('')
    setCg2('')
    toast('CG weight(s) added to Unused')
  }

  const markUsed = (id: number) => {
    persist(rows.map((r) => (r.id === id ? { ...r, used: true } : r)))
    toast('Moved to Used CG Weights')
  }

  const markUnused = (id: number) => {
    persist(rows.map((r) => (r.id === id ? { ...r, used: false } : r)))
    toast('Moved to Unused CG Weights')
  }

  const removeOne = (id: number) => {
    if (!window.confirm(`Delete CG weight ${id}?`)) return
    persist(rows.filter((r) => r.id !== id))
    toast('Deleted')
  }

  const clearUnused = () => {
    if (!unused.length) return
    if (!window.confirm(`Delete all ${unused.length} unused weight(s) in view?`)) return
    const ids = new Set(unused.map((r) => r.id))
    persist(rows.filter((r) => !ids.has(r.id)))
    toast('Unused list cleared')
  }

  const clearUsed = () => {
    if (!used.length) return
    if (!window.confirm(`Delete all ${used.length} used weight(s) in view?`)) return
    const ids = new Set(used.map((r) => r.id))
    persist(rows.filter((r) => !ids.has(r.id)))
    toast('Used list cleared')
  }

  const startEdit = (r: CgWeightRow) => {
    setEditId(r.id)
    setEditWeight(String(r.weight))
  }

  const saveEdit = () => {
    if (editId == null) return
    const w = parseCgWeight(editWeight)
    if (w == null) {
      toast('Invalid weight')
      return
    }
    persist(rows.map((r) => (r.id === editId ? { ...r, weight: w } : r)))
    setEditId(null)
    setEditWeight('')
    toast('Weight updated')
  }

  const downloadTemplate = () => {
    const csv = ['CG1 Weight,CG2 Weight,Purity', '149.230,149.320,916'].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cg-weight-template.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast('Template downloaded')
  }

  const uploadExcel = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      if (lines.length < 2) {
        toast('No data rows in file')
        return
      }
      const today = new Date().toISOString().slice(0, 10)
      let next = [...rows]
      let id = nextCgId(next)
      let added = 0
      for (const line of lines.slice(1)) {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        const w1 = parseCgWeight(cols[0] || '')
        const w2 = parseCgWeight(cols[1] || '')
        const pur = cols[2] || purity || '916'
        if (w1 != null) {
          next = [{ id, weight: w1, purity: pur, date: today, used: false, tag: 'CG1' }, ...next]
          id += 1
          added += 1
        }
        if (w2 != null) {
          next = [{ id, weight: w2, purity: pur, date: today, used: false, tag: 'CG2' }, ...next]
          id += 1
          added += 1
        }
      }
      persist(next)
      toast(`Uploaded ${added} CG weight(s)`)
      if (fileRef.current) fileRef.current.value = ''
    }
    reader.readAsText(file)
  }

  const renderList = (list: CgWeightRow[], side: 'unused' | 'used') => (
    <div className="cgw-list">
      {list.length === 0 ? (
        <div className="cgw-empty">No weights</div>
      ) : (
        list.map((r) => (
          <div key={r.id} className="cgw-row">
            {editId === r.id ? (
              <div className="cgw-edit-row">
                <span>{r.id})</span>
                <input
                  className="table-input"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                  autoFocus
                />
                <button type="button" className="btn btn-navy" onClick={saveEdit}>
                  OK
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditId(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="cgw-row-main"
                  title={side === 'unused' ? 'Click to mark Used (lab use)' : 'Click to mark Unused'}
                  onClick={() => (side === 'unused' ? markUsed(r.id) : markUnused(r.id))}
                >
                  <span>
                    {r.id}) {r.weight.toFixed(3)} (Date: {fmtCgDate(r.date)})
                    {r.tag ? ` · ${r.tag}` : ''}
                    {r.purity ? ` · ${r.purity}` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  className="cgw-icon-btn"
                  title="Edit"
                  onClick={() => startEdit(r)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className="cgw-icon-btn danger"
                  title="Delete"
                  onClick={() => removeOne(r.id)}
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        ))
      )}
    </div>
  )

  return (
    <div className="cgw-page">
      <div className="panel cgw-top">
        <div className="cgw-add-row">
          <div className="field">
            <label>Enter New Cg1 Weight</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Enter New Cg1 Weight"
              value={cg1}
              onChange={(e) => setCg1(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Enter New Cg2 Weight</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Enter New Cg2 Weight"
              value={cg2}
              onChange={(e) => setCg2(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Select Purity</label>
            <select value={purity} onChange={(e) => setPurity(e.target.value)}>
              <option value="">Select Purity</option>
              {CG_PURITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="cgw-actions">
          <button type="button" className="btn btn-navy" onClick={addCgWeights}>
            Add CG Weight
          </button>
          <button type="button" className="btn cgw-btn-green" onClick={downloadTemplate}>
            Download Template
          </button>
          <button
            type="button"
            className="btn cgw-btn-orange"
            onClick={() => fileRef.current?.click()}
          >
            Upload Excel
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            hidden
            onChange={(e) => uploadExcel(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      <div className="cgw-columns">
        <section className="panel cgw-col">
          <h2>Unused CG Weights</h2>
          <div className="cgw-filters">
            <input
              placeholder="Search unused weights"
              value={unusedQ}
              onChange={(e) => setUnusedQ(e.target.value)}
            />
            <input
              type="date"
              value={unusedStart}
              onChange={(e) => setUnusedStart(e.target.value)}
              aria-label="Unused start date"
            />
            <input
              type="date"
              value={unusedEnd}
              onChange={(e) => setUnusedEnd(e.target.value)}
              aria-label="Unused end date"
            />
          </div>
          {renderList(unused, 'unused')}
          <div className="cgw-footer">
            <strong>Total Weight: {unusedTotal.toFixed(6)}</strong>
            <button type="button" className="cgw-trash-lg" title="Clear unused" onClick={clearUnused}>
              <Trash2 size={22} />
            </button>
          </div>
        </section>

        <section className="panel cgw-col">
          <h2>Used CG Weights</h2>
          <div className="cgw-filters">
            <input
              placeholder="Search used weights"
              value={usedQ}
              onChange={(e) => setUsedQ(e.target.value)}
            />
            <input
              type="date"
              value={usedStart}
              onChange={(e) => setUsedStart(e.target.value)}
              aria-label="Used start date"
            />
            <input
              type="date"
              value={usedEnd}
              onChange={(e) => setUsedEnd(e.target.value)}
              aria-label="Used end date"
            />
          </div>
          {renderList(used, 'used')}
          <div className="cgw-footer">
            <strong>Total Weight: {usedTotal.toFixed(6)}</strong>
            <button type="button" className="cgw-trash-lg" title="Clear used" onClick={clearUsed}>
              <Trash2 size={22} />
            </button>
          </div>
        </section>
      </div>

      <div className="manual-actions">
        <Link to={hubPath} className="btn btn-navy">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}
