const SAMPLING_IMPORT_SOURCE = 'shrija-sampling-import'
const SAMPLING_IMPORT_VERSION = 1

function onQmPage() {
  return window.location.pathname.includes('/qm-request-list')
}

function askPage(action, payload, timeoutMs) {
  const requestId = crypto.randomUUID()
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      resolve({
        ok: false,
        code: 'NO_PAGE',
        error:
          'QM Request List did not answer. Open that page in Shrija, reload it, and try again. Nothing was saved.',
      })
    }, timeoutMs)

    function onMessage(event) {
      if (event.source !== window || event.origin !== window.location.origin) return
      const data = event.data
      if (!data || data.source !== SAMPLING_IMPORT_SOURCE || data.version !== SAMPLING_IMPORT_VERSION) return
      if (data.direction !== 'response' || data.requestId !== requestId) return
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      resolve(data.payload)
    }

    window.addEventListener('message', onMessage)
    window.postMessage(
      {
        source: SAMPLING_IMPORT_SOURCE,
        version: SAMPLING_IMPORT_VERSION,
        direction: 'request',
        requestId,
        action,
        payload,
      },
      window.location.origin,
    )
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.source !== SAMPLING_IMPORT_SOURCE) return
  if (sender?.id !== chrome.runtime.id) return
  if (message.type !== 'LIST' && message.type !== 'APPLY') return
  if (window.top !== window || !onQmPage()) {
    sendResponse({
      ok: false,
      code: 'WRONG_PAGE',
      persisted: false,
      error: 'Open the Shrija QM Request List page, then try again. Nothing was saved.',
    })
    return
  }
  const isApply = message.type === 'APPLY'
  const payload = isApply
    ? { hash: typeof message.payload?.hash === 'string' ? message.payload.hash : '' }
    : message.payload || {}
  const timeoutMs = isApply ? 20000 : 8000
  askPage(isApply ? 'apply' : 'list', payload, timeoutMs).then(sendResponse)
  return true
})
