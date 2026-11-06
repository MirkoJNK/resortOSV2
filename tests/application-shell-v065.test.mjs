import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { verify } = require('../scripts/verify-shell-extraction.cjs')
const read = file => fs.readFileSync(file, 'utf8')
const app = read('src/App.tsx')
const sidebar = read('src/shell/Sidebar.tsx')
const topbar = read('src/shell/Topbar.tsx')
const search = read('src/shell/GlobalSearch.tsx')
const navigation = read('src/shell/navigation.ts')

// These checks read the ACTUAL refactored files, not the legacy-source adapter.
test('v0.6.5 preserves all approved navigation and page component syntax', () => {
  assert.equal(verify().length, 20)
})

test('shell is split into dedicated modules, not duplicated in App.tsx', () => {
  for (const file of ['Sidebar.tsx', 'Topbar.tsx', 'GlobalSearch.tsx', 'navigation.ts']) {
    assert.ok(fs.existsSync('src/shell/' + file), file)
  }
  for (const name of ['Sidebar', 'Topbar', 'GlobalSearch']) {
    assert.match(app, new RegExp(`import \\{ ${name} \\} from './shell/${name}'`))
    assert.doesNotMatch(app, new RegExp(`function ${name}\\(`))
  }
  assert.match(app, /<Sidebar\s/)
  assert.match(app, /<Topbar\s/)
  assert.match(app, /<GlobalSearch\s/)
})

test('single navigation source has exactly four approved pages and routes', () => {
  const options = [...navigation.matchAll(/\{ area: '([^']+)', label: '([^']+)', iconAsset: '([^']+)' \}/g)]
  assert.deepEqual(options.map(m => [m[1], m[2]]), [
    ['dashboard', 'Dashboard'], ['support', 'Support & Issues'],
    ['audit', 'Audit Log'], ['systems', 'System Management']
  ])
  for (const [, , , asset] of options) {
    assert.ok(asset.startsWith('/assets/sidebar-icon-'))
    assert.ok(fs.existsSync('public' + asset), asset)
  }
  assert.match(sidebar, /items \?\? primaryNav\.map\(item =>/)
  assert.match(search, /items = allNav/)
  assert.match(search, /items\.map\(x =>/)
})

test('sidebar keeps the approved imagery and mobile accessibility', () => {
  assert.match(sidebar, /sidebar-brand-approved-v058\.png/)
  assert.match(sidebar, /sidebar-coastal-approved-v058\.png/)
  assert.match(sidebar, /id="resortos-nav"/)
  assert.match(sidebar, /aria-label="Main navigation"/)
  assert.match(sidebar, /aria-current=\{area === item\.area \? 'page' : undefined\}/)
  assert.match(topbar, /aria-controls="resortos-nav"/)
  assert.match(topbar, /aria-expanded=\{menuOpen\}/)
  assert.match(topbar, /Search pages/)
})

test('search dialog stays pages-only with accessible focus handling', () => {
  assert.match(search, /placeholder="Search pages"/)
  assert.match(search, /items = allNav/)
  assert.match(search, /items\.map/)
  assert.doesNotMatch(search, /createSupportTickets|getSupportCounts|ticket\.subject|requester/)
  assert.match(search, /inputRef\.current\?\.focus\(\)/)
  assert.match(search, /restoreFocus\.current\.focus\(\)/)
  assert.match(search, /event\.key !== 'Tab'/)
  assert.match(search, /role="dialog"/)
  assert.match(search, /onClick=\{e => e\.stopPropagation\(\)\}/)
})

test('App retains responsibility for shared state, routing and keyboard handling', () => {
  assert.match(app, /createSupportTickets/)
  assert.match(app, /onTicketsChange=\{setSupportTickets\}/)
  assert.match(app, /addEventListener\('hashchange'/)
  assert.match(app, /e\.key\.toLowerCase\(\) === 'k'/)
  assert.match(app, /if \(e\.key === 'Escape'\)/)
  assert.match(app, /document\.body\.style\.overflow = 'hidden'/)
  for (const route of ['dashboard', 'support', 'audit', 'systems']) {
    assert.match(app, new RegExp(`case '${route}':`))
  }
})
