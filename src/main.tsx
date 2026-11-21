import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'
import { TenantBootstrap } from './components/TenantBootstrap.tsx'
import { clearSession } from './data/auth'
import { startSessionClock } from './data/sessionClock'

registerSW({ immediate: true })

startSessionClock(() => {
  clearSession()
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login?expired=1')
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <TenantBootstrap>
        <App />
      </TenantBootstrap>
    </AppErrorBoundary>
  </StrictMode>,
)
