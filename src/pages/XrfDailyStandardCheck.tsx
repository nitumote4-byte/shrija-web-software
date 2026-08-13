import { useEffect, useMemo, useRef, useState } from 'react'
import { FlaskConical, Pencil, Plus, RefreshCw, Settings2, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { store } from '../data/store'
import {
  calcXrfAverage,
  DEFAULT_XRF_TYPE,
  formatXrfCarat,
  formatXrfDateDisplay,
  formatXrfTimeDisplay,
  formatXrfValue,
  parseXrfNumber,
  validateXrfCheckInput,
  xrfInputStep,
  type XrfCheckFieldErrors,
  type XrfDuplicateMode,
  type XrfStandard,
  type XrfStandardCheck,
} from '../data/xrfStandards'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function localYmd(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function localHm(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function todayCount(rows: XrfStandardCheck[]) {
  const today = localYmd()
  return rows.filter((r) => r.date === today).length
}

export function XrfDailyStandardCheck() {
  const { toast, Toast } = useToast()
  const [, setTick] = useState(0)
  const [view, setView] = useState<'entry' | 'master'>('entry')

  const data = store.getAll()
  const rows = data.xrfStandardChecks || []
  const standards = data.xrfStandards || []
  const settings = data.xrfStandardSettings || store.getXrfStandardSettings()

  const [date, setDate] = useState(() => localYmd())
  const [time, setTime] = useState(() => localHm())
  const [type, setType] = useState(DEFAULT_XRF_TYPE)
  const [standardId, setStandardId] = useState('')
  const [purity, setPurity] = useState('')
  const [carat, setCarat] = useState('')
  const [reading1, setReading1] = useState('')
  const [reading2, setReading2] = useState('')
  const [errors, setErrors] = useState<XrfCheckFieldErrors>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterDate, setFilterDate] = useState(() => localYmd())

  const [masterName, setMasterName] = useState('')
  const [masterPurity, setMasterPurity] = useState('')
  const [masterCarat, setMasterCarat] = useState('')
  const [masterEditingId, setMasterEditingId] = useState<string | null>(null)
  const [masterErrors, setMasterErrors] = useState<{ name?: string; purity?: string; carat?: string }>(
    {},
  )

  const standardRef = useRef<HTMLSelectElement>(null)
  const reading1Ref = useRef<HTMLInputElement>(null)

  const selected = standards.find((s) => s.id === standardId) || null
  const decimals = settings.valueDecimals
  const inputStep = xrfInputStep(decimals)

  const r1n = parseXrfNumber(reading1)
  const r2n = parseXrfNumber(reading2)
  const averageReady = r1n != null && r2n != null && r1n > 0 && r2n > 0
  const average = averageReady ? calcXrfAverage(r1n, r2n, decimals) : null

  const filtered = useMemo(
    () => rows.filter((r) => !filterDate || r.date === filterDate),
    [rows, filterDate],
  )

  const applyStandard = (std: XrfStandard | null, keepManualPurity = false) => {
    if (!std) {
      setPurity('')
      setCarat('')
      return
    }
    setCarat(formatXrfCarat(std.carat, decimals))
    if (!keepManualPurity || !settings.allowManualPurity) {
      setPurity(formatXrfValue(std.purity, decimals))
    }
  }

  useEffect(() => {
    if (view === 'entry') standardRef.current?.focus()
  }, [view])

  const reload = () => setTick((t) => t + 1)

  const clearEntryFields = () => {
    setStandardId('')
    setPurity('')
    setCarat('')
    setReading1('')
    setReading2('')
    setErrors({})
  }

  const resetNewSession = () => {
    setEditingId(null)
    setDate(localYmd())
    setTime(localHm())
    setType(DEFAULT_XRF_TYPE)
    clearEntryFields()
  }

  const isDirty = () =>
    Boolean(
      editingId ||
        standardId ||
        reading1 ||
        reading2 ||
        (settings.allowManualPurity && purity) ||
        type !== DEFAULT_XRF_TYPE,
    )

  const onStandardChange = (id: string) => {
    setStandardId(id)
    setErrors((e) => ({ ...e, standardId: undefined }))
    applyStandard(standards.find((s) => s.id === id) || null)
  }

  const startEdit = (row: XrfStandardCheck) => {
    setEditingId(row.id)
    setDate(row.date || localYmd())
    setTime(row.time || localHm())
    setType(row.type || DEFAULT_XRF_TYPE)
    const std = standards.find((s) => s.id === row.standardId) || null
    setStandardId(std?.id || row.standardId || '')
    if (std) {
      applyStandard(std, true)
      if (settings.allowManualPurity) setPurity(formatXrfValue(row.purity, decimals))
    } else {
      setPurity(formatXrfValue(row.purity, decimals))
      setCarat(formatXrfCarat(row.carat, decimals))
    }
    setReading1(formatXrfValue(row.reading1, decimals))
    setReading2(formatXrfValue(row.reading2, decimals))
    setErrors({})
    setFilterDate(row.date || filterDate)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => reading1Ref.current?.focus(), 50)
  }

  const newEntry = () => {
    if (isDirty() && !window.confirm('Discard unsaved standard check entry?')) return
    resetNewSession()
    setTimeout(() => standardRef.current?.focus(), 0)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      date,
      time,
      type,
      standardId,
      purity,
      reading1,
      reading2,
      // average is never submitted — store/API always recalculate from readings
    }
    const client = validateXrfCheckInput({
      ...payload,
      standardName: selected?.name,
      requireStandard: true,
    })
    if (!client.ok) {
      setErrors(client.errors)
      toast(Object.values(client.errors)[0] || 'Please complete the entry')
      return
    }
    const result = editingId
      ? store.updateXrfStandardCheck(editingId, payload)
      : store.addXrfStandardCheck(payload)
    if (!result.ok) {
      if (result.field) setErrors({ [result.field]: result.error })
      toast(result.error)
      return
    }
    reload()
    setFilterDate(date)
    if (editingId) {
      toast(`${result.entry.checkNo} updated`)
      resetNewSession()
    } else {
      toast(`${result.entry.checkNo} saved`)
      clearEntryFields()
    }
    setTimeout(() => standardRef.current?.focus(), 0)
  }

  const remove = (row: XrfStandardCheck) => {
    if (!window.confirm(`Delete ${row.standardName || row.checkNo} for ${formatXrfDateDisplay(row.date)}?`)) {
      return
    }
    if (!store.deleteXrfStandardCheck(row.id)) return
    if (editingId === row.id) resetNewSession()
    reload()
    toast('Standard check deleted')
  }

  const submitMaster = (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: { name?: string; purity?: string; carat?: string } = {}
    if (!masterName.trim()) nextErrors.name = 'Standard name is required'
    const p = parseXrfNumber(masterPurity)
    if (p == null || p <= 0) nextErrors.purity = 'Enter a valid purity / reference value'
    const c = parseXrfNumber(masterCarat)
    if (c == null || c <= 0) nextErrors.carat = 'Enter a valid carat'
    if (Object.keys(nextErrors).length) {
      setMasterErrors(nextErrors)
      toast(Object.values(nextErrors)[0] || 'Please complete the standard')
      return
    }
    const result = masterEditingId
      ? store.updateXrfStandard(masterEditingId, {
          name: masterName,
          purity: masterPurity,
          carat: masterCarat,
        })
      : store.addXrfStandard({ name: masterName, purity: masterPurity, carat: masterCarat })
    if (!result.ok) {
      toast(result.error)
      return
    }
    setMasterName('')
    setMasterPurity('')
    setMasterCarat('')
    setMasterEditingId(null)
    setMasterErrors({})
    reload()
    toast(masterEditingId ? 'Standard updated' : 'Standard added')
  }

  const startMasterEdit = (row: XrfStandard) => {
    setMasterEditingId(row.id)
    setMasterName(row.name)
    setMasterPurity(formatXrfValue(row.purity, decimals))
    setMasterCarat(formatXrfCarat(row.carat, decimals))
    setMasterErrors({})
  }

  const removeMaster = (row: XrfStandard) => {
    if (!window.confirm(`Delete standard "${row.name}"? Existing daily records are kept.`)) return
    if (!store.deleteXrfStandard(row.id)) return
    if (masterEditingId === row.id) {
      setMasterEditingId(null)
      setMasterName('')
      setMasterPurity('')
      setMasterCarat('')
    }
    if (standardId === row.id) {
      setStandardId('')
      setPurity('')
      setCarat('')
    }
    reload()
    toast('Standard deleted')
  }

  const restoreDefaults = () => {
    const added = store.restoreDefaultXrfStandards()
    reload()
    toast(added > 0 ? `${added} default standard(s) added` : 'Default standards already present')
  }

  return (
    <div className="xrfstd-page">
      <PageHeader
        title="XRF Daily Standard Check"
        subtitle="Record daily XRF machine standard checks and maintain the standard master."
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setView((v) => (v === 'master' ? 'entry' : 'master'))}
          >
            {view === 'master' ? (
              <>
                <FlaskConical size={15} /> Back to entry
              </>
            ) : (
              <>
                <Settings2 size={15} /> Standard Master
              </>
            )}
          </button>
        }
      />

      {view === 'entry' ? (
        <>
          <div className="xrfstd-kpi-row">
            <div className="xrfstd-kpi">
              <span>Checks (filter)</span>
              <strong>{filtered.length}</strong>
            </div>
            <div className="xrfstd-kpi">
              <span>Today</span>
              <strong>{todayCount(rows)}</strong>
            </div>
            <div className="xrfstd-kpi">
              <span>Standards</span>
              <strong>{standards.length}</strong>
            </div>
          </div>

          <section className="exp-card xrfstd-card">
            <header className="exp-card-head">
              <div className={`exp-card-icon ${editingId ? 'green' : 'blue'}`}>
                {editingId ? <Pencil size={18} /> : <FlaskConical size={18} />}
              </div>
              <div>
                <h2>{editingId ? 'Edit standard check' : 'New standard check'}</h2>
                <p>
                  {editingId
                    ? 'Update readings — average recalculates automatically.'
                    : 'Select the standard, enter both XRF readings, then press Enter to add.'}
                </p>
              </div>
            </header>

            <form
              className="xrfstd-form"
              onSubmit={submit}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if ((e.target as HTMLElement).tagName !== 'INPUT') return
                e.preventDefault()
                e.currentTarget.requestSubmit()
              }}
            >
              <div className="form-grid xrfstd-grid">
                <div className={`field ${errors.date ? 'has-error' : ''}`}>
                  <label>
                    Date <span className="req">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value)
                      setErrors((er) => ({ ...er, date: undefined }))
                    }}
                  />
                  {errors.date && <span className="field-error">{errors.date}</span>}
                </div>
                <div className={`field ${errors.time ? 'has-error' : ''}`}>
                  <label>
                    Time <span className="req">*</span>
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => {
                      setTime(e.target.value)
                      setErrors((er) => ({ ...er, time: undefined }))
                    }}
                  />
                  {errors.time && <span className="field-error">{errors.time}</span>}
                </div>
                <div className={`field ${errors.type ? 'has-error' : ''}`}>
                  <label>Type</label>
                  <input
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value)
                      setErrors((er) => ({ ...er, type: undefined }))
                    }}
                    placeholder={DEFAULT_XRF_TYPE}
                  />
                  {errors.type && <span className="field-error">{errors.type}</span>}
                </div>
                <div className={`field ${errors.standardId ? 'has-error' : ''}`}>
                  <label>
                    Standard <span className="req">*</span>
                  </label>
                  <select
                    ref={standardRef}
                    value={standardId}
                    onChange={(e) => onStandardChange(e.target.value)}
                  >
                    <option value="">Select standard</option>
                    {standards.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {formatXrfValue(s.purity, decimals)} · {formatXrfCarat(s.carat, decimals)} ct
                      </option>
                    ))}
                  </select>
                  {errors.standardId && <span className="field-error">{errors.standardId}</span>}
                </div>
                <div className={`field ${errors.purity ? 'has-error' : ''}`}>
                  <label>Purity / reference</label>
                  <input
                    type="number"
                    step={inputStep}
                    inputMode="decimal"
                    value={purity}
                    readOnly={!settings.allowManualPurity}
                    tabIndex={settings.allowManualPurity ? 0 : -1}
                    onChange={(e) => {
                      setPurity(e.target.value)
                      setErrors((er) => ({ ...er, purity: undefined }))
                    }}
                    placeholder="From standard master"
                  />
                  {errors.purity && <span className="field-error">{errors.purity}</span>}
                </div>
                <div className="field">
                  <label>Carat</label>
                  <input value={carat} readOnly tabIndex={-1} placeholder="From standard master" />
                </div>
                <div className={`field ${errors.reading1 ? 'has-error' : ''}`}>
                  <label>
                    Reading 1 <span className="req">*</span>
                  </label>
                  <input
                    ref={reading1Ref}
                    type="number"
                    step={inputStep}
                    inputMode="decimal"
                    value={reading1}
                    onChange={(e) => {
                      setReading1(e.target.value)
                      setErrors((er) => ({ ...er, reading1: undefined }))
                    }}
                    placeholder="XRF reading"
                    autoComplete="off"
                  />
                  {errors.reading1 && <span className="field-error">{errors.reading1}</span>}
                </div>
                <div className={`field ${errors.reading2 ? 'has-error' : ''}`}>
                  <label>
                    Reading 2 <span className="req">*</span>
                  </label>
                  <input
                    type="number"
                    step={inputStep}
                    inputMode="decimal"
                    value={reading2}
                    onChange={(e) => {
                      setReading2(e.target.value)
                      setErrors((er) => ({ ...er, reading2: undefined }))
                    }}
                    placeholder="XRF reading"
                    autoComplete="off"
                  />
                  {errors.reading2 && <span className="field-error">{errors.reading2}</span>}
                </div>
                <div className="field xrfstd-avg-field">
                  <label>Average</label>
                  <input
                    className="xrfstd-average"
                    value={average == null ? '' : formatXrfValue(average, decimals)}
                    readOnly
                    tabIndex={-1}
                    placeholder="(R1 + R2) / 2"
                  />
                </div>
              </div>

              <div className="form-actions xrfstd-actions">
                <button type="submit" className="btn btn-navy" disabled={!standards.length}>
                  {editingId ? 'Update check' : 'Save / Add'}
                </button>
                <button type="button" className="btn btn-reset" onClick={newEntry}>
                  <RefreshCw size={15} /> New entry
                </button>
              </div>
              {!standards.length && (
                <p className="field-hint">Add standards in Standard Master before recording checks.</p>
              )}
            </form>
          </section>

          <section className="exp-card xrfstd-card">
            <header className="exp-card-head">
              <div>
                <h2>Daily standard checks</h2>
                <p>Records for the selected date. Edit or delete as required.</p>
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
                    <th>Date</th>
                    <th>Time</th>
                    <th>Standard</th>
                    <th>Purity</th>
                    <th>Carat</th>
                    <th>Reading 1</th>
                    <th>Reading 2</th>
                    <th>Average</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No standard checks for this date.
                      </td>
                    </tr>
                  )}
                  {filtered.map((r) => (
                    <tr key={r.id} className={editingId === r.id ? 'xrfstd-row-editing' : undefined}>
                      <td>{formatXrfDateDisplay(r.date)}</td>
                      <td>{formatXrfTimeDisplay(r.time)}</td>
                      <td>{r.standardName || '—'}</td>
                      <td>{formatXrfValue(r.purity, decimals)}</td>
                      <td>{formatXrfCarat(r.carat, decimals)}</td>
                      <td>{formatXrfValue(r.reading1, decimals)}</td>
                      <td>{formatXrfValue(r.reading2, decimals)}</td>
                      <td>
                        <strong>{formatXrfValue(r.average, decimals)}</strong>
                      </td>
                      <td>
                        <div className="xrfstd-row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Edit"
                            onClick={() => startEdit(r)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Delete"
                            onClick={() => remove(r)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div className="xrfstd-master-layout">
          <section className="exp-card xrfstd-card">
            <header className="exp-card-head">
              <div className={`exp-card-icon ${masterEditingId ? 'green' : 'blue'}`}>
                {masterEditingId ? <Pencil size={18} /> : <Plus size={18} />}
              </div>
              <div>
                <h2>{masterEditingId ? 'Edit standard' : 'Add standard'}</h2>
                <p>Configured standards appear in the daily check dropdown.</p>
              </div>
            </header>

            <form className="xrfstd-form" onSubmit={submitMaster}>
              <div className="form-grid xrfstd-master-grid">
                <div className={`field ${masterErrors.name ? 'has-error' : ''}`}>
                  <label>
                    Standard name <span className="req">*</span>
                  </label>
                  <input
                    value={masterName}
                    onChange={(e) => {
                      setMasterName(e.target.value)
                      setMasterErrors((er) => ({ ...er, name: undefined }))
                    }}
                    placeholder="e.g. 22 ct"
                  />
                  {masterErrors.name && <span className="field-error">{masterErrors.name}</span>}
                </div>
                <div className={`field ${masterErrors.purity ? 'has-error' : ''}`}>
                  <label>
                    Purity / reference <span className="req">*</span>
                  </label>
                  <input
                    type="number"
                    step={inputStep}
                    inputMode="decimal"
                    value={masterPurity}
                    onChange={(e) => {
                      setMasterPurity(e.target.value)
                      setMasterErrors((er) => ({ ...er, purity: undefined }))
                    }}
                    placeholder="e.g. 918.1"
                  />
                  {masterErrors.purity && <span className="field-error">{masterErrors.purity}</span>}
                </div>
                <div className={`field ${masterErrors.carat ? 'has-error' : ''}`}>
                  <label>
                    Carat <span className="req">*</span>
                  </label>
                  <input
                    type="number"
                    step={inputStep}
                    inputMode="decimal"
                    value={masterCarat}
                    onChange={(e) => {
                      setMasterCarat(e.target.value)
                      setMasterErrors((er) => ({ ...er, carat: undefined }))
                    }}
                    placeholder="e.g. 22"
                  />
                  {masterErrors.carat && <span className="field-error">{masterErrors.carat}</span>}
                </div>
              </div>
              <div className="form-actions xrfstd-actions">
                <button type="submit" className="btn btn-navy">
                  {masterEditingId ? 'Update standard' : 'Save standard'}
                </button>
                {masterEditingId && (
                  <button
                    type="button"
                    className="btn btn-reset"
                    onClick={() => {
                      setMasterEditingId(null)
                      setMasterName('')
                      setMasterPurity('')
                      setMasterCarat('')
                      setMasterErrors({})
                    }}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="exp-card xrfstd-card">
            <header className="exp-card-head">
              <div>
                <h2>Standard master</h2>
                <p>{standards.length} standard{standards.length === 1 ? '' : 's'} configured.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={restoreDefaults}>
                Restore defaults
              </button>
            </header>

            <div className="xrfstd-flags">
              <label className="xrfstd-flag xrfstd-flag-select">
                <span>
                  Duplicate check rule
                  <small>Default is one check per standard per date. Can be changed later if needed.</small>
                </span>
                <select
                  value={settings.duplicateMode}
                  onChange={(e) => {
                    store.updateXrfStandardSettings({
                      duplicateMode: e.target.value as XrfDuplicateMode,
                    })
                    reload()
                  }}
                >
                  <option value="same-date">Same standard + date (once per day)</option>
                  <option value="same-date-time">Same standard + date + time</option>
                  <option value="none">Allow duplicates</option>
                </select>
              </label>
              <label className="xrfstd-flag xrfstd-flag-select">
                <span>
                  Value decimals
                  <small>Used for purity, readings, and average. Can be switched to 3 later without rewriting this screen.</small>
                </span>
                <select
                  value={String(settings.valueDecimals === 3 ? 3 : 1)}
                  onChange={(e) => {
                    store.updateXrfStandardSettings({ valueDecimals: Number(e.target.value) })
                    reload()
                  }}
                >
                  <option value="1">1 decimal</option>
                  <option value="3">3 decimals</option>
                </select>
              </label>
              <label className="xrfstd-flag">
                <input
                  type="checkbox"
                  checked={settings.allowManualPurity}
                  onChange={(e) => {
                    store.updateXrfStandardSettings({ allowManualPurity: e.target.checked })
                    reload()
                    if (!e.target.checked && selected) applyStandard(selected)
                  }}
                />
                <span>
                  Allow manual purity / reference edit on entry
                  <small>Leave off to always use the master value.</small>
                </span>
              </label>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Standard</th>
                    <th>Purity / reference</th>
                    <th>Carat</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {standards.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No standards yet — add one or restore defaults.
                      </td>
                    </tr>
                  )}
                  {standards.map((s, i) => (
                    <tr key={s.id} className={masterEditingId === s.id ? 'xrfstd-row-editing' : undefined}>
                      <td>{i + 1}</td>
                      <td>
                        <strong>{s.name}</strong>
                      </td>
                      <td>{formatXrfValue(s.purity, decimals)}</td>
                      <td>{formatXrfCarat(s.carat, decimals)}</td>
                      <td>
                        <div className="xrfstd-row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Edit"
                            onClick={() => startMasterEdit(s)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Delete"
                            onClick={() => removeMaster(s)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {Toast}
    </div>
  )
}
