import { Link } from 'react-router-dom'
import { KeyRound, Users } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { getSession } from '../data/auth'
import { getActiveCentre, getFirmName } from '../data/firmProfile'
import { canAccessPath, roleLabel } from '../data/roles'

export function AccountSettingsPage() {
  const session = getSession()
  const centre = getActiveCentre()
  const centreName = session?.centreName || centre.name || getFirmName()
  const firmName = session?.tenantName || getFirmName()
  const canManageUsers = canAccessPath('/others/manage-password')

  return (
    <div className="account-settings-page">
      <PageHeader
        title="Account Settings"
        subtitle="This is your own login. Other users and their access stay in Access Management."
      />

      <div className="panel">
        <h2>Signed-in account</h2>
        <div className="stats-row">
          <div className="stat-card">
            <span>Username</span>
            <strong>{session?.username || '—'}</strong>
          </div>
          <div className="stat-card">
            <span>Role</span>
            <strong>{roleLabel(session?.role || '') || '—'}</strong>
          </div>
          <div className="stat-card">
            <span>Centre</span>
            <strong>{centreName || '—'}</strong>
          </div>
          <div className="stat-card">
            <span>Firm</span>
            <strong>{firmName || '—'}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
          <Link to="/change-password" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            <KeyRound size={16} /> Change Password
          </Link>
          {canManageUsers && (
            <Link to="/others/manage-password" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              <Users size={16} /> Access Management
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
