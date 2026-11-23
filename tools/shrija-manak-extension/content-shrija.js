/**
 * Runs on Shrija Vercel / localhost — copies Create Sheet payload into chrome.storage.local
 * so the Manak content script can read it (different origin = no shared localStorage).
 */
const KEY = 'shrija-manak-fire-assay-sheet'
const ARCHIVE_KEY = 'shrija-manak-fire-assay-archive'
const DOM_ID = 'shrija-fire-assay-payload'

function extAlive() {
  try {
    return Boolean(chrome?.runtime?.id)
  } catch {
    return false
  }
}

function sheetHasPayload(sheet) {
  return Boolean(
    sheet &&
      typeof sheet === 'object' &&
      (sheet.cg || (sheet.rows && sheet.rows.length) || (sheet.viewRows && sheet.viewRows.length)),
  )
}

function sheetStorageKey(sheet) {
  return [sheet.date || '', sheet.purity || '', sheet.shift || 'Day', String(sheet.sheetNo || '')].join('|')
}

function mergeArchive(existing, incoming, active) {
  const next = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {}
  const list = []
  if (Array.isArray(incoming)) list.push(...incoming)
  else if (incoming && typeof incoming === 'object') list.push(...Object.values(incoming))
  if (active) list.push(active)
  for (const sheet of list) {
    if (!sheetHasPayload(sheet)) continue
    const key = sheetStorageKey(sheet)
    const prev = next[key]
    if (prev && Number(prev.publishedAt || 0) > Number(sheet.publishedAt || 0)) continue
    next[key] = sheet
  }
  return next
}

function storeBundle(sheet, archive, source) {
  if (!sheetHasPayload(sheet) && !archive) return
  if (!extAlive()) return
  try {
    chrome.storage.local.get([KEY, ARCHIVE_KEY], (data) => {
      if (!extAlive() || chrome.runtime.lastError) return
      const nextArchive = mergeArchive(data[ARCHIVE_KEY], archive, sheet)
      const active = sheetHasPayload(sheet) ? sheet : data[KEY]
      if (
        JSON.stringify(data[KEY] || null) === JSON.stringify(active || null) &&
        JSON.stringify(data[ARCHIVE_KEY] || null) === JSON.stringify(nextArchive)
      ) {
        return
      }
      chrome.storage.local.set(
        {
          [KEY]: active,
          [ARCHIVE_KEY]: nextArchive,
          [`${KEY}-at`]: Date.now(),
          [`${KEY}-src`]: source || '',
        },
        () => void chrome.runtime.lastError,
      )
      if (sheetHasPayload(sheet)) {
        chrome.runtime.sendMessage({ type: 'SHRIJA_MANAK_FIRE_ASSAY', sheet }, () => void chrome.runtime.lastError)
      }
      console.info('[Shrija extension] sheet synced to chrome.storage', active?.sheetNo, source)
    })
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
  const domSheet = el?.textContent ? parseMaybe(el.textContent) : null
  const domArchive = el?.getAttribute('data-archive') ? parseMaybe(el.getAttribute('data-archive')) : null
  if (domSheet || domArchive) storeBundle(domSheet, domArchive, 'dom')

  try {
    const raw =
      localStorage.getItem(KEY) ||
      sessionStorage.getItem(KEY) ||
      localStorage.getItem('shrija-manak-fire-assay-sheet-v1')
    const sheet = parseMaybe(raw)
    const archive = parseMaybe(localStorage.getItem(ARCHIVE_KEY))
    if (sheet || archive) storeBundle(sheet, archive, 'localStorage')
  } catch {
    /* ignore */
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const data = event.data
  if (!data || data.type !== 'SHRIJA_MANAK_FIRE_ASSAY' || !data.sheet) return
  storeBundle(data.sheet, data.archive, 'postMessage')
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
  if (!/create-fire-assay|view-fire-assay/i.test(location.pathname || '')) {
    document.getElementById('shrija-ext-synced-badge')?.remove()
    return
  }
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
      b.textContent = `Extension OK · Sheet ${data[KEY].sheetNo || '?'} · lot select = auto fill`
    })
  } catch {
    /* context invalidated */
  }
}

setInterval(showSyncedBadge, 2000)
showSyncedBadge()
