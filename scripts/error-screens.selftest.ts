/**
 * Centralized error screens — config, safe messages, UI rendering, routing hooks.
 * Does not change domain / financial / auth persistence logic.
 * Run: npx --yes tsx scripts/error-screens.selftest.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement, Component, act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { ApiRequestError } from '../src/api/client.ts'
import { AppErrorBoundary } from '../src/components/AppErrorBoundary.tsx'
import { ErrorPage } from '../src/components/ErrorPage.tsx'
import {
  HTTP_ERROR_CONFIG,
  HTTP_ERROR_STATUSES,
  getActionLabel,
  getHttpErrorConfig,
  resolveHttpErrorStatus,
  type HttpErrorStatus,
} from '../src/errors/httpErrorConfig.ts'
import {
  getSafeUserFacingMessage,
  isSensitiveErrorText,
  toSafeApiErrorMessage,
} from '../src/errors/safeErrorMessage.ts'
import { canAccessPath } from '../src/data/roles.ts'
import { setAuth, type ApiSession } from '../src/api/client.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

function assertMsg(cond: unknown, msg: string) {
  if (!cond) throw new Error(`[error-screens] ${msg}`)
}

/* --- localStorage mock (roles / session) -------------------------------- */

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

function session(partial: Partial<ApiSession> & Pick<ApiSession, 'role'>): ApiSession {
  return {
    username: 'tester',
    isAdmin: partial.role === 'admin' || partial.role === 'quality_manager',
    loggedInAt: new Date().toISOString(),
    tenantId: 'tn_test',
    tenantName: 'Test Centre',
    centreId: 'main',
    centreKind: 'main',
    ...partial,
  }
}

/* --- DOM helpers -------------------------------------------------------- */

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })
  const { window } = dom
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true })
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true })
  Object.defineProperty(globalThis, 'HTMLElement', {
    value: window.HTMLElement,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'SVGElement', {
    value: window.SVGElement,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'Node', { value: window.Node, configurable: true })
  Object.defineProperty(globalThis, 'navigator', {
    value: window.navigator,
    configurable: true,
  })
  // React 19 may need IS_REACT_ACT_ENVIRONMENT
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  return { dom, rootEl: window.document.getElementById('root')! }
}

async function render(node: ReactNode): Promise<{ root: Root; container: HTMLElement; unmount: () => Promise<void> }> {
  const { rootEl } = installDom()
  const root = createRoot(rootEl)
  await act(async () => {
    root.render(node)
  })
  return {
    root,
    container: rootEl,
    unmount: async () => {
      await act(async () => {
        root.unmount()
      })
    },
  }
}

function textOf(el: Element | null) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim()
}

/* --- Config / status mapping -------------------------------------------- */

console.log('error-screens: config map')

for (const status of HTTP_ERROR_STATUSES) {
  const cfg = HTTP_ERROR_CONFIG[status]
  assertMsg(cfg.status === status, `config status ${status}`)
  assertMsg(cfg.title.length > 0, `title for ${status}`)
  assertMsg(cfg.description.length > 0, `description for ${status}`)
  assertMsg(cfg.safeMessage.length > 0, `safeMessage for ${status}`)
  assertMsg(typeof cfg.icon === 'function' || typeof cfg.icon === 'object', `icon for ${status}`)
  assertMsg(Boolean(cfg.primaryAction), `primaryAction for ${status}`)
  assertMsg(getActionLabel(cfg.primaryAction).length > 0, `label for ${status}`)
}

assert.equal(resolveHttpErrorStatus(404), 404)
assert.equal(resolveHttpErrorStatus(503), 503)
assert.equal(resolveHttpErrorStatus(418), 500)
assert.equal(resolveHttpErrorStatus(505), 500)
assert.equal(resolveHttpErrorStatus(999), 500)
assert.equal(getHttpErrorConfig(418).status, 500)
assert.equal(getHttpErrorConfig(404).title, 'Page Not Found')
assert.equal(getHttpErrorConfig(403).title, 'Access Denied')
assert.equal(getHttpErrorConfig(500).title, 'Something Went Wrong')
assert.equal(getHttpErrorConfig(503).title, 'Service Temporarily Unavailable')

assertMsg(
  getHttpErrorConfig(404).description.includes("doesn't exist"),
  '404 copy',
)
assertMsg(getHttpErrorConfig(401).primaryAction === 'login', '401 login action')
assertMsg(getHttpErrorConfig(409).primaryAction === 'reload', '409 reload action')
assertMsg(getHttpErrorConfig(429).primaryAction === 'retry', '429 retry action')

/* --- Safe messages / no sensitive leaks --------------------------------- */

console.log('error-screens: safe message sanitization')

assertMsg(
  !isSensitiveErrorText('Invalid username or password'),
  'allowlisted login copy is not sensitive',
)
assertMsg(isSensitiveErrorText('some arbitrary error'), 'unknown 4xx text is unsafe')

// A. known safe user-facing 4xx → preserved
assert.equal(
  toSafeApiErrorMessage(401, 'Invalid username or password'),
  'Invalid username or password',
)
assert.equal(
  toSafeApiErrorMessage(400, 'Username and password are required'),
  'Username and password are required',
)
assert.equal(
  toSafeApiErrorMessage(403, 'This centre is suspended'),
  'This centre is suspended',
)

// B. arbitrary unknown 4xx → generic safe catalog
assert.equal(
  toSafeApiErrorMessage(400, 'some arbitrary error'),
  getSafeUserFacingMessage(400),
)
assert.equal(
  toSafeApiErrorMessage(403, 'totally unknown backend detail'),
  getSafeUserFacingMessage(403),
)

const unsafeProbes = [
  'JWT_SECRET=hunter2',
  'password=SuperSecret123',
  'api_key=sk-live-abc123',
  'api-key=sk-live-abc123',
  'Set-Cookie: session=abc; HttpOnly',
  'Cookie: a=b',
  'Authorization: abc.def.ghi',
  'Authorization: Bearer abc.def.ghi',
  'JWT_SECRET=...',
  'DATABASE_URL=postgres://...',
  'relation "users" does not exist',
  'duplicate key value violates unique constraint "parties_pkey"',
  'failed to read /etc/passwd',
  'SQLSTATE[23505]',
  'postgres error',
  'stack trace',
  'Error: /app/server/src/db.ts:12',
  'C:\\Users\\Asus\\server\\src\\index.ts',
  '/var/lib/postgresql/data',
  'BEGIN PRIVATE KEY',
  'secret=...',
  'token=...',
  'access_token=...',
  'refresh_token=...',
  'SELECT * FROM users WHERE id=1',
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb',
]

for (const probe of unsafeProbes) {
  assertMsg(isSensitiveErrorText(probe), `classified unsafe: ${probe.slice(0, 40)}`)
  for (const status of [400, 401, 403, 404, 409, 429] as const) {
    const out = toSafeApiErrorMessage(status, probe)
    assert.equal(out, getSafeUserFacingMessage(status), `scrub ${status}: ${probe.slice(0, 32)}`)
    assertMsg(!out.includes(probe), `raw probe must not appear in ${status} message`)
  }
  assert.equal(
    toSafeApiErrorMessage(500, probe),
    getSafeUserFacingMessage(500),
    `scrub 500: ${probe.slice(0, 32)}`,
  )
}

assert.equal(
  toSafeApiErrorMessage(500, 'SQLITE_ERROR: no such table at /var/app/db.sqlite'),
  getSafeUserFacingMessage(500),
)
assert.equal(
  toSafeApiErrorMessage(502, 'ECONNREFUSED 127.0.0.1:8787'),
  getSafeUserFacingMessage(502),
)
assert.equal(toSafeApiErrorMessage(409, undefined), getSafeUserFacingMessage(409))
assert.equal(toSafeApiErrorMessage(418, 'weird'), getSafeUserFacingMessage(500))

// M. 409 STALE_STORE — status/code/body preserved; message sanitized
const staleBody = { rev: 3, data: { parties: [] }, code: 'STALE_STORE' }
const staleMsg = toSafeApiErrorMessage(409, 'Store merge exploded with JWT_SECRET=x')
const stale = new ApiRequestError(staleMsg, 409, 'STALE_STORE', staleBody)
assert.equal(stale.status, 409)
assert.equal(stale.code, 'STALE_STORE')
assert.equal(stale.body, staleBody)
assert.equal(stale.message, getSafeUserFacingMessage(409))
assertMsg(!stale.message.includes('JWT_SECRET'), '409 message has no secret')
assertMsg(
  stale instanceof ApiRequestError && stale.status === 409 && stale.code === 'STALE_STORE',
  'existing 409 STALE_STORE handling shape preserved',
)

// Allowlisted 409 store conflict copy may remain
assert.equal(
  toSafeApiErrorMessage(409, 'Store was updated elsewhere'),
  'Store was updated elsewhere',
)

/* --- Template grammars: valid preserve / attacker capture → catalog ------ */

console.log('error-screens: template field grammars')

const catalog400 = getSafeUserFacingMessage(400)

type TemplateWrap = (value: string) => string

const templateWrappers: { name: string; wrap: TemplateWrap; valid: string }[] = [
  {
    name: 'username-used',
    wrap: (v) =>
      `Username "${v}" is already used by another centre. Choose a different username.`,
    valid: 'username123',
  },
  {
    name: 'unknown-centre',
    wrap: (v) => `Unknown centre / outlet "${v}" for this tenant`,
    valid: 'osc-1735689600000',
  },
  {
    name: 'set-password-for',
    wrap: (v) =>
      `Set a password for "${v}" (placeholder cannot be used for a new or renamed user)`,
    valid: 'reception_desk',
  },
  {
    name: 'image-dims',
    wrap: (v) => `Image must be between ${v} and ${v} pixels`,
    valid: '200×40',
  },
  {
    name: 'period',
    wrap: (v) => `Period ${v} already exists.`,
    valid: '2026-27',
  },
  {
    name: 'item',
    wrap: (v) => `Item 1: ${v}`,
    valid: 'description is required',
  },
  {
    name: 'password-min',
    wrap: (v) => `Password must be at least ${v} characters`,
    valid: '10',
  },
  {
    name: 'licence-max',
    wrap: (v) => `Licence allows max ${v} users (trying to save ${v})`,
    valid: '5',
  },
]

/** Payloads that must never be preserved inside any dynamic template capture. */
const templateAttackPayloads = [
  'JWT_SECRET=hunter2',
  'password=SuperSecret123',
  'api_key=sk-live-abc123',
  'Set-Cookie: session=abc',
  'Cookie: a=b',
  'Authorization: Bearer abc.def.ghi',
  'DATABASE_URL=postgres://...',
  'relation "users" does not exist',
  'duplicate key value violates unique constraint',
  '/etc/passwd',
  'C:\\Users\\test',
  'BEGIN PRIVATE KEY',
  '<script>alert(1)</script>',
  'token=abc',
  'abc.def.ghi',
  'line1\nSECRET=x',
  '100px',
  '100-500',
  '100 postgres leak',
]

/** True when payload accidentally matches that field's safe grammar (skip as "attack"). */
function payloadMatchesFieldGrammar(templateName: string, payload: string): boolean {
  switch (templateName) {
    case 'username-used':
    case 'set-password-for':
      return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(payload)
    case 'unknown-centre':
      return /^(?:main|[A-Za-z][A-Za-z0-9_-]{0,63})$/.test(payload)
    case 'image-dims':
      return /^[1-9]\d{0,4}×[1-9]\d{0,4}$/.test(payload)
    case 'period': {
      const m = /^(20\d{2})-(\d{2})$/.exec(payload)
      if (!m) return false
      return (Number(m[1]) + 1) % 100 === Number(m[2])
    }
    case 'item':
      return [
        'description is required',
        'quantity must be a positive integer',
        'rate must be zero or greater',
        'product / item name is required',
        'unit must be Gram (g) or Kilogram (kg)',
        'weight / quantity must be greater than zero',
        'rate per KG must be zero or greater',
      ].includes(payload)
    case 'password-min':
    case 'licence-max':
      return /^[1-9]\d{0,3}$/.test(payload)
    default:
      return false
  }
}

// Valid structured values → preserved
for (const t of templateWrappers) {
  const msg = t.wrap(t.valid)
  assert.equal(
    toSafeApiErrorMessage(400, msg),
    msg,
    `valid ${t.name} preserved`,
  )
}

assert.equal(
  toSafeApiErrorMessage(
    400,
    'Username "alice" is already used by another centre. Choose a different username.',
  ),
  'Username "alice" is already used by another centre. Choose a different username.',
)
assert.equal(
  toSafeApiErrorMessage(400, 'Unknown centre / outlet "main" for this tenant'),
  'Unknown centre / outlet "main" for this tenant',
)
assert.equal(
  toSafeApiErrorMessage(
    400,
    'Image must be between 200×40 and 8000×2500 pixels',
  ),
  'Image must be between 200×40 and 8000×2500 pixels',
)
assert.equal(
  toSafeApiErrorMessage(400, 'Item 2: quantity must be a positive integer'),
  'Item 2: quantity must be a positive integer',
)
assert.equal(
  toSafeApiErrorMessage(400, 'Item 3: unit must be Gram (g) or Kilogram (kg)'),
  'Item 3: unit must be Gram (g) or Kilogram (kg)',
)
assert.equal(
  toSafeApiErrorMessage(400, 'Period 2025-26 already exists.'),
  'Period 2025-26 already exists.',
)

// Invalid period math (2026-28 is not consecutive FY)
assert.equal(
  toSafeApiErrorMessage(400, 'Period 2026-28 already exists.'),
  catalog400,
)

// Image-specific rejects (dimension grammar only)
for (const badDim of ['100px', '100-500', '/etc/passwd', 'JWT_SECRET=x', '200x40', '200×40\nSECRET']) {
  const msg = `Image must be between ${badDim} and 8000×2500 pixels`
  const out = toSafeApiErrorMessage(400, msg)
  assert.notEqual(out, msg, `image reject ${badDim.slice(0, 24)}`)
  assert.equal(out, catalog400)
  assertMsg(!out.includes(badDim.split('\n')[0]!), `image must not leak ${badDim.slice(0, 20)}`)
}

// Attacker-controlled captures → catalog; payload must not appear in result
let templateProbeCount = 0
for (const t of templateWrappers) {
  for (const payload of templateAttackPayloads) {
    if (payloadMatchesFieldGrammar(t.name, payload)) continue
    templateProbeCount += 1
    const malicious = t.wrap(payload)
    const out = toSafeApiErrorMessage(400, malicious)
    assert.notEqual(out, malicious, `${t.name} rejects wrapped: ${payload.slice(0, 28)}`)
    assert.equal(out, catalog400, `${t.name} → catalog for: ${payload.slice(0, 28)}`)
    assertMsg(!out.includes(payload), `${t.name} must not leak payload`)
    if (payload.includes('\n')) {
      assertMsg(!out.includes('SECRET=x'), `${t.name} must not leak newline secret`)
    }
  }
}

// Extra username / centre rejects called out in the audit
for (const bad of [
  'JWT_SECRET=hunter2',
  'password=Secret123',
  '/etc/passwd',
  'C:\\Users\\test',
  'abc.def.ghi',
  '<script>',
]) {
  const u = `Username "${bad}" is already used by another centre. Choose a different username.`
  const out = toSafeApiErrorMessage(400, u)
  assert.notEqual(out, u)
  assert.equal(out, catalog400)
  assertMsg(!out.includes(bad), `username reject ${bad.slice(0, 24)}`)
}

assertMsg(templateProbeCount >= 100, `fuzz-like template probes ran (${templateProbeCount})`)
console.log(`error-screens: template probes ${templateProbeCount} passed`)

/* --- Render each status page -------------------------------------------- */

console.log('error-screens: render status pages')

const expectedTitles: Record<HttpErrorStatus, string> = {
  400: 'Bad Request',
  401: 'Session Required',
  403: 'Access Denied',
  404: 'Page Not Found',
  409: 'Data Conflict',
  429: 'Too Many Requests',
  500: 'Something Went Wrong',
  502: 'Bad Gateway',
  503: 'Service Temporarily Unavailable',
  504: 'Gateway Timeout',
}

for (const status of HTTP_ERROR_STATUSES) {
  const { container, unmount } = await render(createElement(ErrorPage, { status }))
  const html = container.innerHTML
  const title = textOf(container.querySelector('#error-screen-title'))
  assert.equal(title, expectedTitles[status], `title render ${status}`)
  assertMsg(html.includes(`data-error-status="${status}"`), `data attr ${status}`)
  assertMsg(html.includes(String(status)), `status code visible ${status}`)
  assertMsg(!html.includes('at Object.'), `no stack in ${status}`)
  assertMsg(!html.toLowerCase().includes('sqlite'), `no sqlite in ${status}`)
  assertMsg(!html.includes('Bearer '), `no bearer in ${status}`)
  assertMsg(!html.includes('DATABASE_URL'), `no env in ${status}`)
  assertMsg(html.toLowerCase().includes('shrija'), `branding ${status}`)
  await unmount()
}

{
  const { container, unmount } = await render(createElement(ErrorPage, { status: 418 }))
  assert.equal(textOf(container.querySelector('#error-screen-title')), 'Something Went Wrong')
  assertMsg(container.innerHTML.includes('data-error-status="500"'), 'unknown → 500')
  await unmount()
}

{
  const toxic =
    'Error: SQLITE_ERROR near SELECT at D:\\server\\src\\db.ts:99\n    at boom (file.ts:1:1)\nBearer eyJhbGciOiJIUzI1NiIs.aaa.bbb'
  const { container, unmount } = await render(
    createElement(ErrorPage, { status: 500, description: getSafeUserFacingMessage(500) }),
  )
  const html = container.innerHTML
  assertMsg(!html.includes('SQLITE'), 'no sql in rendered 500')
  assertMsg(!html.includes('db.ts'), 'no path in rendered 500')
  assertMsg(!html.includes(toxic.slice(0, 20)), 'no toxic prefix')
  // Ensure our sanitizer would scrub this if used as API message
  assert.equal(toSafeApiErrorMessage(500, toxic), getSafeUserFacingMessage(500))
  await unmount()
}

/* --- ErrorBoundary → 500 ------------------------------------------------ */

console.log('error-screens: ErrorBoundary')

class Boom extends Component {
  render(): ReactNode {
    throw new Error('render boom\n    at Secret.tsx:12:3\nSELECT * FROM secrets')
  }
}

{
  const prev = console.error
  console.error = () => {}
  try {
    const { container, unmount } = await render(
      createElement(AppErrorBoundary, null, createElement(Boom)),
    )
    const html = container.innerHTML
    assert.equal(textOf(container.querySelector('#error-screen-title')), 'Something Went Wrong')
    assertMsg(html.includes('data-error-status="500"'), 'boundary shows 500')
    assertMsg(!html.includes('Secret.tsx'), 'no stack path in boundary UI')
    assertMsg(!html.includes('SELECT *'), 'no SQL in boundary UI')
    await unmount()
  } finally {
    console.error = prev
  }
}

/* --- Auth routes still gated; 403 does not clear session ---------------- */

console.log('error-screens: auth / RBAC preserved')

memory.clear()
setAuth('tok', session({ role: 'reception' }))
assertMsg(canAccessPath('/'), 'reception can open dashboard')
assertMsg(canAccessPath('/billing'), 'reception billing')
assertMsg(!canAccessPath('/create-fire-assay'), 'reception denied lab')
assertMsg(Boolean(localStorage.getItem('shrija-auth-token')), 'token still present after 403 check')

memory.clear()
setAuth('tok', session({ role: 'admin', isAdmin: true }))
assertMsg(canAccessPath('/billing'), 'admin billing')
assertMsg(canAccessPath('/create-fire-assay'), 'admin lab')

/* --- Source wiring: 404 catch-all, no Navigate-to-home star ------------- */

console.log('error-screens: App / ProtectedRoute / api wiring')

const appSrc = readFileSync(join(rootDir, 'src/App.tsx'), 'utf8')
assertMsg(appSrc.includes('NotFoundPage'), 'App uses NotFoundPage')
assertMsg(appSrc.includes('path="*"'), 'App has catch-all')
assertMsg(!appSrc.includes('path="*" element={<Navigate to="/"'), 'catch-all no longer redirects home')
assertMsg(appSrc.includes('/error/:status'), 'optional error deep-link route')
assertMsg(appSrc.includes('path="billing"'), 'billing route intact')
assertMsg(appSrc.includes('path="create-fire-assay"'), 'fire assay route intact')
assertMsg(appSrc.includes('other-services'), 'other-services routes intact')

const mainSrc = readFileSync(join(rootDir, 'src/main.tsx'), 'utf8')
assertMsg(mainSrc.includes('AppErrorBoundary'), 'main wraps AppErrorBoundary')

const protectedSrc = readFileSync(join(rootDir, 'src/components/ProtectedRoute.tsx'), 'utf8')
assertMsg(protectedSrc.includes('ErrorPage status={403}'), '403 page on denied known path')
assertMsg(protectedSrc.includes('canAccessPath'), 'RBAC still used')
assertMsg(!protectedSrc.includes('clearSession'), '403 does not clear session')

const clientSrc = readFileSync(join(rootDir, 'src/api/client.ts'), 'utf8')
assertMsg(clientSrc.includes('toSafeApiErrorMessage'), 'api uses safe messages')
assertMsg(clientSrc.includes('ApiRequestError'), 'ApiRequestError still thrown')

const tenantCacheSrc = readFileSync(join(rootDir, 'src/data/tenantCache.ts'), 'utf8')
assertMsg(
  tenantCacheSrc.includes("e.status === 409 && e.code === 'STALE_STORE'"),
  '409 STALE_STORE handler unchanged',
)

console.log('error-screens: all checks passed')
