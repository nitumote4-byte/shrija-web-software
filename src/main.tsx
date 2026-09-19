import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'
import { TenantBootstrap } from './components/TenantBootstrap.tsx'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <TenantBootstrap>
        <App />
      </TenantBootstrap>
    </AppErrorBoundary>
  </StrictMode>,
)
