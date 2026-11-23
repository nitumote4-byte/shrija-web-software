import { useEffect, useMemo, useRef, useState } from 'react'
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
  Search,
  Settings2,
  Star,
  Upload,
  Users,
} from 'lucide-react'
import { useToast } from '../components/ui'
import { calcPartyBalance, store, type Party } from '../data/store'
import { buildPartyBoard } from '../utils/partyInsight'
import { PartyDossier } from './PartyDossier'
import { normalizePartyGstin, validatePartyGstin } from '../utils/partyGstin'
import {
  PARTY_IMPORT_TEMPLATE_HEADER,
  PARTY_IMPORT_TEMPLATE_SAMPLE,
  parsePartyImportBytes,
} from '../utils/partyImport'

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

const FAV_KEY = 'shrija-party-favourites'

const AVATAR_TONES = [
  { bg: '#fde7d6', fg: '#c2410c' },
  { bg: '#dbeafe', fg: '#1d4ed8' },
  { bg: '#fef3c7', fg: '#a16207' },
  { bg: '#f3e8ff', fg: '#7e22ce' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#ffe4e6', fg: '#be123c' },
  { bg: '#e0f2fe', fg: '#0369a1' },
]

function readFavs(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeFavs(ids: string[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(ids))
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function toneFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length
  return AVATAR_TONES[hash]
}

function formatWhen(value: string) {
  if (!value) return ''
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function partyMatchesQuery(party: Party, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const digits = q.replace(/\D/g, '')
  const phone = party.phone.replace(/\D/g, '')
  return (
    party.name.toLowerCase().includes(q) ||
    party.phone.toLowerCase().includes(q) ||
    (digits.length >= 3 && phone.includes(digits)) ||
    party.licenseNo.toLowerCase().includes(q) ||
    party.address.toLowerCase().includes(q) ||
    party.gstin.toLowerCase().includes(q) ||
    party.state.toLowerCase().includes(q)
  )
}

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

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
  const formRef = useRef<HTMLFormElement>(null)
  const [tick, setTick] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [stateOpen, setStateOpen] = useState(false)
  const [importFile, setImportFile] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'all' | 'fav' | 'credit'>('all')
  const [selectedId, setSelectedId] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [favs, setFavs] = useState<string[]>(() => readFavs())
  void tick

  const data = store.getAll()
  const parties = data.parties
  const groups = useMemo(
    () => [...new Set(parties.map((p) => p.groupName).filter(Boolean))],
    [parties],
  )

  const favSet = useMemo(() => new Set(favs), [favs])

  const quickParties = useMemo(() => {
    const ordered = [
      ...parties.filter((p) => favSet.has(p.id)),
      ...parties.filter((p) => !favSet.has(p.id)),
    ]
    return ordered.slice(0, 4)
  }, [parties, favSet])

  const matches = useMemo(
    () => parties.filter((p) => partyMatchesQuery(p, query)),
    [parties, query],
  )

  const visibleParties = useMemo(() => {
    return matches.filter((p) => {
      if (tab === 'fav' && !favSet.has(p.id)) return false
      if (tab === 'credit' && p.transactionType !== 'Credit') return false
      return true
    })
  }, [matches, tab, favSet])

  const board = useMemo(
    () => buildPartyBoard(parties, data.requests, data.invoices, data.funds),
    [parties, data.requests, data.invoices, data.funds],
  )

  const focusParty = query.trim()
    ? matches.find((p) => p.id === selectedId) || matches[0] || null
    : parties.find((p) => p.id === selectedId) || null
  const insight = focusParty ? board.insights.get(focusParty.id) : undefined
  const outstanding = focusParty ? calcPartyBalance(data.invoices, data.funds, focusParty.name) : 0

  const lastJobLabel = (party: Party) => {
    const dates = [
      ...data.requests
        .filter((r) => r.partyId === party.id || r.partyName === party.name)
        .map((r) => r.date),
      ...data.invoices
        .filter((inv) => inv.partyId === party.id || inv.partyName === party.name)
        .map((inv) => inv.date),
    ].filter(Boolean)
    dates.sort()
    const latest = dates[dates.length - 1]
    return latest ? `Last job · ${formatWhen(latest)}` : 'No jobs yet'
  }

  const toggleFav = (id: string) => {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      writeFavs(next)
      return next
    })
  }

  const openParty = (id: string) => {
    setSelectedId(id)
    setSearchOpen(false)
  }

  const openForm = () => setShowForm(true)

  useEffect(() => {
    if (!showForm) return
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showForm])

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
    const gstinError = validatePartyGstin(form.gstin)
    if (gstinError) {
      toast(gstinError)
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
      gstin: normalizePartyGstin(form.gstin),
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
    setShowForm(false)
  }

  const importData = () => {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast('Choose a CSV/Excel file first')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const buffer = reader.result
      if (!(buffer instanceof ArrayBuffer)) {
        toast('Could not read file')
        return
      }

      const parsed = parsePartyImportBytes(new Uint8Array(buffer), INDIAN_STATES)
      if (parsed.error) {
        toast(parsed.error)
        return
      }

      let imported = 0
      for (const row of parsed.rows) {
        store.addParty({ ...row })
        imported += 1
      }

      setTick((t) => t + 1)
      setImportFile('')
      if (fileRef.current) fileRef.current.value = ''
      if (!imported) {
        toast('No valid rows found')
        return
      }
      const skipped = parsed.skipped ? `, ${parsed.skipped} skipped` : ''
      toast(`${imported} part(ies) imported${skipped}`)
    }
    reader.readAsArrayBuffer(file)
  }

  const downloadTemplate = () => {
    const csv = [PARTY_IMPORT_TEMPLATE_HEADER, PARTY_IMPORT_TEMPLATE_SAMPLE].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'party-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedTone = focusParty ? toneFor(focusParty.name) : AVATAR_TONES[0]

  return (
    <div className="add-party-page">
      <header className="party-board-head">
        <div>
          <h1>Parties</h1>
          <p>The jewellers and businesses you bill the most, one tap away.</p>
        </div>
        <button type="button" className="party-add-btn" onClick={openForm}>
          <Plus size={16} /> Add party
        </button>
      </header>

      <div className="party-find">
        <label className="party-search-box party-search-lg">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 160)}
            placeholder="Search name, mobile, licence or address"
            aria-label="Search party by name, mobile, licence or address"
          />
        </label>
        {searchOpen && query.trim() && (
          <div className="party-find-list">
            {matches.length === 0 ? (
              <p>No party found for “{query.trim()}”.</p>
            ) : (
              matches.slice(0, 8).map((p) => (
                <button key={p.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => openParty(p.id)}>
                  <strong>{p.name}</strong>
                  <span>
                    {p.phone || 'No mobile'}
                    {p.licenseNo ? ` · ${p.licenseNo}` : ''}
                    {p.address ? ` · ${p.address}` : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {focusParty && insight && (
        <PartyDossier
          party={focusParty}
          insight={insight}
          ranks={board.ranks}
          initials={initials(focusParty.name)}
          tone={toneFor(focusParty.name)}
          onOpen={openParty}
        />
      )}

      <section className="party-quick">
        <div className="party-quick-pick">
          <h2>Quick open</h2>
          <p>Pick a favourite. Balance and details, one tap away.</p>
          <div className="party-avatar-row">
            {quickParties.map((p) => {
              const tone = toneFor(p.name)
              const active = focusParty?.id === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`party-avatar-btn ${active ? 'is-active' : ''}`}
                  onClick={() => openParty(p.id)}
                >
                  <span className="party-avatar" style={{ background: tone.bg, color: tone.fg }}>
                    {initials(p.name)}
                  </span>
                  <span>{p.name.split(' ')[0]}</span>
                </button>
              )
            })}
            <button type="button" className="party-avatar-btn" onClick={openForm}>
              <span className="party-avatar party-avatar-new">
                <Plus size={18} />
              </span>
              <span>New</span>
            </button>
          </div>
        </div>

        <div className="party-quick-card">
          {focusParty ? (
            <>
              <div className="party-quick-who">
                <span
                  className="party-avatar party-avatar-lg"
                  style={{ background: selectedTone.bg, color: selectedTone.fg }}
                >
                  {initials(focusParty.name)}
                </span>
                <div>
                  <strong>{focusParty.name}</strong>
                  <span>{focusParty.phone || 'No phone'}</span>
                </div>
                <button
                  type="button"
                  className={`party-star ${favSet.has(focusParty.id) ? 'is-on' : ''}`}
                  aria-label={favSet.has(focusParty.id) ? 'Remove favourite' : 'Mark favourite'}
                  onClick={() => toggleFav(focusParty.id)}
                >
                  <Star size={16} fill={favSet.has(focusParty.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="party-quick-amount">
                <strong>{formatInr(Math.abs(outstanding))}</strong>
                <span>{outstanding < 0 ? 'Advance' : 'Outstanding'}</span>
              </div>
              <div className="party-chip-row">
                <span className="party-chip is-on">{focusParty.transactionType}</span>
                <span className="party-chip">{focusParty.state || 'State —'}</span>
                <span className="party-chip">{focusParty.licenseNo || 'No licence'}</span>
              </div>
              <Link className="party-send-btn" to="/reports/party-statement">
                Open statement
              </Link>
            </>
          ) : (
            <div className="party-quick-empty">
              <strong>{parties.length === 0 ? 'No parties yet' : 'Search a party'}</strong>
              <span>
                {parties.length === 0
                  ? 'Add the first jeweller to start billing.'
                  : 'Name, mobile, licence or address. Full profile opens on this screen.'}
              </span>
              {parties.length === 0 && (
                <button type="button" className="party-send-btn" onClick={openForm}>
                  Add party
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="party-board-tools">
        <div className="party-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'all'}
            className={tab === 'all' ? 'is-on' : ''}
            onClick={() => setTab('all')}
          >
            <Users size={14} /> All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'fav'}
            className={tab === 'fav' ? 'is-on' : ''}
            onClick={() => setTab('fav')}
          >
            <Star size={14} /> Favourites
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'credit'}
            className={tab === 'credit' ? 'is-on' : ''}
            onClick={() => setTab('credit')}
          >
            <Building2 size={14} /> Credit
          </button>
        </div>
      </div>

      {visibleParties.length === 0 ? (
        <div className="party-empty">
          {parties.length === 0
            ? 'No parties registered yet.'
            : 'No parties match this filter.'}
        </div>
      ) : (
        <div className="party-card-grid">
          {visibleParties.map((p) => {
            const tone = toneFor(p.name)
            const active = focusParty?.id === p.id
            return (
              <article
                key={p.id}
                className={`party-contact-card ${active ? 'is-active' : ''}`}
                onClick={() => openParty(p.id)}
              >
                <span
                  className="party-avatar"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  {initials(p.name)}
                </span>
                <button
                  type="button"
                  className={`party-star party-card-star ${favSet.has(p.id) ? 'is-on' : ''}`}
                  aria-pressed={favSet.has(p.id)}
                  aria-label={favSet.has(p.id) ? 'Remove favourite' : 'Mark favourite'}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFav(p.id)
                  }}
                >
                  <Star size={14} fill={favSet.has(p.id) ? 'currentColor' : 'none'} />
                </button>
                <strong>{p.name}</strong>
                <span className="party-card-phone">{p.phone || 'No phone'}</span>
                <span className={`party-kind party-kind-${p.transactionType.toLowerCase()}`}>
                  {p.transactionType}
                </span>
                <span className="party-card-meta">
                  {p.gstin ? `GST · ${p.gstin.slice(-4)}` : p.licenseNo || 'No GST'}
                </span>
                <span className="party-card-when">
                  #{board.insights.get(p.id)?.rankByJobs ?? '—'} by work · {lastJobLabel(p)}
                </span>
              </article>
            )
          })}
        </div>
      )}

      {showForm && (
      <>
      <form ref={formRef} className="panel party-form-card" onSubmit={submit}>
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
              <label>GST Number</label>
              <IconInput
                icon={IdCard}
                placeholder="22AAAAA0000A1Z5"
                value={form.gstin}
                maxLength={15}
                onChange={(e) => set('gstin', e.target.value.toUpperCase())}
              />
              <small className="field-hint">
                Optional. If entered, must be a 15-digit GST identification number
              </small>
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
          <button type="button" className="btn btn-back" onClick={() => setShowForm(false)}>
            <ArrowLeft size={16} /> Close
          </button>
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
            CSV / TSV / Excel HTML. Columns match by header name (Party Name, GSTNO, CMI
            NO…). Save .xlsx as CSV UTF-8 from Excel before importing.{' '}
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
      </>
      )}

      {Toast}
    </div>
  )
}
