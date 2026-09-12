import { useId, useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { changeOwnPassword, getSession, setSession } from '../data/auth'
import { MIN_PASSWORD_LENGTH, passwordPolicyError } from '../utils/passwordPolicy'

type Props = {
  toast: (msg: string) => void
  onSuccess?: () => void
  forced?: boolean
}

export function ChangePasswordForm({ toast, onSuccess, forced }: Props) {
  const formId = useId()
  const session = getSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const policyErr = passwordPolicyError(newPassword, session?.username)
    if (policyErr) {
      setError(policyErr)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from the current password.')
      return
    }
    setBusy(true)
    try {
      const res = await changeOwnPassword(currentPassword, newPassword)
      const next = getSession()
      if (next) setSession({ ...next, mustChangePassword: false })
      toast(res.message || 'Password updated')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel change-password-panel" id="change-password">
      <h2>
        <KeyRound size={18} aria-hidden style={{ verticalAlign: 'middle', marginRight: 8 }} />
        {forced ? 'Set a new password' : 'Change Password'}
      </h2>
      <p className="auto-manak-hint">
        {forced
          ? 'This login requires a new password before you can open centre data.'
          : `Updates the password for ${session?.username || 'this account'} only. Other users are not affected.`}
      </p>
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
      <form className="form-grid" onSubmit={(e) => void submit(e)}>
        <div className="field">
          <label htmlFor={`${formId}-current`}>Current Password</label>
          <input
            id={`${formId}-current`}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-new`}>New Password</label>
          <input
            id={`${formId}-new`}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-confirm`}>Confirm New Password</label>
          <input
            id={`${formId}-confirm`}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>
        <p className="auto-manak-hint">At least {MIN_PASSWORD_LENGTH} characters. Do not reuse a shared default.</p>
        <div className="auto-manak-actions">
          <button type="submit" className="btn btn-navy" disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <Loader2 size={16} className="centres-spin" aria-hidden /> Updating…
              </>
            ) : (
              'Change Password'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

