import { useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import { useToast } from '../components/ui'
import { getSession } from '../data/auth'
import { PRODUCT_NAME } from '../data/modules'
import { hydrateTenantData } from '../data/tenantCache'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const { toast, Toast } = useToast()
  const session = getSession()
  const forced = Boolean(session?.mustChangePassword)

  return (
    <div className="login-page">
      <aside className="login-brand">
        <div className="login-brand-inner">
          <p className="login-product">{PRODUCT_NAME}</p>
          <div className="login-logo" aria-hidden>
            <BrandLogo size={112} />
          </div>
          <h1>{forced ? 'Change your password' : 'Account password'}</h1>
          <p className="login-tagline">
            {forced
              ? 'Set a new password before using this centre.'
              : 'Update the password for your own login.'}
          </p>
        </div>
      </aside>
      <main className="login-form-side">
        <div className="login-form-card">
          <ChangePasswordForm
            toast={toast}
            forced={forced}
            onSuccess={() => {
              if (forced) {
                void hydrateTenantData()
                  .catch(() => undefined)
                  .finally(() => window.location.assign('/'))
                return
              }
              navigate('/', { replace: true })
            }}
          />
        </div>
        {Toast}
      </main>
    </div>
  )
}
