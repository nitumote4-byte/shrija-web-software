import { SAMPLING_IMPORT_SOURCE, SAMPLING_IMPORT_VERSION, matchSamplingImport } from './dist/sampling-core.js'
import { hashConfirmationPayload } from './dist/confirmation.js'

const SHRIJA_URLS = [
  'https://shrija-web-software.vercel.app/*',
  'http://localhost:*/*',
  'http://127.0.0.1:*/*',
]

const readButton = document.querySelector('#read')
const importButton = document.querySelector('#import')
const statusNode = document.querySelector('#status')
const previewNode = document.querySelector('#preview')
const resultNode = document.querySelector('#result')
if (!readButton || !importButton || !statusNode || !previewNode || !resultNode) {
  throw new Error('Sampling import popup UI did not load')
}

let extracted = null
let rows = []
let requests = []
let shrijaTabId = null
const resolutions = new Map()
const overwrite = new Set()

function setStatus(text, kind) {
  statusNode.textContent = text
  statusNode.className = kind || ''
}

function setResult(text, kind) {
  resultNode.textContent = text
  resultNode.className = kind || ''
}

function currentMatch() {
  if (!extracted) return null
  return matchSamplingImport(extracted, rows, requests, {
    resolutions: [...resolutions.entries()].map(([rowKey, shrijaId]) => ({ rowKey, shrijaId })),
    overwriteRowKeys: [...overwrite],
  })
}

function candidateLabel(candidate) {
  const weight = candidate.weight ? `${candidate.weight} g` : 'weight blank'
  const job = candidate.jobCardNo ? `job ${candidate.jobCardNo}` : 'job empty'
  const tag = candidate.sampleTagId ? `tag ${candidate.sampleTagId}` : 'tag empty'
  return `${candidate.partyName || 'Party'} · ${candidate.item} · ${candidate.pic} pcs · ${weight} · ${job} · ${tag} · ${candidate.date || ''}`
}

function render() {
  previewNode.replaceChildren()
  importButton.disabled = true
  if (!extracted) return
  const match = currentMatch()
  const heading = document.createElement('p')
  if (!match?.ok) {
    heading.textContent = match?.error || 'Shrija could not match this sampling page.'
    heading.className = 'error'
    previewNode.appendChild(heading)
    return
  }
  heading.textContent = `Request ${match.requestNumber} · Job ${match.jobNumber}`
  previewNode.appendChild(heading)

  const table = document.createElement('table')
  const head = document.createElement('tr')
  for (const label of ['Manak row', 'Samples', 'Proposed', 'Shrija']) {
    const cell = document.createElement('th')
    cell.textContent = label
    head.appendChild(cell)
  }
  table.appendChild(head)

  for (const proposal of match.proposals) {
    const tr = document.createElement('tr')
    const source = document.createElement('td')
    source.textContent = `${proposal.rowNumber}. ${proposal.itemType} · tag ${proposal.tagId || '—'} · ${proposal.materialType || 'material blank'} · ${proposal.samplingMethod || 'method blank'}`
    const samples = document.createElement('td')
    samples.textContent = proposal.samples
    const proposed = document.createElement('td')
    proposed.textContent = proposal.assignTag || proposal.samples === 'Yes'
      ? `Job ${proposal.proposedJobNumber} · Tag ${proposal.proposedTagId || '—'}`
      : `Job ${proposal.proposedJobNumber} · Tag not set`
    const choice = document.createElement('td')
    const message = document.createElement('div')
    message.textContent = proposal.message
    choice.appendChild(message)

    if (proposal.candidates.length > 1) {
      const select = document.createElement('select')
      const empty = document.createElement('option')
      empty.value = ''
      empty.textContent = 'Choose QM row'
      select.appendChild(empty)
      for (const candidate of proposal.candidates) {
        const option = document.createElement('option')
        option.value = candidate.id
        option.textContent = candidateLabel(candidate)
        if (resolutions.get(proposal.rowKey) === candidate.id) option.selected = true
        select.appendChild(option)
      }
      select.addEventListener('change', () => {
        if (select.value) resolutions.set(proposal.rowKey, select.value)
        else resolutions.delete(proposal.rowKey)
        render()
      })
      choice.appendChild(select)
    } else if (proposal.candidates.length === 1) {
      const only = document.createElement('div')
      only.textContent = candidateLabel(proposal.candidates[0])
      choice.appendChild(only)
    }

    if (proposal.status === 'conflict') {
      const label = document.createElement('label')
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.checked = overwrite.has(proposal.rowKey)
      box.addEventListener('change', () => {
        if (box.checked) overwrite.add(proposal.rowKey)
        else overwrite.delete(proposal.rowKey)
        render()
      })
      label.appendChild(box)
      label.append(' Overwrite existing value')
      choice.appendChild(label)
    }

    tr.append(source, samples, proposed, choice)
    table.appendChild(tr)
  }
  previewNode.appendChild(table)
  const writable = match.proposals.filter((proposal) => proposal.willWrite).length
  importButton.disabled = writable === 0 || !shrijaTabId
}

async function findShrijaTab() {
  const tabs = await chrome.tabs.query({ url: SHRIJA_URLS })
  const open = tabs.filter((tab) => (tab.url || '').includes('/qm-request-list') && tab.id != null)
  const active = open.find((tab) => tab.active)
  return active || open[0] || null
}

readButton.addEventListener('click', async () => {
  setResult('')
  extracted = null
  rows = []
  requests = []
  shrijaTabId = null
  resolutions.clear()
  overwrite.clear()
  render()
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !/^https:\/\/huid\.manakonline\.in\//i.test(tab.url || '')) {
    setStatus('Open Manak Online on View Sampling Details, then click Read Sampling Details.', 'error')
    return
  }
  const readMessage = { source: SAMPLING_IMPORT_SOURCE, type: 'READ' }
  let page
  try {
    try {
      page = await chrome.tabs.sendMessage(tab.id, readMessage)
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['dist/content-manak.js'],
      })
      page = await chrome.tabs.sendMessage(tab.id, readMessage)
    }
  } catch {
    setStatus('The sampling reader is not running on this page. On chrome://extensions, click Reload for Shrija Sampling Import, then try Read again.', 'error')
    return
  }
  if (!page?.ok) {
    setStatus(page?.error || 'Sampling details could not be read.', 'error')
    return
  }
  extracted = page
  const shrija = await findShrijaTab()
  if (!shrija?.id) {
    setStatus('Sampling page read. Open Shrija QM Request List in another tab, then click Read Sampling Details again.', 'error')
    render()
    return
  }
  let listed
  try {
    listed = await chrome.tabs.sendMessage(shrija.id, {
      source: SAMPLING_IMPORT_SOURCE,
      type: 'LIST',
      payload: { requestNumber: page.requestNumber },
    })
  } catch {
    setStatus('Shrija QM Request List did not answer. Reload that page and try again. Nothing was saved.', 'error')
    return
  }
  if (!listed?.ok) {
    setStatus(listed?.error || 'Shrija could not list QM rows. Nothing was saved.', 'error')
    return
  }
  rows = listed.rows || []
  requests = listed.requests || []
  shrijaTabId = shrija.id
  setStatus('Review the match. Samples No does not receive a Sample Tag ID.', 'ok')
  render()
})

importButton.addEventListener('click', async () => {
  const match = currentMatch()
  if (!extracted || !shrijaTabId || !match?.ok) return
  importButton.disabled = true
  setResult('Saving through Shrija…')
  const payload = {
    extracted,
    resolutions: [...resolutions.entries()].map(([rowKey, shrijaId]) => ({ rowKey, shrijaId })),
    overwriteRowKeys: [...overwrite],
  }
  let applied
  try {
    const hash = await hashConfirmationPayload(payload)
    const sealed = await chrome.runtime.sendMessage({
      source: SAMPLING_IMPORT_SOURCE,
      version: SAMPLING_IMPORT_VERSION,
      type: 'CONFIRM_IMPORT',
      hash,
      payload,
    })
    if (!sealed?.ok) {
      setResult('Import confirmation was not accepted. Nothing was saved.', 'error')
      render()
      return
    }
    applied = await chrome.tabs.sendMessage(shrijaTabId, {
      source: SAMPLING_IMPORT_SOURCE,
      type: 'APPLY',
      payload: { hash },
    })
  } catch {
    setResult('Shrija did not answer. Nothing was confirmed as saved. Reload QM Request List and try again.', 'error')
    render()
    return
  }
  if (!applied) {
    setResult('Shrija did not answer. Nothing was confirmed as saved.', 'error')
    render()
    return
  }
  setResult(applied.summary || applied.error || 'Import finished without a confirmation.', applied.persisted ? 'ok' : 'error')
  render()
})
