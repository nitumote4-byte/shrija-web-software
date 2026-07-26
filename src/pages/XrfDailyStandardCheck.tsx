import { useMemo, useState } from 'react'
import { CheckCircle2, FlaskConical, Trash2, XCircle } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { getSession } from '../data/auth'
import { store } from '../data/store'

const STANDARDS = [
  'Au 999 CRM',
  'Au 916 CRM',
  'Au 750 CRM',
  'Au 585 CRM',
  'Ag 999 CRM',
  'Other',
]

function localYmd(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function expectedForStandard(name: string) {
  if (name.includes('999')) return '999.0'
  if (name.includes('916')) return '916.0'
  if (name.includes('750')) return '750.0'
  if (name.includes('585')) return '585.0'
  return ''
}

export function XrfDailyStandardCheck() {
  const { toast, Toast } = useToast()
  const session = getSession()
  const [tick, setTick] = useState(0)
  void tick

  const data = store.getAll()
  const rows = data.xrfStandardChecks || []

  const [date, setDate] = useState(() => localYmd())
  const [machineId, setMachineId] = useState('XRF-1')
  const [standardPick, setStandardPick] = useState('Au 916 CRM')
  const [customStandard, setCustomStandard] = useState('')
  const [expectedValue, setExpectedValue] = useState('916.0')
  const [measuredValue, setMeasuredValue] = useState('')
  const [tolerance, setTolerance] = useState('0.5')
  const [checkedBy, setCheckedBy] = useState(() => session?.username || '')
  const [remarks, setRemarks] = useState('')
  const [filterDate, setFilterDate] = useState(() => localYmd())

  const standardName = standardPick === 'Other' ? customStandard.trim() : standardPick

  const previewDev = useMemo(() => {
    const e = Number(expectedValue) || 0
    const m = Number(measuredValue) || 0
    return Number((m - e).toFixed(3))
  }, [expectedValue, measuredValue])

  const previewPass = useMemo(() => {
    const tol = Number(tolerance) || 0
    return Math.abs(previewDev) <= tol
  }, [previewDev, tolerance])

  const filtered = useMemo(
    () => rows.filter((r) => !filterDate || r.date === filterDate),
    [rows, filterDate, tick],
  )

  const todayPass = filtered.filter((r) => r.result === 'Pass').length
  const todayFail = filtered.filter((r) => r.result === 'Fail').length

  const onStandardChange = (name: string) => {
    setStandardPick(name)
    const exp = expectedForStandard(name)
    if (exp) setExpectedValue(exp)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!standardName) {
      toast('Select / enter standard name')
      return
    }
    if (!measuredValue || Number.isNaN(Number(measuredValue))) {
      toast('Enter measured XRF reading')
      return
    }
    const entry = store.addXrfStandardCheck({
      date,
      machineId,
      standardName,
      expectedValue: Number(expectedValue) || 0,
      measuredValue: Number(measuredValue) || 0,
      tolerance: Number(tolerance) || 0,
      checkedBy: checkedBy.trim() || session?.username || '—',
      remarks: remarks.trim(),
    })
    setTick((t) => t + 1)
    setFilterDate(date)
    setMeasuredValue('')
    setRemarks('')
    toast(`${entry.checkNo} saved — ${entry.result}`)
  }

  const remove = (id: string, checkNo: string) => {
    if (!window.confirm(`Delete ${checkNo}?`)) return
    if (store.deleteXrfStandardCheck(id)) {
      setTick((t) => t + 1)
      toast('Standard check deleted')
    }
  }

  return (
    <div className="xrfstd-page">
      <PageHeader
        title="XRF Daily Standard Check"
        subtitle="Maintain daily XRF machine standard / CRM verification entries."
      />

      <div className="xrfstd-kpi-row">
        <div className="xrfstd-kpi">
          <span>Checks (filter)</span>
          <strong>{filtered.length}</strong>
        </div>
        <div className="xrfstd-kpi pass">
          <span>Pass</span>
          <strong>{todayPass}</strong>
        </div>
        <div className="xrfstd-kpi fail">
          <span>Fail</span>
          <strong>{todayFail}</strong>
        </div>
      </div>

      <section className="exp-card xrfstd-card">
        <header className="exp-card-head">
          <div className="exp-card-icon blue">
            <FlaskConical size={22} />
          </div>
          <div>
            <h2>New standard check</h2>
            <p>Record expected vs measured reading for the day&apos;s machine verification.</p>
          </div>
        </header>

        <form className="xrfstd-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>Machine ID</label>
              <input
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                placeholder="XRF-1"
                required
              />
            </div>
            <div className="field">
              <label>Standard</label>
              <select value={standardPick} onChange={(e) => onStandardChange(e.target.value)}>
                {STANDARDS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {standardPick === 'Other' && (
              <div className="field">
                <label>Standard name</label>
                <input
                  value={customStandard}
                  onChange={(e) => setCustomStandard(e.target.value)}
                  placeholder="Enter CRM / standard name"
                  required
                />
              </div>
            )}
            <div className="field">
              <label>Expected value</label>
              <input
                type="number"
                step="0.001"
                value={expectedValue}
                onChange={(e) => setExpectedValue(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Measured (XRF)</label>
              <input
                type="number"
                step="0.001"
                value={measuredValue}
                onChange={(e) => setMeasuredValue(e.target.value)}
                placeholder="e.g. 916.15"
                required
              />
            </div>
            <div className="field">
              <label>Tolerance (±)</label>
              <input
                type="number"
                step="0.001"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Checked by</label>
              <input
                value={checkedBy}
                onChange={(e) => setCheckedBy(e.target.value)}
                placeholder="Operator name"
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Remarks</label>
              <input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>

          {measuredValue !== '' && (
            <p className={`xrfstd-preview ${previewPass ? 'pass' : 'fail'}`}>
              {previewPass ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              Deviation: {previewDev >= 0 ? '+' : ''}
              {previewDev.toFixed(3)} → <strong>{previewPass ? 'Pass' : 'Fail'}</strong>
            </p>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-navy">
              Save standard check
            </button>
          </div>
        </form>
      </section>

      <section className="exp-card xrfstd-card">
        <header className="exp-card-head">
          <div>
            <h2>Standard check register</h2>
            <p>Daily history for XRF machine verification.</p>
          </div>
          <div className="field xrfstd-filter">
            <label>Filter date</label>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>
        </header>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Check No</th>
                <th>Date</th>
                <th>Machine</th>
                <th>Standard</th>
                <th>Expected</th>
                <th>Measured</th>
                <th>Dev</th>
                <th>Tol (±)</th>
                <th>Result</th>
                <th>By</th>
                <th>Remarks</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No standard checks for this date.
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.checkNo}</td>
                  <td>{r.date.split('-').reverse().join('/')}</td>
                  <td>{r.machineId}</td>
                  <td>{r.standardName}</td>
                  <td>{r.expectedValue.toFixed(3)}</td>
                  <td>{r.measuredValue.toFixed(3)}</td>
                  <td>
                    {r.deviation >= 0 ? '+' : ''}
                    {r.deviation.toFixed(3)}
                  </td>
                  <td>{r.tolerance.toFixed(3)}</td>
                  <td>
                    <span className={`xrfstd-status ${r.result === 'Pass' ? 'pass' : 'fail'}`}>
                      {r.result}
                    </span>
                  </td>
                  <td>{r.checkedBy || '—'}</td>
                  <td>{r.remarks || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title="Delete"
                      onClick={() => remove(r.id, r.checkNo)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {Toast}
    </div>
  )
}
