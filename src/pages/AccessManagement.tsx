import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  KeyRound,
  Lock,
  Monitor,
  Pencil,
  Plus,
  Save,
  Trash2,
  User,
} from 'lucide-react'
import { useToast } from '../components/ui'
import { loadAccessUsers, saveAccessUsers } from '../data/auth'
import { getCentres } from '../data/firmProfile'
import { tenantGet, tenantSet } from '../data/tenant'

type AppUser = {
  id: string
  username: string
  role: string
  password: string
  centreId: string
}

type ReceptionCreds = {
  username: string
  password: string
  macAddresses: string
}

const RECEPTION_KEY = 'shrija-reception-creds'

const ROLE_OPTIONS = [
  { value: 'quality_manager', label: 'Quality Manager (full)' },
  { value: 'assay_lab', label: 'In Lab (Fire Assay + Stock only)' },
  { value: 'in_lab', label: 'In Lab (alias)' },
  { value: 'reception', label: 'Reception (all except Lab)' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'admin', label: 'Admin' },
]

async function persistUsers(users: AppUser[]) {
  await saveAccessUsers(
    users.map((u) => ({
      username: u.username,
      role: u.role,
      password: u.password,
      centreId: u.centreId || 'main',
    })),
  )
}

function loadReception(): ReceptionCreds {
  try {
    const raw = tenantGet(RECEPTION_KEY)
    if (raw) return JSON.parse(raw) as ReceptionCreds
  } catch {
    /* ignore */
  }
  return {
    username: 'mgsachin1',
    password: '********',
    macAddresses: '28-D0-43-20-E8-D6',
  }
}

export function ManagePassword() {
  const { toast, Toast } = useToast()
  const [users, setUsers] = useState<AppUser[]>([])
  const [reception, setReception] = useState<ReceptionCreds>(loadReception)
  const [storedReception, setStoredReception] = useState<ReceptionCreds>(loadReception)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    username: '',
    role: 'quality_manager',
    password: '',
    centreId: 'main',
  })
  const [showInstructions, setShowInstructions] = useState(false)
  const centres = getCentres()

  useEffect(() => {
    setStoredReception(loadReception())
    void loadAccessUsers()
      .then((list) =>
        setUsers(
          list.map((u, i) => ({
            id: `u-${i}-${u.username}`,
            username: u.username,
            role: u.role,
            password: u.password,
            centreId: u.centreId || 'main',
          })),
        ),
      )
      .catch(() => toast('Failed to load users from server'))
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ username: '', role: 'reception', password: '', centreId: 'main' })
    setShowCreate(true)
  }

  const openEdit = (user: AppUser) => {
    setEditingId(user.id)
    setForm({
      username: user.username,
      role: user.role,
      password: '',
      centreId: user.centreId || 'main',
    })
    setShowCreate(true)
  }

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.username.trim()) {
      toast('Username is required')
      return
    }
    if (!editingId && !form.password.trim()) {
      toast('Password is required for new users')
      return
    }

    const centreId = form.centreId || 'main'
    const centre = centres.find((c) => c.id === centreId)
    // OSC outlet users should not be In Lab roles
    if (centre?.kind === 'osc' && /assay_lab|in_lab|inlab/.test(form.role)) {
      toast('Off-Site users cannot be In Lab — lab stays at Main Centre')
      return
    }

    let next: AppUser[]
    if (editingId) {
      next = users.map((u) =>
        u.id === editingId
          ? {
              ...u,
              username: form.username.trim(),
              role: form.role,
              password: form.password.trim() || u.password,
              centreId,
            }
          : u,
      )
    } else {
      next = [
        {
          id: `u-${Date.now()}`,
          username: form.username.trim(),
          role: form.role,
          password: form.password,
          centreId,
        },
        ...users,
      ]
    }
    try {
      await persistUsers(next)
      setUsers(next)
      toast(editingId ? 'User updated' : 'User created')
      setShowCreate(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save user')
    }
  }

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user?')) return
    const next = users.filter((u) => u.id !== id)
    try {
      await persistUsers(next)
      setUsers(next)
      toast('User deleted')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const saveReception = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reception.username.trim()) {
      toast('Reception username is required')
      return
    }
    tenantSet(RECEPTION_KEY, JSON.stringify(reception))
    setStoredReception({ ...reception })
    toast('Reception credentials saved')
  }

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast(`${filename} downloaded`)
  }

  const downloadExeNote = () => {
    downloadFile(
      'Shrija-AutoTool-Setup.txt',
      [
        'SHRIJA ASSAYING & HALLMARKING CENTRE',
        'Auto Tool Setup (demo package)',
        '',
        '1. Run the installer on the reception desktop PC.',
        '2. Register the protocol file (.reg) as Administrator.',
        '3. Ensure MAC address matches Reception Credentials.',
        '4. Restart browser after protocol registration.',
        '',
        'Note: This demo downloads a setup instruction file.',
        'Replace with your real .exe distribution in production.',
      ].join('\n'),
      'text/plain',
    )
  }

  const downloadReg = () => {
    downloadFile(
      'shrija-autotool-protocol.reg',
      [
        'Windows Registry Editor Version 5.00',
        '',
        '[HKEY_CLASSES_ROOT\\shrijaautotool]',
        '@="URL:Shrija Auto Tool Protocol"',
        '"URL Protocol"=""',
        '',
        '[HKEY_CLASSES_ROOT\\shrijaautotool\\shell\\open\\command]',
        '@="\\"%ProgramFiles%\\\\ShrijaAutoTool\\\\tool.exe\\" \\"%1\\""',
        '',
      ].join('\r\n'),
      'application/octet-stream',
    )
  }

  return (
    <div className="access-page">
      <Link to="/others" className="back-link">
        <ArrowLeft size={16} /> Back to Others
      </Link>

      <div className="page-header">
        <div>
          <h1>Access Management</h1>
          <p>Manage credentials and application users.</p>
        </div>
      </div>

      {/* Active Users */}
      <div className="panel access-card">
        <div className="access-card-head">
          <div>
            <h2>Active Users</h2>
            <p>System Access List</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Create User
          </button>
        </div>

        <div className="table-wrap">
          <table className="data-table access-users-table">
            <thead>
              <tr>
                <th>USER</th>
                <th>ROLE</th>
                <th>CENTRE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="access-user-cell">
                      <div className="user-avatar small">{u.username.slice(0, 2).toUpperCase()}</div>
                      <strong>{u.username}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="role-badge">{u.role}</span>
                  </td>
                  <td>
                    <span className="role-badge">
                      {centres.find((c) => c.id === u.centreId)?.name ||
                        (u.centreId === 'main' ? 'Main' : u.centreId)}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="action-sq edit"
                      title="Edit"
                      onClick={() => openEdit(u)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="action-sq delete"
                      title="Delete"
                      onClick={() => deleteUser(u.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="access-bottom-grid">
        {/* Reception Credentials */}
        <div className="panel access-card">
          <div className="access-card-head compact">
            <div className="access-title-with-icon">
              <span className="access-icon blue">
                <KeyRound size={18} />
              </span>
              <div>
                <h2>Reception Credentials</h2>
                <p>For Desk Login</p>
              </div>
            </div>
          </div>

          <form onSubmit={saveReception} className="reception-form">
            <div className="field">
              <label>Username</label>
              <div className="icon-input">
                <User size={16} className="icon-input-glyph" />
                <input
                  value={reception.username}
                  onChange={(e) => setReception((p) => ({ ...p, username: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label>Password</label>
              <div className="icon-input">
                <Lock size={16} className="icon-input-glyph" />
                <input
                  type="password"
                  value={reception.password}
                  onChange={(e) => setReception((p) => ({ ...p, password: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label>MAC Address(es)</label>
              <input
                value={reception.macAddresses}
                onChange={(e) => setReception((p) => ({ ...p, macAddresses: e.target.value }))}
                placeholder="28-D0-43-20-E8-D6"
              />
              <small className="field-hint">Separate multiple MACs with commas.</small>
            </div>
            <button type="submit" className="btn btn-primary reception-save">
              <Save size={16} /> Save Credentials
            </button>
          </form>

          <div className="stored-creds">
            <strong>STORED FOR THIS CENTER</strong>
            <div>
              Username: <span>{storedReception.username || '—'}</span>
            </div>
            <div>
              MAC Address(es): <span>{storedReception.macAddresses || '—'}</span>
            </div>
          </div>
        </div>

        {/* Auto Tool Setup */}
        <div className="panel access-card">
          <div className="access-card-head compact">
            <div className="access-title-with-icon">
              <span className="access-icon yellow">
                <Monitor size={18} />
              </span>
              <div>
                <h2>Auto Tool Setup</h2>
                <p>Install setup tool on desktop</p>
              </div>
            </div>
            <button
              type="button"
              className="btn-instructions"
              onClick={() => setShowInstructions((v) => !v)}
            >
              Instructions Note
            </button>
          </div>

          {showInstructions && (
            <div className="instructions-box">
              Download and install the Auto Tool on the reception PC, then register the protocol
              file. Match the PC MAC address in Reception Credentials for desk login security.
            </div>
          )}

          <div className="auto-tool-actions">
            <button type="button" className="btn btn-download-exe" onClick={downloadExeNote}>
              <Download size={18} /> Download Tool (.exe)
            </button>
            <button type="button" className="btn btn-download-reg" onClick={downloadReg}>
              <Download size={18} /> Download Protocol (.reg)
            </button>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? 'Edit User' : 'Create User'}</h3>
            <form onSubmit={saveUser}>
              <div className="field">
                <label>Username</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Centre / Outlet</label>
                <select
                  value={form.centreId}
                  onChange={(e) => setForm((p) => ({ ...p, centreId: e.target.value }))}
                >
                  {centres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.kind === 'osc' ? `OSC · ${c.name}` : `Main · ${c.name}`}
                    </option>
                  ))}
                </select>
                <small className="field-hint">
                  OSC users: no lab access. Lab records stay on Main Centre.
                </small>
              </div>
              <div className="field">
                <label>{editingId ? 'New Password (optional)' : 'Password'}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  required={!editingId}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {Toast}
    </div>
  )
}
