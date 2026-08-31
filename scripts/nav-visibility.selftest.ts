/**
 * Role-aware sidebar visibility — uses the same canAccessPath / session
 * rules as ProtectedRoute. Does not change permission logic.
 * Run: npx --yes tsx scripts/nav-visibility.selftest.ts
 */
import { setAuth, type ApiSession } from '../src/api/client.ts'
import { flattenNavLeaves, getSearchableNav, getVisibleNavGroups } from '../src/data/navigation.ts'
import { canAccessPath } from '../src/data/roles.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`[nav-visibility] ${msg}`)
}

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

function activate(s: ApiSession) {
  setAuth('test-token', s)
}

function navPaths() {
  return flattenNavLeaves(getVisibleNavGroups()).map((item) => item.path)
}

function navTitles() {
  return getVisibleNavGroups().flatMap((g) =>
    g.items.flatMap((item) => [item.title, ...(item.children || []).map((c) => c.title)]),
  )
}

function has(paths: string[], path: string) {
  return paths.includes(path)
}

function topLevelLeafPaths() {
  return getVisibleNavGroups().flatMap((g) =>
    g.items.filter((item) => !item.children?.length).map((item) => item.path),
  )
}

function groupIds() {
  return getVisibleNavGroups().map((g) => g.id)
}

function folderChildren(folderId: string) {
  return (
    getVisibleNavGroups()
      .flatMap((g) => g.items)
      .find((item) => item.id === folderId)
      ?.children?.map((c) => c.path) || []
  )
}

// Quality Manager at Main — full desk including lab
activate(session({ role: 'quality_manager' }))
{
  const paths = navPaths()
  const titles = navTitles()
  const groups = groupIds()
  const topLevel = topLevelLeafPaths()
  assert(has(paths, '/'), 'QM sees Dashboard')
  assert(has(paths, '/dashboard'), 'QM sees Analytics')
  assert(titles.includes('Reception'), 'QM sees Reception group')
  assert(titles.includes('Billing'), 'QM sees Billing')
  assert(has(paths, '/manual-request'), 'QM sees Manual Request')
  assert(has(paths, '/auto-request'), 'QM sees Auto Request')
  assert(has(paths, '/rough-sheet'), 'QM sees Rough Sheet')
  assert(has(paths, '/request-list'), 'QM sees Request List')
  assert(topLevel.includes('/request-list'), 'Request List is a top-level sidebar item')
  assert(!folderChildren('reception').includes('/request-list'), 'Request List is not inside Reception')
  assert(folderChildren('reception').includes('/manual-request'), 'Reception contains Manual Request')
  assert(folderChildren('reception').includes('/auto-request'), 'Reception contains Auto Request')
  assert(folderChildren('reception').includes('/rough-sheet'), 'Reception contains Rough Sheet')
  assert(folderChildren('reception').length === 3, 'Reception contains only three children')
  assert(has(paths, '/qm-request-list'), 'QM sees QM Request List')
  assert(has(paths, '/print-job-card'), 'QM sees Print Job Card')
  assert(topLevel.includes('/print-job-card'), 'Print Job Card is a top-level sidebar item')
  assert(has(paths, '/billing'), 'QM sees Billing')
  assert(topLevel.includes('/billing'), 'Billing is a top-level sidebar item, not a dropdown')
  assert(has(paths, '/fund-entry'), 'QM sees Fund Entry')
  assert(topLevel.includes('/fund-entry'), 'Fund Entry is a top-level sidebar item')
  assert(has(paths, '/expense-entry'), 'QM sees Expense Entry')
  assert(topLevel.includes('/expense-entry'), 'Expense Entry is a top-level sidebar item')
  assert(has(paths, '/add-party'), 'QM sees Add Party')
  assert(topLevel.includes('/add-party'), 'Add Party is a top-level sidebar item')
  assert(has(paths, '/new-category'), 'QM sees New Category')
  assert(topLevel.includes('/new-category'), 'New Category is a top-level sidebar item')
  assert(paths.filter((p) => p === '/fund-entry').length === 1, 'Fund Entry is not duplicated')
  assert(paths.filter((p) => p === '/expense-entry').length === 1, 'Expense Entry is not duplicated')
  assert(paths.filter((p) => p === '/add-party').length === 1, 'Add Party is not duplicated')
  assert(paths.filter((p) => p === '/new-category').length === 1, 'New Category is not duplicated')
  assert(!titles.includes('Invoice Generation'), 'Billing is not renamed into a dropdown child')
  assert(!topLevel.includes('/generated-bills'), 'Generated Bills is not a top-level sidebar item')
  assert(!topLevel.includes('/monthly-billing'), 'Monthly Billing is not a top-level sidebar item')
  assert(!topLevel.includes('/monthly-bills'), 'Monthly Bills is not a top-level sidebar item')
  assert(!has(paths, '/generated-bills'), 'Generated Bills is not a sidebar traffic item')
  assert(!has(paths, '/monthly-billing'), 'Monthly Billing is not a sidebar traffic item')
  assert(!has(paths, '/monthly-bills'), 'Monthly Bills is not a sidebar traffic item')
  assert(
    getSearchableNav().some((m) => m.path === '/generated-bills'),
    'Generated Bills remains searchable',
  )
  assert(
    getSearchableNav().some((m) => m.path === '/monthly-billing'),
    'Monthly Billing remains searchable',
  )
  assert(
    getSearchableNav().some((m) => m.path === '/monthly-bills'),
    'Monthly Bills remains searchable',
  )
  assert(has(paths, '/qm-stock'), 'QM sees QM Stock')
  assert(has(paths, '/lab-stock'), 'QM sees Lab Stock')
  assert(groups.includes('lab'), 'QM sees Lab & Assay section')
  assert(!getVisibleNavGroups().find((g) => g.id === 'lab')?.collapsible, 'Lab & Assay is not a dropdown')
  assert(topLevel.includes('/create-fire-assay'), 'Create Fire Assay is a direct sidebar item')
  assert(topLevel.includes('/view-fire-assay'), 'View Fire Assay is a direct sidebar item')
  assert(has(paths, '/create-fire-assay'), 'QM sees Create Fire Assay')
  assert(has(paths, '/view-fire-assay'), 'QM sees View Fire Assay')
  assert(!has(paths, '/touch-form') || groups.includes('upcoming'), 'Touch Form is grouped under upcoming when visible')
  assert(has(paths, '/touch-form'), 'QM still reaches Touch Form from Upcoming Features')
  assert(has(paths, '/touch-billing'), 'QM still reaches Touch Billing from Upcoming Features')
  assert(has(paths, '/xray-hallmark'), 'QM still reaches Extra Hallmark Sheet from Upcoming Features')
  assert(folderChildren('upcoming-features').includes('/xray-hallmark'), 'Extra Hallmark Sheet is under Upcoming Features')
  assert(folderChildren('upcoming-features').includes('/touch-form'), 'Touch Form is under Upcoming Features')
  assert(folderChildren('upcoming-features').includes('/touch-billing'), 'Touch Billing is under Upcoming Features')
  assert(!topLevel.includes('/touch-form'), 'Touch Form is not a duplicate top-level item')
  assert(!topLevel.includes('/touch-billing'), 'Touch Billing is not a duplicate top-level item')
  assert(!topLevel.includes('/xray-hallmark'), 'Extra Hallmark Sheet is not a duplicate top-level item')
  assert(has(paths, '/reports'), 'QM sees Daily reports')
  assert(canAccessPath('/create-fire-assay'), 'QM can open fire assay route')
  assert(canAccessPath('/generated-bills'), 'QM can still open Generated Bills')
  assert(canAccessPath('/monthly-billing'), 'QM can still open Monthly Billing')
  assert(canAccessPath('/monthly-bills'), 'QM can still open Monthly Bills')
  assert(groups.includes('upcoming'), 'QM sees Upcoming Features section')
  assert(!groups.includes('business'), 'Business & Records group is no longer used')
}

// Reception — no lab / stock
activate(session({ role: 'reception' }))
{
  const paths = navPaths()
  const titles = navTitles()
  assert(has(paths, '/'), 'Reception sees Dashboard')
  assert(titles.includes('Reception'), 'Reception sees Reception group')
  assert(has(paths, '/manual-request'), 'Reception sees Manual Request')
  assert(has(paths, '/request-list'), 'Reception sees Request List')
  assert(has(paths, '/billing'), 'Reception sees Billing')
  assert(has(paths, '/fund-entry'), 'Reception sees Fund Entry')
  assert(has(paths, '/expense-entry'), 'Reception sees Expense Entry')
  assert(has(paths, '/add-party'), 'Reception sees Add Party')
  assert(has(paths, '/new-category'), 'Reception sees New Category')
  assert(has(paths, '/print-job-card'), 'Reception sees Print Job Card')
  assert(has(paths, '/xray-hallmark'), 'Reception sees Extra Hallmark Sheet under Upcoming Features')
  assert(!has(paths, '/create-fire-assay'), 'Reception does not see Create Fire Assay')
  assert(!has(paths, '/view-fire-assay'), 'Reception does not see View Fire Assay')
  assert(!groupIds().includes('lab'), 'Reception does not see Lab & Assay section')
  assert(!has(paths, '/lab-stock'), 'Reception does not see Lab Stock')
  assert(!has(paths, '/qm-stock'), 'Reception does not see QM Stock')
  assert(!canAccessPath('/create-fire-assay'), 'Reception cannot open fire assay route')
  assert(!canAccessPath('/lab-stock'), 'Reception cannot open lab stock route')
  assert(canAccessPath('/billing'), 'Reception can still open Billing')
  assert(canAccessPath('/generated-bills'), 'Reception can still open Generated Bills')
}

// In Lab — fire assay + stock only
activate(session({ role: 'assay_lab' }))
{
  const paths = navPaths()
  assert(has(paths, '/'), 'Lab sees Dashboard (home is always allowed)')
  assert(has(paths, '/create-fire-assay'), 'Lab sees Create Fire Assay')
  assert(has(paths, '/view-fire-assay'), 'Lab sees View Fire Assay')
  assert(groupIds().includes('lab'), 'Lab sees Lab & Assay section')
  assert(has(paths, '/lab-stock'), 'Lab sees Lab Stock')
  assert(has(paths, '/qm-stock'), 'Lab sees QM Stock')
  assert(!has(paths, '/manual-request'), 'Lab does not see Manual Request')
  assert(!has(paths, '/billing'), 'Lab does not see Billing')
  assert(!has(paths, '/reports'), 'Lab does not see Reports')
  assert(!has(paths, '/touch-form'), 'Lab does not see Touch Form')
  assert(!canAccessPath('/billing'), 'Lab cannot open billing route')
  assert(!canAccessPath('/dashboard'), 'Lab cannot open analytics dashboard')
}

// Off-Site Quality Manager — lab paths stay on Main
activate(
  session({
    role: 'quality_manager',
    centreId: 'osc-1',
    centreKind: 'osc',
    centreName: 'OASIS Outlet',
  }),
)
{
  const paths = navPaths()
  assert(has(paths, '/manual-request'), 'OSC QM still sees reception modules')
  assert(has(paths, '/billing'), 'OSC QM still sees billing')
  assert(!has(paths, '/create-fire-assay'), 'OSC QM does not see Create Fire Assay')
  assert(!has(paths, '/lab-stock'), 'OSC QM does not see Lab Stock')
  assert(!has(paths, '/qm-stock'), 'OSC QM does not see QM Stock')
  assert(!canAccessPath('/create-fire-assay'), 'OSC cannot open fire assay route')
  assert(!canAccessPath('/lab-stock'), 'OSC cannot open lab stock route')
}

console.log('nav-visibility.selftest: ok')
