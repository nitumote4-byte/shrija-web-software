/**
 * Lab (and other partial-store) roles receive only the keys they may read.
 * Home must still open after first-login password change.
 * Run: npx --yes tsx scripts/lab-dashboard-store.selftest.ts
 */
import assert from 'node:assert/strict'
import { createElement, act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { JSDOM } from 'jsdom'
import { clearAuth, setAuth, type ApiSession } from '../src/api/client.ts'
import { AppErrorBoundary } from '../src/components/AppErrorBoundary.tsx'
import { Dashboard } from '../src/pages/Dashboard.tsx'
import { store } from '../src/data/store.ts'
import { resetTenantCache, setStoreCache } from '../src/data/tenantCache.ts'

const memory = new Map<string, string>()
const localStorageMock = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, String(value))
  },
  removeItem: (key: string) => {
    memory.delete(key)
  },
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size
  },
}
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
})

globalThis.fetch = async () =>
  ({
    ok: true,
    status: 200,
    text: async () => '',
  }) as Response

function session(role: string): ApiSession {
  return {
    username: 'lab.user',
    role,
    isAdmin: false,
    loggedInAt: new Date().toISOString(),
    tenantId: 'tn_test',
    tenantName: 'Test Centre',
    centreId: 'main',
    centreKind: 'main',
  }
}

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })
  const { window } = dom
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true })
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true })
  Object.defineProperty(globalThis, 'HTMLElement', { value: window.HTMLElement, configurable: true })
  Object.defineProperty(globalThis, 'Node', { value: window.Node, configurable: true })
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })
  Object.defineProperty(globalThis, 'Event', { value: window.Event, configurable: true })
  Object.defineProperty(globalThis, 'CustomEvent', { value: window.CustomEvent, configurable: true })
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  return window.document.getElementById('root')!
}

async function render(node: ReactNode) {
  const rootEl = installDom()
  const root: Root = createRoot(rootEl)
  await act(async () => {
    root.render(node)
  })
  return {
    container: rootEl,
    unmount: async () => {
      await act(async () => {
        root.unmount()
      })
    },
  }
}

/** Same shape the server returns for an In Lab user — billing keys omitted. */
function labPayload() {
  return {
  parties: [{ id: 'p1', name: 'Mehta Ornaments' }],
  categories: [{ id: 'c1', name: '22K', purity: '916', metal: 'Gold', rate: 75 }],
  jewelleryCategories: [],
  requests: [
    {
      id: 'r1',
      requestNo: 'HM-2026-003',
      partyId: 'p1',
      partyName: 'Mehta Ornaments',
      categoryId: 'c1',
      categoryName: '22K',
      pieces: 1,
      weight: 10,
      purity: '916',
      status: 'Pending',
      source: 'Manual',
      date: '2026-10-12',
      remarks: '',
      centreId: 'main',
      centreKind: 'main',
    },
  ],
  fireAssays: [
    {
      id: 'fa1',
      assayNo: 'FA-1',
      requestNo: 'HM-2026-003',
      partyName: 'Mehta Ornaments',
      sampleWeight: 0.2,
      purityFound: 916,
      declaredPurity: '916',
      status: 'In Lab',
      date: '2026-10-12',
      analyst: 'Lab',
      assayType: 'Manual',
    },
  ],
  stock: [{ id: 's1', name: 'Cupels', unit: 'pcs', quantity: 12, minLevel: 1, location: 'Lab' }],
  xrfStandards: [],
  xrfStandardChecks: [],
}
}

function loadPartial(role: string, payload: object) {
  clearAuth()
  resetTenantCache()
  setStoreCache(payload as never)
  setAuth('test-token', session(role))
}

loadPartial('assay_lab', labPayload())

const labView = store.getAll()
assert.equal(labView.requests.length, 1)
assert.equal(labView.requests[0]?.requestNo, 'HM-2026-003')
assert.equal(labView.fireAssays.length, 1)
assert.equal(labView.stock.length, 1)
assert.ok(Array.isArray(labView.touches))
assert.ok(Array.isArray(labView.xray))
assert.ok(Array.isArray(labView.invoices))
assert.ok(Array.isArray(labView.funds))
assert.ok(Array.isArray(labView.roughSheets))
assert.equal(labView.invoices.length, 0, 'omitted invoices stay empty — not copied from another desk')

loadPartial('reception', {
  parties: [],
  requests: [],
  invoices: [],
  funds: [],
  expenses: [],
  categories: [{ id: 'c1', name: '22K', purity: '916', metal: 'Gold', rate: 75 }],
})
const receptionView = store.getAll()
assert.ok(Array.isArray(receptionView.stock))
assert.ok(Array.isArray(receptionView.fireAssays))
assert.ok(Array.isArray(receptionView.touches))
assert.ok(Array.isArray(receptionView.xray))

loadPartial('assay_lab', labPayload())

const { container, unmount } = await render(
  createElement(
    MemoryRouter,
    null,
    createElement(AppErrorBoundary, null, createElement(Dashboard)),
  ),
)
const text = (container.textContent || '').replace(/\s+/g, ' ')
assert.equal(container.querySelector('[data-error-status="500"]'), null)
assert.match(text, /Welcome back/)
assert.match(text, /In Lab/)
assert.match(text, /Assays in Lab/)
await unmount()

console.log('lab-dashboard-store.selftest: ok')
process.exit(0)
