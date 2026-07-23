/**
 * Runs on Shrija Vercel / localhost — copies Create Sheet payload into chrome.storage.local
 * so the Manak content script can read it (different origin = no shared localStorage).
 */
const KEY = 'shrija-manak-fire-assay-sheet'
const DOM_ID = 'shrija-fire-assay-payload'

function extAlive() {
  try {
    return Boolean(chrome?.runtime?.id)
  } catch {
    return false
  }
}

function storeSheet(sheet, source) {
  if (!sheet || typeof sheet !== 'object') return
  if (!sheet.cg && !(sheet.rows && sheet.rows.length) && !(sheet.viewRows && sheet.viewRows.length)) {
    return
  }
  if (!extAlive()) return
  try {
    chrome.storage.local.set({ [KEY]: sheet, [`${KEY}-at`]: Date.now(), [`${KEY}-src`]: source || '' })
    chrome.runtime.sendMessage({ type: 'SHRIJA_MANAK_FIRE_ASSAY', sheet }, () => void chrome.runtime.lastError)
    console.info('[Shrija extension] sheet synced to chrome.storage', sheet.sheetNo, source)
  } catch (e) {
    console.warn('[Shrija extension] store failed', e)
  }
}

function parseMaybe(raw) {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function syncFromPage() {
  if (!extAlive()) {
    if (window.__shrijaSyncTimer) {
      clearInterval(window.__shrijaSyncTimer)
      window.__shrijaSyncTimer = null
    }
    return
  }
  const el = document.getElementById(DOM_ID)
  if (el?.textContent) {
    const sheet = parseMaybe(el.textContent)
    if (sheet) storeSheet(sheet, 'dom')
  }

  try {
    const raw =
      localStorage.getItem(KEY) ||
      sessionStorage.getItem(KEY) ||
      localStorage.getItem('shrija-manak-fire-assay-sheet-v1')
    const sheet = parseMaybe(raw)
    if (sheet) storeSheet(sheet, 'localStorage')
  } catch {
    /* ignore */
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const data = event.data
  if (!data || data.type !== 'SHRIJA_MANAK_FIRE_ASSAY' || !data.sheet) return
  storeSheet(data.sheet, 'postMessage')
})

try {
  chrome.runtime.onMessage.addListener((msg) => {
    if (!extAlive()) return
    if (msg?.type === 'SHRIJA_SYNC_SHEET_NOW') syncFromPage()
  })
} catch {
  /* ignore */
}

const obs = new MutationObserver(() => {
  if (!extAlive()) return
  syncFromPage()
})
obs.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['data-updated'],
})

syncFromPage()
window.__shrijaSyncTimer = setInterval(syncFromPage, 1000)

function showSyncedBadge() {
  if (!extAlive()) return
  try {
    chrome.storage.local.get([KEY], (data) => {
      if (!extAlive() || chrome.runtime.lastError) return
      if (!data[KEY]) return
      let b = document.getElementById('shrija-ext-synced-badge')
      if (!b) {
        b = document.createElement('div')
        b.id = 'shrija-ext-synced-badge'
        Object.assign(b.style, {
          position: 'fixed',
          bottom: '16px',
          left: '16px',
          zIndex: 999999,
          background: '#15803d',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: '8px',
          font: '700 12px/1.2 system-ui,sans-serif',
          boxShadow: '0 6px 18px rgba(0,0,0,.2)',
        })
        document.documentElement.appendChild(b)
      }
      b.textContent = `Extension OK · Sheet ${data[KEY].sheetNo || '?'} · Manak pe Lot select = AUTO`
    })
  } catch {
    /* context invalidated */
  }
}

setInterval(showSyncedBadge, 2000)
showSyncedBadge()
