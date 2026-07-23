import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'shrija-pwa-install-dismissed'

function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone =
    'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return iOS && !standalone
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

/** Free install prompt — Android Chrome + iOS Share → Add to Home Screen tip. */
export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIos, setShowIos] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return

    if (isIosSafari()) {
      setShowIos(true)
      setVisible(true)
      return
    }

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="pwa-install-banner" role="dialog" aria-label="Install app">
      <div className="pwa-install-copy">
        <strong>Install Shrija</strong>
        {showIos ? (
          <span>
            Tap <b>Share</b> → <b>Add to Home Screen</b> (free, no App Store).
          </span>
        ) : (
          <span>Add to your phone home screen — free Android app shortcut.</span>
        )}
      </div>
      <div className="pwa-install-actions">
        {!showIos && deferred && (
          <button type="button" className="btn btn-navy btn-sm" onClick={() => void install()}>
            <Download size={14} /> Install
          </button>
        )}
        <button type="button" className="pwa-install-close" onClick={dismiss} aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
