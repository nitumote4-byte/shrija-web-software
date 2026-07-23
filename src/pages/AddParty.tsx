import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Contact,
  FileSpreadsheet,
  FileText,
  Globe2,
  Hash,
  IdCard,
  MapPin,
  Phone,
  Plus,
  Settings2,
  Upload,
  Users,
} from 'lucide-react'
import { useToast } from '../components/ui'
import { store, type Party } from '../data/store'

const INDIAN_STATES: { name: string; code: string }[] = [
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Delhi', code: '07' },
  { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' },
  { name: 'Haryana', code: '06' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Karnataka', code: '29' },
  { name: 'Kerala', code: '32' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Manipur', code: '14' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Mizoram', code: '15' },
  { name: 'Nagaland', code: '13' },
  { name: 'Odisha', code: '21' },
  { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Sikkim', code: '11' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Tripura', code: '16' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'West Bengal', code: '19' },
]

const emptyForm = {
  name: '',
  address: '',
  phone: '',
  transactionType: 'Cash' as Party['transactionType'],
  gstin: '',
  licenseNo: '',
  state: '',
  stateCode: '',
  groupName: '',
  skipMinBill: false,
  skipRejectedPics: true,
  skipCutting: true,
  igstApplicable: false,
}

function IconInput({
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ComponentType<{ size?: number; className?: string }>
}) {
  return (
    <div className="icon-input">
      <Icon size={16} className="icon-input-glyph" />
      <input {...props} />
    </div>
  )
}

export function AddParty() {
  const { toast, Toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tick, setTick] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [stateOpen, setStateOpen] = useState(false)
  const [importFile, setImportFile] = useState('')
  void tick

  const parties = store.getAll().parties
  const groups = useMemo(
    () => [...new Set(parties.map((p) => p.groupName).filter(Boolean))],
    [parties],
  )

  const stateMatches = useMemo(() => {
    const q = form.state.trim().toLowerCase()
    if (!q) return INDIAN_STATES
    return INDIAN_STATES.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.includes(q),
    )
  }, [form.state])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const pickState = (name: string, code: string) => {
    setForm((prev) => ({ ...prev, state: name, stateCode: code }))
    setStateOpen(false)
  }

  const resetForm = () => setForm(emptyForm)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.address.trim()) {
      toast('Party Name and Address are required')
      return
    }
    if (!form.gstin.trim() || form.gstin.trim().length !== 15) {
      toast('Enter a valid 15-digit GST Number')
      return
    }
    if (!form.licenseNo.trim()) {
      toast('License Number is required')
      return
    }
    if (!form.state || !form.stateCode) {
      toast('Please select a State')
      return
    }

    store.addParty({
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      gstin: form.gstin.trim().toUpperCase(),
      transactionType: form.transactionType,
      licenseNo: form.licenseNo.trim(),
      state: form.state,
      stateCode: form.stateCode,
      groupName: form.groupName,
      skipMinBill: form.skipMinBill,
      skipRejectedPics: form.skipRejectedPics,
      skipCutting: form.skipCutting,
      igstApplicable: form.igstApplicable,
      discount: 0,
      minBillCalc: false,
    })

    setTick((t) => t + 1)
    toast(`${form.name} added successfully`)
    resetForm()
  }

  const importData = () => {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast('Choose a CSV/Excel file first')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      if (lines.length < 2) {
        toast('File has no data rows')
        return
      }

      let imported = 0
      for (const line of lines.slice(1)) {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        const [name, address, phone, gstin, licenseNo, stateName, txn] = cols
        if (!name || !address) continue
        const state = INDIAN_STATES.find(
          (s) => s.name.toLowerCase() === (stateName ?? '').toLowerCase(),
        )
        store.addParty({
          name,
          address,
          phone: phone ?? '',
          gstin: (gstin ?? '').toUpperCase(),
          licenseNo: licenseNo ?? '',
          state: state?.name ?? stateName ?? '',
          stateCode: state?.code ?? '',
          transactionType:
            txn === 'Credit' || txn === 'Bank' ? txn : 'Cash',
          groupName: '',
          skipMinBill: false,
          skipRejectedPics: true,
          skipCutting: true,
          igstApplicable: false,
          discount: 0,
          minBillCalc: false,
        })
        imported += 1
      }

      setTick((t) => t + 1)
      setImportFile('')
      if (fileRef.current) fileRef.current.value = ''
      toast(imported ? `${imported} part(ies) imported` : 'No valid rows found')
    }
    reader.readAsText(file)
  }

  const downloadTemplate = () => {
    const csv = [
      'Party Name,Address,Contact No,GST Number,License Number,State,Transaction Type',
      'Demo Jewellers,MG Road Pune,9876543210,27AAAAA0000A1Z5,LIC-2001,Maharashtra,Cash',
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'party-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="add-party-page">
      <form className="panel party-form-card" onSubmit={submit}>
        <div className="party-form-head">
          <div className="party-form-head-icon">
            <Contact size={22} />
          </div>
          <div>
            <h1>Party Information</h1>
            <p>Register a new jeweller party in the system.</p>
          </div>
        </div>

        <section className="party-section">
          <div className="party-section-title">
            <span className="sec-icon sec-blue">
              <Users size={16} />
            </span>
            Basic Details
          </div>
          <div className="party-grid">
            <div className="field">
              <label>
                Party Name <span className="req">*</span>
              </label>
              <IconInput
                icon={IdCard}
                placeholder="Enter Party Name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>
                Address <span className="req">*</span>
              </label>
              <IconInput
                icon={MapPin}
                placeholder="Enter Complete Address"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Contact No</label>
              <IconInput
                icon={Phone}
                placeholder="Enter Contact Number"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
            <div className="field">
              <label>
                Transaction Type <span className="req">*</span>
              </label>
              <div className="icon-input">
                <Building2 size={16} className="icon-input-glyph" />
                <select
                  value={form.transactionType}
                  onChange={(e) =>
                    set('transactionType', e.target.value as Party['transactionType'])
                  }
                  required
                >
                  <option value="Cash">Cash</option>
                  <option value="Credit">Credit</option>
                  <option value="Bank">Bank</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="party-section">
          <div className="party-section-title">
            <span className="sec-icon sec-teal">
              <FileText size={16} />
            </span>
            Tax & Legal Information
          </div>
          <div className="party-grid">
            <div className="field">
              <label>
                GST Number <span className="req">*</span>
              </label>
              <IconInput
                icon={IdCard}
                placeholder="22AAAAA0000A1Z5"
                value={form.gstin}
                maxLength={15}
                onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                required
              />
              <small className="field-hint">Enter 15-digit GST identification number</small>
            </div>
            <div className="field">
              <label>
                License Number <span className="req">*</span>
              </label>
              <IconInput
                icon={FileText}
                placeholder="Enter License Number"
                value={form.licenseNo}
                onChange={(e) => set('licenseNo', e.target.value)}
                required
              />
            </div>
          </div>
        </section>

        <section className="party-section">
          <div className="party-section-title">
            <span className="sec-icon sec-green">
              <MapPin size={16} />
            </span>
            Location Details
          </div>
          <div className="party-grid">
            <div className="field">
              <label>
                State <span className="req">*</span>
              </label>
              <div className="party-search">
                <div className="icon-input">
                  <Globe2 size={16} className="icon-input-glyph" />
                  <input
                    placeholder="Select or Type State"
                    value={form.state}
                    onChange={(e) => {
                      set('state', e.target.value)
                      set('stateCode', '')
                      setStateOpen(true)
                    }}
                    onFocus={() => setStateOpen(true)}
                    onBlur={() => setTimeout(() => setStateOpen(false), 150)}
                    autoComplete="off"
                    required
                  />
                </div>
                {stateOpen && (
                  <div className="party-dropdown">
                    {stateMatches.map((s) => (
                      <button
                        key={s.code + s.name}
                        type="button"
                        className="party-option"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickState(s.name, s.code)}
                      >
                        <strong>{s.name}</strong>
                        <span>Code {s.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="field">
              <label>
                State Code <span className="req">*</span>
              </label>
              <IconInput
                icon={Hash}
                placeholder="Auto-filled"
                value={form.stateCode}
                readOnly
              />
              <small className="field-hint">Automatically filled based on state selection</small>
            </div>
          </div>
        </section>

        <section className="party-section">
          <div className="party-section-title">
            <span className="sec-icon sec-purple">
              <Users size={16} />
            </span>
            Group Membership
          </div>
          <div className="party-grid">
            <div className="field">
              <label>Join Existing Group</label>
              <select
                value={form.groupName}
                onChange={(e) => set('groupName', e.target.value)}
              >
                <option value="">No Groups Found</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value="Main Group">Main Group</option>
                <option value="Wholesale">Wholesale</option>
              </select>
              <small className="field-hint">
                Select a group to link this party with an existing group leader
              </small>
            </div>
          </div>
        </section>

        <section className="party-section">
          <div className="party-section-title">
            <span className="sec-icon sec-violet">
              <Settings2 size={16} />
            </span>
            Billing Preferences
          </div>
          <div className="billing-prefs">
            <label className={`pref-tile ${form.skipMinBill ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={form.skipMinBill}
                onChange={(e) => set('skipMinBill', e.target.checked)}
              />
              <span>Skip Minimum Bill Charges</span>
            </label>
            <label className={`pref-tile ${form.skipRejectedPics ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={form.skipRejectedPics}
                onChange={(e) => set('skipRejectedPics', e.target.checked)}
              />
              <span>Skip Rejected Pictures Charges</span>
            </label>
            <label className={`pref-tile ${form.skipCutting ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={form.skipCutting}
                onChange={(e) => set('skipCutting', e.target.checked)}
              />
              <span>Skip Cutting Charges</span>
            </label>
            <label className="pref-tile disabled">
              <input type="checkbox" checked={form.igstApplicable} disabled />
              <span>
                IGST Applicable <em className="auto-badge">Auto</em>
              </span>
            </label>
          </div>
        </section>

        <div className="party-form-actions">
          <Link to="/" className="btn btn-back">
            <ArrowLeft size={16} /> Back
          </Link>
          <button type="submit" className="btn btn-primary btn-add-party">
            <Plus size={16} /> Add Party
          </button>
        </div>
      </form>

      <div className="panel import-card">
        <div className="party-section-title">
          <span className="sec-icon sec-green">
            <FileSpreadsheet size={16} />
          </span>
          Import from Excel
        </div>
        <div className="field">
          <label>Upload CSV/Excel File</label>
          <div className="ahc-box">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.xls,.xlsx,text/csv"
              className="ahc-file-input"
              onChange={(e) => setImportFile(e.target.files?.[0]?.name ?? '')}
            />
            <button
              type="button"
              className="btn btn-secondary ahc-choose"
              onClick={() => fileRef.current?.click()}
            >
              Choose File
            </button>
            <input type="text" readOnly className="ahc-filename" value={importFile} />
          </div>
          <small className="field-hint">
            Supported formats: CSV, TSV, XLS (Text-based).{' '}
            <button type="button" className="link-btn" onClick={downloadTemplate}>
              Download Excel Template (with example)
            </button>
          </small>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={importData}>
            <Upload size={16} /> Import Data
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Registered Parties ({parties.length})</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>GST</th>
                <th>State</th>
                <th>Txn</th>
                <th>License</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.phone || '—'}</td>
                  <td>{p.gstin || '—'}</td>
                  <td>
                    {p.state || '—'}
                    {p.stateCode ? ` (${p.stateCode})` : ''}
                  </td>
                  <td>{p.transactionType}</td>
                  <td>{p.licenseNo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {Toast}
    </div>
  )
}
