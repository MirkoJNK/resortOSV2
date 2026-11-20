import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { typescriptSemanticHash, approvedTypeScriptHash } = require('../scripts/typescript-semantic.cjs')
const { verify: verifyShellExtraction } = require('../scripts/verify-shell-extraction.cjs')
const { verifySystemManagementEntrypoint } = require('../scripts/verify-system-management-entrypoint.cjs')
const manifest = JSON.parse(fs.readFileSync('tests/fixtures/v062-approved-baseline.json', 'utf8'))
const app = fs.readFileSync('src/App.tsx', 'utf8')
const support = fs.readFileSync('src/components/SupportWorkspace.tsx', 'utf8')
const dashboard = fs.readFileSync('src/features/dashboard/Dashboard.tsx', 'utf8')

// These checks deliberately read the CURRENT files, not the legacy-text adapter.
test('all TS/TSX files preserve the approved structure and literal values', () => {
  for (const [file, expected] of Object.entries(manifest.sourceSemantics)) {
    if (file === 'src/components/SupportWorkspace.tsx') {
      assert.match(support, /export function getSupportCounts\(/)
      assert.doesNotMatch(support, /function SupportOverview\(/)
    } else if (file === 'src/App.tsx') {
      assert.equal(verifyShellExtraction().length, 20)
    } else if (file === 'src/domain/types.ts') {
      const approved = JSON.parse(fs.readFileSync('SERVICE_CATALOG_APPROVED.json', 'utf8'))
      assert.equal(typescriptSemanticHash(file), approved.domainTypesHash)
    } else if (file === 'src/main.tsx') {
      assert.equal(verifySystemManagementEntrypoint(), true)
    } else {
      assert.equal(typescriptSemanticHash(file), approvedTypeScriptHash(file), file)
    }
  }
})

test('large React screens are readable instead of compressed into giant lines', () => {
  assert.ok(app.split('\n').length > 150)
  assert.ok(dashboard.split('\n').length > 300)
  assert.ok(support.split('\n').length > 1200)
  assert.match(fs.readFileSync('src/shell/Sidebar.tsx', 'utf8'), /function Sidebar\(/)
  assert.match(support, /type SampleTicket = \{\n/)
})

test('the unused LayoutDashboard icon import is gone without changing other imports', () => {
  const imports = dashboard.slice(0, dashboard.indexOf('const niceTime'))
  assert.doesNotMatch(imports, /LayoutDashboard/)
  assert.match(imports, /Headphones/)
  assert.match(imports, /Settings2/)
})

test('shared-ticket and filtered-ticket behavior is explicitly documented', () => {
  assert.match(app, /const supportTickets = supportData\.tickets/)
  assert.match(app, /qualitySupportTickets\(supportTickets, reviewScenario\)/)
  assert.match(support, /Keep it in\n  \/\/ the right-hand panel/)
  assert.match(support, /Admin conversations and structured ticket activity/)
})

test('System Management preserves all scoped features and the new Menu Management module', () => {
  const original = Object.keys(manifest.sourceSemantics).sort()
  const actual = []
  function collect(folder) {
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      const child = path.join(folder, item.name)
      if (item.isDirectory()) collect(child)
      else if (/\.tsx?$/.test(item.name)) actual.push(child.split(path.sep).join('/'))
    }
  }
  collect('src')
  actual.push('vite.config.ts')
  assert.deepEqual(actual.sort(), [...original,
    'src/shell/GlobalSearch.tsx',
    'src/shell/Sidebar.tsx',
    'src/shell/Topbar.tsx',
    'src/shell/WorkspaceSwitcher.tsx',
    'src/shell/navigation.ts',
    'src/features/dashboard/Dashboard.tsx',
    'src/features/front-desk/FrontDeskDashboard.tsx',
    'src/features/front-desk/FrontDeskRooms.tsx',
    'src/features/front-desk/FrontDeskCharges.tsx',
    'src/features/front-desk/FrontDeskCheckout.tsx',
    'src/features/front-desk/checkout.ts',
    'src/features/front-desk/dashboardMetrics.ts',
    'src/features/front-desk/charges.ts',
    'src/features/front-desk/roomMetrics.ts',
    'src/features/front-desk/stays.ts',
    'src/features/menu-categories/MenuCategories.tsx',
    'src/features/menu-categories/model.ts',
    'src/features/menu-categories/storage.ts',
    'src/features/menu-categories/images.ts',
    'src/features/menu-management/MenuManagement.tsx',
    'src/features/menu-management/model.ts',
    'src/features/menu-management/storage.ts',
    'src/features/payment-methods/PaymentMethodSelect.tsx',
    'src/features/payment-methods/PaymentMethods.tsx',
    'src/features/payment-methods/model.ts',
    'src/features/restaurant/RestaurantDashboard.tsx',
    'src/features/restaurant-orders/RestaurantOrders.tsx',
    'src/features/restaurant-tables/DemoPaymentDialog.tsx',
    'src/features/restaurant-tables/DialogFrame.tsx',
    'src/features/restaurant-tables/OrderWorkspace.tsx',
    'src/features/restaurant-tables/Reservations.tsx',
    'src/features/restaurant-tables/RestaurantTables.tsx',
    'src/features/restaurant-tables/TableOverviews.tsx',
    'src/features/restaurant-tables/model.ts',
    'src/features/restaurant-tables/storage.ts',
    'src/features/system-management/SystemManagement.tsx',
    'src/features/rooms-manager/model.ts',
    'src/features/rooms-manager/RoomsManager.tsx',
    'src/features/service-catalog/model.ts',
    'src/features/service-catalog/ServiceCatalog.tsx',
    'src/features/tables-manager/model.ts',
    'src/features/tables-manager/TablesManager.tsx'
  ].sort())
})

test('Prettier and ESLint commands remain available for local verification', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  assert.equal(pkg.version, '0.6.6-hotfix.1') // npm requires three numeric segments; display release is v0.6.6.1
  assert.match(pkg.scripts['format:typescript'], /^prettier /)
  assert.match(pkg.scripts['format:typescript:check'], /^prettier /)
  assert.match(pkg.scripts.lint, /^eslint /)
})

// A real code edit must still fail the portable baseline even with an alternate parser version.
test('portable TypeScript baseline rejects a changed identifier', () => {
  const { mkdtempSync, writeFileSync, rmSync } = fs
  const os = require('node:os')
  const temp = mkdtempSync(path.join(os.tmpdir(), 'resortos-ts-guard-'))
  try {
    const source = fs.readFileSync('src/features/dashboard/Dashboard.tsx', 'utf8')
    const changed = source.replace('function Dashboard(', 'function DashboardTampered(')
    assert.notEqual(changed, source)
    const candidate = path.join(temp, 'Dashboard.tsx')
    writeFileSync(candidate, changed)
    assert.notEqual(typescriptSemanticHash(candidate), typescriptSemanticHash('src/features/dashboard/Dashboard.tsx'))
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})
