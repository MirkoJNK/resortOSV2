import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let ts
try { ts = require('typescript') } catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript') }
const filename = path.resolve('src/features/system-management/SystemManagement.tsx')
const source = fs.readFileSync(filename, 'utf8')
const transpiled = ts.transpileModule(source, {
  fileName: filename,
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const jsx = (type, props) => ({ type, props: props || {} })
const icon = () => jsx('svg', {})
const lucide = new Proxy({}, { get: (_, name) => name === '__esModule' ? false : icon })

function createHarness() {
  let query = ''
  const React = {
    useState: () => [query, next => { query = typeof next === 'function' ? next(query) : next }],
    useMemo: fn => fn()
  }
  const module = { exports: {} }
  const run = vm.runInThisContext(`(function(require,module,exports){${transpiled}\n})`, { filename })
  run(name => {
    if (name === 'react') return React
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: Symbol.for('React.Fragment') }
    if (name === 'lucide-react') return lucide
    throw Error(`Unexpected dependency ${name}`)
  }, module, module.exports)
  const Component = module.exports.SystemManagement
  function materialize(node) {
    if (Array.isArray(node)) return node.map(materialize)
    if (!node || typeof node !== 'object') return node
    if (typeof node.type === 'function') return materialize(node.type(node.props))
    return { type: node.type, props: { ...node.props, children: materialize(node.props.children) } }
  }
  let tree
  const render = () => { tree = materialize(Component({})); return tree }
  const collect = predicate => {
    const found = []
    function walk(node) {
      if (Array.isArray(node)) { node.forEach(walk); return }
      if (!node || typeof node !== 'object') return
      if (predicate(node)) found.push(node)
      walk(node.props?.children)
    }
    walk(tree)
    return found
  }
  const single = predicate => {
    const match = collect(predicate)[0]
    assert.ok(match, 'Expected element missing')
    return match
  }
  const text = node => Array.isArray(node) ? node.map(text).join('') :
    node == null ? '' : typeof node === 'object' ? text(node.props?.children) : String(node)
  const input = () => single(n => n.type === 'input' && n.props.id === 'sm-tool-search')
  const setSearch = value => { input().props.onChange({ target: { value } }); render() }
  render()
  return { collect, single, text, render, setSearch, input, get query() { return query } }
}

const countTools = h => h.collect(node => ['div','a'].includes(node.type) && ['sm-tool','sm-tool sm-tool-link'].includes(node.props.className)).length
const countCats = h => h.collect(node => node.type === 'article' && node.props.className === 'sm-category').length
const countAnnouncement = h => h.text(h.single(node => node.props?.className === 'sm-announcement'))
const assertNoCounter = h => {
  assert.equal(h.collect(node => node.props?.className === 'sm-results').length, 0)
  const announcement = h.single(node => node.props?.className === 'sm-announcement')
  assert.equal(announcement.type, 'span')
  assert.equal(announcement.props.role, 'status')
  assert.equal(announcement.props['aria-live'], 'polite')
}

test('approved v2 hierarchy and eleven tools render in the specified category order', () => {
  const h = createHarness()
  assert.equal(h.text(h.single(node => node.type === 'h1')), 'System Management')
  assert.match(h.text(h.single(node => String(node.props?.className || '').includes('sm-heading'))), /Configure your resort's operations and settings/)
  const categories = h.collect(node => node.type === 'h2' && node.props.id == null).map(h.text)
  assert.deepEqual(categories, ['Resort Setup','Restaurant','Pricing & Payments','Receipts','People & Access'])
  assert.equal(countCats(h), 5)
  assert.equal(countTools(h), 11)
  assert.equal(h.input().props['aria-label'], 'Search management tools')
  assert.equal(countAnnouncement(h), '11 management tools')
  assertNoCounter(h)
})

test('search filters by individual tool metadata, ignoring case and outer whitespace', () => {
  const h = createHarness()
  h.setSearch('  MeNu  ')
  assert.equal(countAnnouncement(h), '2 of 11 tools')
  assert.equal(countCats(h), 1)
  assert.equal(countTools(h), 2)
  h.setSearch('PWD')
  assert.equal(countAnnouncement(h), '1 of 11 tools')
  assert.equal(countCats(h), 1)
  assert.match(h.text(h.single(node => node.props?.className === 'sm-tool-copy')), /Discount Management/)
  h.setSearch('Food and beverage configuration')
  assert.equal(countTools(h), 0, 'Category-only description must not match sibling tools')
  h.setSearch('receipt')
  assert.equal(countCats(h), 1)
  assert.equal(countTools(h), 2)
  h.setSearch('    ')
  assert.equal(countTools(h), 11)
  assert.equal(h.input().props['aria-label'], 'Search management tools')
  assert.equal(countAnnouncement(h), '11 management tools')
})

test('tool-level searches never include irrelevant siblings or category-only matches', () => {
  const h = createHarness()
  const cases = [
    ['Room', ['Rooms Manager']],
    ['Table', ['Tables Manager']],
    ['Service', ['Service Catalog']],
    ['Payment', ['Payment Methods']],
    ['Pay', ['Payment Methods']],
    ['Discount', ['Discount Management']],
    ['Employee', ['Employees']],
    ['Menu', ['Menu Management', 'Menu Categories']],
    ['Receipt', ['Receipt Settings', 'Receipt Builder']],
    ['PWD', ['Discount Management']],
    ['SeAtInG', ['Tables Manager']],
    ['  ROOM  ', ['Rooms Manager']],
    ['Food and beverage configuration', []],
    ['Pricing & Payments', []],
    ['not-a-management-tool-937', []],
    ['', ['Rooms Manager', 'Tables Manager', 'Service Catalog', 'Menu Management',
      'Menu Categories', 'Discount Management', 'Payment Methods', 'Receipt Settings',
      'Receipt Builder', 'Employees', 'Roles & Permissions']]
  ]
  for (const [query, expected] of cases) {
    h.setSearch(query)
    const labels = h.collect(node => node.type === 'h3').map(h.text)
    assert.deepEqual(labels, expected, `Wrong tools for ${JSON.stringify(query)}`)
    const count = expected.length
    assert.equal(countTools(h), count)
    assert.equal(countAnnouncement(h), query.trim() ? `${count} of 11 tools` : '11 management tools')
    assertNoCounter(h)
    const categories = h.collect(node => node.type === 'article' && node.props.className === 'sm-category')
    assert.equal(categories.length, count ? (query.trim() ? 1 : 5) : 0)
  }
})

test('search filter uses own tool fields, not parent category metadata', () => {
  const h = createHarness()
  h.setSearch('room')
  assert.deepEqual(h.collect(node => node.type === 'h3').map(h.text), ['Rooms Manager'])
  h.setSearch('payment')
  assert.deepEqual(h.collect(node => node.type === 'h3').map(h.text), ['Payment Methods'])
  h.setSearch('menu')
  assert.deepEqual(h.collect(node => node.type === 'h3').map(h.text), ['Menu Management', 'Menu Categories'])
  h.setSearch('nonexistent')
  assert.equal(countCats(h), 0)
  h.single(node => node.type === 'button' && h.text(node) === 'Clear search').props.onClick()
  h.render()
  assert.equal(countTools(h), 11)
})

test('empty results, hidden accessible announcement and both clear actions restore tools', () => {
  const h = createHarness()
  h.setSearch('no-such-management-tool-937')
  assert.equal(countTools(h), 0)
  assert.equal(countAnnouncement(h), '0 of 11 tools')
  assertNoCounter(h)
  assert.match(h.text(h.single(node => node.props?.className === 'sm-empty')), /No matching management tools/)
  h.single(node => node.type === 'button' && h.text(node) === 'Clear search').props.onClick()
  h.render()
  assert.equal(countTools(h), 11)
  h.setSearch('menu')
  h.single(node => node.type === 'button' && node.props['aria-label'] === 'Clear search').props.onClick()
  h.render()
  assert.equal(h.query, '')
  assert.equal(countTools(h), 11)
})

test('only Tables Manager, Rooms Manager and Service Catalog are links; the other eight tools remain informational', () => {
  const h = createHarness()
  const rows = h.collect(node => ['sm-tool','sm-tool sm-tool-link'].includes(node.props?.className))
  assert.equal(rows.length,11)
  const links=rows.filter(node=>node.type==='a')
  assert.equal(links.length,3)
  assert.deepEqual(links.map(x=>x.props.href), ['#systems/rooms','#systems/tables','#systems/services'])
  assert.match(h.text(links[0]),/Rooms Manager/)
  assert.match(h.text(links[1]),/Tables Manager/)
  assert.match(h.text(links[2]),/Service Catalog/)
  for (const row of rows.filter(node=>!links.includes(node))) {
    assert.equal(row.type,'div')
    assert.equal(row.props.onClick,undefined)
    assert.equal(row.props.role,undefined)
    assert.equal(row.props.tabIndex,undefined)
    assert.equal(row.props.href,undefined)
  }
  assert.doesNotMatch(h.text(h.render()), /Planned|New architecture in progress|Export demo data|Reset demo workspace|migration from resortOS 1\.0/i)
})

test('the real App route and stylesheet integration remain intact', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf8')
  const main = fs.readFileSync('src/main.tsx', 'utf8')
  assert.match(app, /case 'systems':\s*return <SystemManagement \/>/)
  assert.doesNotMatch(app, /function SystemsPage\s*\(/)
  assert.match(main, /import '\.\/styles\/system-management.css'/)
  assert.equal(fs.readFileSync('src/shell/navigation.ts','utf8').includes("'systems'"), true)
})


test('no visible counter across default, matched, empty and cleared states', () => {
  const h = createHarness()
  for (const query of ['', 'Room', 'Payment', 'Menu', 'none-possible-99', '']) {
    h.setSearch(query)
    assertNoCounter(h)
  }
})

test('tool hover uses resortOS palette and reduced-motion safeguards without clickable semantics', () => {
  const css = fs.readFileSync('src/styles/system-management.css', 'utf8')
  const support = fs.readFileSync('src/styles/support.css', 'utf8')
  assert.match(support, /#f4f9e7/i)
  assert.match(css, /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)/)
  assert.match(css, /\.sm-tool:hover\s*\{\s*background:\s*#f4f9e7\s*;/)
  assert.match(css, /\.sm-tool\s*\{[^}]*transition:\s*background\s*\.16s ease\s*;/s)
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  assert.match(css, /\.sm-tool-link[^}]*cursor:\s*pointer/)
  const h = createHarness()
  for (const row of h.collect(node => node.props?.className === 'sm-tool')) {
    assert.equal(row.type, 'div')
    assert.equal(row.props.onClick, undefined)
    assert.equal(row.props.href, undefined)
    assert.equal(row.props.tabIndex, undefined)
    assert.equal(row.props.role, undefined)
  }
})
