import { SAMPLING_IMPORT_SOURCE, extractSamplingDetails } from './dist/sampling-core.js'

if (globalThis.__shrijaSamplingReadListener) return
globalThis.__shrijaSamplingReadListener = true

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.source !== SAMPLING_IMPORT_SOURCE || message.type !== 'READ') return
  if (window.top !== window) {
    sendResponse({ ok: false, error: 'Open the sampling details page in the main window. Import stopped.' })
    return
  }
  try {
    sendResponse(extractSamplingDetails(document))
  } catch {
    sendResponse({
      ok: false,
      error: 'The sampling page could not be read. Import stopped.',
    })
  }
})
