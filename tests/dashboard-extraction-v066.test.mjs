import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { verify } = require('../scripts/verify-shell-extraction.cjs')
const dashboardPath = 'src/features/dashboard/Dashboard.tsx'
const dashboard = fs.readFileSync(dashboardPath, 'utf8')
const app = fs.readFileSync('src/App.tsx', 'utf8')

// These tests inspect the CURRENT application, not the legacy text adapter.
test('Dashboard extraction remains unique alongside the approved System Management feature', () => {
  assert.ok(fs.existsSync(dashboardPath))
  assert.match(app, /import \{ Dashboard \} from '\.\/features\/dashboard\/Dashboard'/)
  assert.doesNotMatch(app, /function Dashboard\s*\(/)
  assert.match(dashboard, /export function Dashboard\s*\(/)
  assert.equal((app + dashboard).match(/function Dashboard\s*\(/g)?.length, 1)
  const contents = fs.readdirSync('src/features', { withFileTypes: true })
  assert.deepEqual(contents.map(f => f.name).sort(), ['dashboard', 'restaurant', 'rooms-manager', 'service-catalog', 'system-management', 'tables-manager'])
})

test('Dashboard retains its live shared-ticket calculations and demo-data ownership', () => {
  assert.match(dashboard, /getSupportCounts\(tickets\)/)
  assert.match(dashboard, /todayPayments\(store\)/)
  assert.match(dashboard, /urgent\s*>\s*0/)
  assert.match(dashboard, /<RoleDistribution\s+items=\{roles\}/)
  assert.match(dashboard, /<Bars/)
  assert.match(dashboard, /<ResortArt\s*\/>/)
  assert.match(app, /qualityStore\(store, reviewScenario\)/)
  assert.match(app, /qualitySupportTickets\(supportTickets, reviewScenario\)/)
  assert.match(app, /<Dashboard[\s\S]*?store=\{dashboardData\}[\s\S]*?tickets=\{dashboardTickets\}/)
})

test('All 20 approved shell, Dashboard, and remaining Admin declarations match v0.6.4', () => {
  assert.equal(verify().length, 20)
})

test('other features, shell, styles and every public image are byte-identical to v0.6.5', () => {
  const frozen = JSON.parse(fs.readFileSync('tests/fixtures/v065-untouched-during-dashboard.json', 'utf8'))
  assert.ok(Object.keys(frozen).length >= 30)
  for (const [file, expected] of Object.entries(frozen)) {
    if (['src/components/SupportWorkspace.tsx', 'src/styles/support.css', 'src/styles/support-motion.css'].includes(file)) continue // approved Support-only changes
    if (['src/shell/navigation.ts', 'src/shell/Sidebar.tsx', 'src/shell/Topbar.tsx', 'src/shell/GlobalSearch.tsx'].includes(file)) {
      const approved = JSON.parse(fs.readFileSync('RESTAURANT_STAGE1_APPROVED.json', 'utf8'))
      const keys = {
        'src/shell/navigation.ts': 'navigationHash',
        'src/shell/Sidebar.tsx': 'sidebarHash',
        'src/shell/Topbar.tsx': 'topbarHash',
        'src/shell/GlobalSearch.tsx': 'globalSearchHash',
      }
      const { typescriptSemanticHash } = require('../scripts/typescript-semantic.cjs')
      const hotfix = JSON.parse(fs.readFileSync('GLOBAL_UI_HOTFIX_APPROVED.json', 'utf8')).approved_source
      const expectedHotfix = hotfix[file]?.after
      if (expectedHotfix) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), expectedHotfix, 'Only the exact authorized UI hotfix may change the shell')
      else assert.equal(typescriptSemanticHash(file), approved[keys[file]], 'Only explicitly approved Restaurant shell integration may change')
      continue
    }
    if (file === 'src/domain/types.ts') {
      const approved = JSON.parse(fs.readFileSync('SERVICE_CATALOG_APPROVED.json', 'utf8'))
      const { typescriptSemanticHash } = require('../scripts/typescript-semantic.cjs')
      assert.equal(typescriptSemanticHash(file), approved.domainTypesHash, 'Only the approved nested-route type may change')
      continue
    }
    assert.ok(fs.existsSync(file), file)
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    assert.equal(actual, expected, file)
  }
})

test('App continues to own routing, ticket state, and global keyboard handlers', () => {
  assert.match(app, /createSupportTickets/)
  assert.match(app, /onTicketsChange=\{setSupportTickets\}/)
  assert.match(app, /addEventListener\('hashchange'/)
  assert.match(app, /e\.key\.toLowerCase\(\) === 'k'/)
  for (const area of ['dashboard', 'support', 'audit', 'systems']) assert.match(app, new RegExp(`case '${area}':`))
  assert.match(app, /<Sidebar/)
  assert.match(app, /<Topbar/)
  assert.match(app, /<GlobalSearch/)
})

test('the module source contains the original cards without changed copy', () => {
  for (const text of [
    'Unresolved support tickets', "Today's payments", 'Active employees',
    'Pending approvals', 'Roles & access', 'Recent audit events',
    'Administration shortcuts', 'No urgent issues', 'Your resort needs your attention',
  ]) assert.ok(dashboard.includes(text), text)
})
