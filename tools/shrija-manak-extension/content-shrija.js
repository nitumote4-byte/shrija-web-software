/** Capture Create Sheet payload from Shrija web app → chrome.storage for Manak filler. */
const KEY = 'shrija-manak-fire-assay-sheet'

function storeSheet(sheet) {
  if (!sheet) return
  try {
    chrome.storage.local.set({ [KEY]: sheet })
    chrome.runtime.sendMessage({ type: 'SHRIJA_MANAK_FIRE_ASSAY', sheet }, () => void chrome.runtime.lastError)
  } catch {
    /* ignore */
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const data = event.data
  if (!data || data.type !== 'SHRIJA_MANAK_FIRE_ASSAY' || !data.sheet) return
  storeSheet(data.sheet)
})

window.addEventListener('shrija:manak-fire-assay-sheet', (event) => {
  storeSheet(event.detail)
})

function syncFromStorage() {
  try {
    const raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY)
    if (!raw) return
    const sheet = JSON.parse(raw)
    if (sheet?.rows || sheet?.viewRows || sheet?.cg) storeSheet(sheet)
  } catch {
    /* ignore */
  }
}

syncFromStorage()
setInterval(syncFromStorage, 1500)
