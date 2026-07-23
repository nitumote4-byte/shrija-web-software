/** Capture Create Sheet payload from Shrija web app and store for Manak filler. */
const KEY = 'shrija-manak-fire-assay-sheet'

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const data = event.data
  if (!data || data.type !== 'SHRIJA_MANAK_FIRE_ASSAY' || !data.sheet) return
  try {
    chrome.storage.local.set({ [KEY]: data.sheet })
    chrome.runtime.sendMessage({ type: 'SHRIJA_MANAK_FIRE_ASSAY', sheet: data.sheet })
  } catch {
    /* ignore */
  }
})

window.addEventListener('shrija:manak-fire-assay-sheet', (event) => {
  const sheet = event.detail
  if (!sheet) return
  try {
    chrome.storage.local.set({ [KEY]: sheet })
  } catch {
    /* ignore */
  }
})
