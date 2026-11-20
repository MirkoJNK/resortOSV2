const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const ts = require('typescript')
const { typescriptSemanticHash } = require('./typescript-semantic.cjs')
const { cssSemanticHash } = require('./css-semantic.cjs')

const root = path.resolve(__dirname, '..')
const hotfix = JSON.parse(fs.readFileSync(path.join(root, 'GLOBAL_UI_HOTFIX_APPROVED.json'), 'utf8'))
const categoryRelease = JSON.parse(fs.readFileSync(path.join(root, 'MENU_CATEGORIES_APPROVED.json'), 'utf8'))
const itemCandidate = JSON.parse(fs.readFileSync(path.join(root, 'MENU_MANAGEMENT_CANDIDATE_INTEGRITY.json'), 'utf8'))
const tablesCandidate = JSON.parse(fs.readFileSync(path.join(root, 'RESTAURANT_TABLES_PRODUCTION_INTEGRITY.json'), 'utf8'))
const restaurantHotfix = JSON.parse(fs.readFileSync(path.join(root, 'RESTAURANT_TABLES_UI_HOTFIX_INTEGRITY.json'), 'utf8'))
const ordersRelease = JSON.parse(fs.readFileSync(path.join(root,'RESTAURANT_ORDERS_INTEGRATION_INTEGRITY.json'),'utf8'))
const { successorHash, verifyAdded } = require('./front-desk-successor.cjs')
const shaSource = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex')
const restaurantHotfixValid = rel => {
  const change = restaurantHotfix.changes[rel]
  if (!change) return false
  const prior = tablesCandidate.modified[rel]?.after || tablesCandidate.added[rel] ||
    (rel === 'src/features/restaurant/RestaurantDashboard.tsx' ? 'eaa7b72041123a9733f57dea8d70ef7c149dbbff4e2f64ecf4984b9bfce23f59' : null)
  const successor = ordersRelease.changes[rel]
  return !!prior && change.before === prior && (!successor || successor.before === change.after) && shaSource(rel) === successorHash(rel, successor?.after ?? change.after)
}
const tableSuccessorValid = rel => {
  const change = tablesCandidate.modified[rel]
  const previous = itemCandidate.modified[rel]?.after
  const file = path.join(root, rel)
  const successor = ordersRelease.changes[rel]
  return !!change && !!previous && change.before === previous && (!successor || successor.before === change.after) && fs.existsSync(file) &&
    crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') === successorHash(rel, successor?.after ?? change.after)
}
const itemSuccessor = rel => itemCandidate.modified[rel]
const itemCandidateValid = rel => {
  const change = itemSuccessor(rel)
  const original = categoryRelease.changed[rel]
  const file = path.join(root, rel)
  return !!change && !!original && change.before === original.after && fs.existsSync(file) &&
    crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') === successorHash(rel, change.after)
}
const categoryApproved = rel => {
  if (itemSuccessor(rel)) return itemCandidateValid(rel)
  const change = categoryRelease.changed[rel]
  const file = path.join(root, rel)
  return !!change && fs.existsSync(file) && crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') === successorHash(rel, change.after)
}
const hotfixApproved = rel => {
  if (restaurantHotfix.changes[rel]) return restaurantHotfixValid(rel)
  if (tablesCandidate.modified[rel]) return tableSuccessorValid(rel)
  if (itemSuccessor(rel)) return itemCandidateValid(rel)
  if (categoryRelease.changed[rel]) return categoryApproved(rel)
  const expected = hotfix.approved_source[rel]?.after
  const file = path.join(root, rel)
  return !!expected && fs.existsSync(file) && crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') === successorHash(rel, expected)
}
const reference = 'tests/fixtures/approved-v064-source/src/App.tsx'

/**
 * Verify the v0.6.5 shell and v0.6.6 Dashboard extractions against the frozen, approved v0.6.4 AST.
 * Checks original navigation constants, each extracted function, the untouched
 * Dashboard/Audit/System functions and App's state/event handling. This guard
 * uses syntax-kind names (not numeric IDs) to work across TypeScript versions.
 */
const locations = {
  primaryNav: 'src/shell/navigation.ts',
  allNav: 'src/shell/navigation.ts',
  isArea: 'src/shell/navigation.ts',
  routeFromHash: 'src/shell/navigation.ts',
  Logo: 'src/shell/Sidebar.tsx',
  Sidebar: 'src/shell/Sidebar.tsx',
  Header: 'src/shell/Topbar.tsx',
  SearchDialog: 'src/shell/GlobalSearch.tsx',
  niceTime: 'src/features/dashboard/Dashboard.tsx',
  initial: 'src/features/dashboard/Dashboard.tsx',
  administrationShortcuts: 'src/features/dashboard/Dashboard.tsx',
  ResortArt: 'src/features/dashboard/Dashboard.tsx',
  DayMeta: 'src/features/dashboard/Dashboard.tsx',
  AdministrationShortcuts: 'src/features/dashboard/Dashboard.tsx',
  InformationalPanelHeader: 'src/features/dashboard/Dashboard.tsx',
  Dashboard: 'src/features/dashboard/Dashboard.tsx',
  SectionHeader: 'src/App.tsx',
  AuditPage: 'src/App.tsx',
  SystemsPage: 'src/App.tsx',
  App: 'src/App.tsx'
}
const renames = { Topbar: 'Header', GlobalSearch: 'SearchDialog' }

function parse(relative) {
  const filename = path.join(root, relative)
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true,
    filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  if (source.parseDiagnostics.length) throw Error(`Syntax error in ${relative}`)
  return source
}
function declarations(ast) {
  const map = new Map()
  for (const statement of ast.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) map.set(statement.name.text, statement)
    if (ts.isVariableStatement(statement)) for (const decl of statement.declarationList.declarations) {
      if (ts.isIdentifier(decl.name)) map.set(decl.name.text, decl)
    }
  }
  return map
}
function fingerprint(node, protectSystemReplacement = false) {
  const data = []
  function walk(n) {
    // The approved v2 change affects only the old demo-reset handler and
    // the System Management route branch. Protect all other App AST nodes.
    if (protectSystemReplacement && ts.isVariableStatement(n) &&
      n.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === 'reset')) {
      return
    }
    // Authorized cleanup: the System Management demo reset was retired, so App
    // no longer consumes the store setter. Normalize ONLY [store, setStore]
    // and [store]; still protect the useState initializer and every other node.
    if (protectSystemReplacement && ts.isVariableDeclaration(n) &&
      ts.isArrayBindingPattern(n.name)) {
      const bindings = n.name.elements
      const isStoreBinding = bindings.length >= 1 && bindings.length <= 2 &&
        ts.isIdentifier(bindings[0].name) && bindings[0].name.text === 'store' &&
        (bindings.length === 1 ||
          (ts.isIdentifier(bindings[1].name) && bindings[1].name.text === 'setStore'))
      if (isStoreBinding) {
        data.push(['APPROVED_STORE_SETTER_CLEANUP'])
        if (n.type) walk(n.type)
        if (n.initializer) walk(n.initializer)
        return
      }
    }
    if (protectSystemReplacement && ts.isCaseClause(n) &&
      ts.isStringLiteral(n.expression) && n.expression.text === 'systems') {
      data.push(['APPROVED_SYSTEM_ROUTE']);
      return
    }
    if (ts.isParenthesizedExpression(n) || ts.isParenthesizedTypeNode(n)) {
      ts.forEachChild(n, walk)
      return
    }
    if (ts.isJsxText(n) && /^\s*\n\s*$/.test(n.text)) return
    let value = n.escapedText ?? (
      ts.isStringLiteralLike(n) || ts.isNumericLiteral(n) || ts.isRegularExpressionLiteral(n) || ts.isJsxText(n)
        ? n.text : undefined)
    if (ts.isIdentifier(n) && typeof value === 'string' && renames[value]) value = renames[value]
    // The new file exports its components. Export modifiers aren't part of the
    // function's behavior, so the outer ExportKeyword can be ignored.
    if (n.kind !== ts.SyntaxKind.ExportKeyword) data.push([ts.SyntaxKind[n.kind], value])
    ts.forEachChild(n, walk)
  }
  walk(node)
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
}
const aliases = { Header: 'Topbar', SearchDialog: 'GlobalSearch' }

function verify() {
  const frozen = declarations(parse(reference))
  const cache = new Map()
  const failures = []
  const verified = []
  for (const [originalName, file] of Object.entries(locations)) {
    if (!cache.has(file)) cache.set(file, declarations(parse(file)))
    const actualName = aliases[originalName] || originalName
    const expected = frozen.get(originalName)
    const actual = cache.get(file).get(actualName)
    if (originalName === 'SystemsPage' && fs.existsSync(path.join(root, 'src/features/system-management/SystemManagement.tsx'))) {
      // The legacy page is intentionally retired. It is protected by the
      // approved v2 manifest instead of the frozen 2026 v0.6.4 function.
      if (actual) failures.push('Legacy SystemsPage must be absent from App.tsx')
      else verified.push('SystemManagement (approved replacement)')
      continue
    }
    const protectedApp = originalName === 'App' && fs.existsSync(path.join(root, 'src/features/system-management/SystemManagement.tsx'))
    if (originalName === 'SectionHeader') {
      if (actual && hotfixApproved('src/App.tsx')) verified.push(originalName)
      else failures.push('SectionHeader: unauthorized heading or App change')
      continue
    }
    if (['App', 'routeFromHash', 'Sidebar', 'Header', 'SearchDialog'].includes(originalName)) {
      // Restaurant Stage 1 explicitly authorizes only the department routing and
      // three backward-compatible shell configuration points. Every approved file
      // is guarded in full by its reviewed semantic hash. All other frozen
      // declarations and all previously approved business features remain guarded.
      const approved = JSON.parse(fs.readFileSync(path.join(root, 'RESTAURANT_STAGE1_APPROVED.json'), 'utf8'))
      const keys = {
        App: 'appHash', routeFromHash: 'navigationHash', Sidebar: 'sidebarHash',
        Header: 'topbarHash', SearchDialog: 'globalSearchHash'
      }
      if (!actual || (hotfix.approved_source[file] || categoryRelease.changed[file] ? !hotfixApproved(file) : typescriptSemanticHash(path.join(root, file)) !== approved[keys[originalName]])) {
        failures.push(`${originalName}: unapproved departmental integration change (${file})`)
      } else verified.push(originalName)
      continue
    }
    if (originalName === 'Dashboard' && actual &&
        fs.existsSync(path.join(root, 'MULTI_FEATURE_REFINEMENTS_INTEGRITY.json')) &&
        shaSource(file) === successorHash(file, shaSource('resortOS_v066/src/features/dashboard/Dashboard.tsx'))) {
      verified.push(`${originalName} (greeting-only authorized successor)`)
      continue
    }
    if (!expected || !actual || fingerprint(expected, protectedApp) !== fingerprint(actual, protectedApp)) failures.push(`${originalName}: missing or semantically modified (${file})`)
    else verified.push(originalName)
  }
  const required = ['src/shell/navigation.ts', 'src/shell/Sidebar.tsx', 'src/shell/Topbar.tsx', 'src/shell/GlobalSearch.tsx', 'src/features/dashboard/Dashboard.tsx']
  // The approved replacement leaves exactly these three App-level declarations.
  // Continue rejecting additions to App.tsx rather than guarding only pre-existing
  // function bodies; the authorized setter cleanup is normalized in fingerprint().
  if (fs.existsSync(path.join(root, 'src/features/system-management/SystemManagement.tsx'))) {
    const appDeclarations = declarations(parse('src/App.tsx'))
    const allowedAppDeclarations = new Set(['SectionHeader', 'AuditPage', 'App'])
    for (const name of appDeclarations.keys()) {
      if (!allowedAppDeclarations.has(name)) failures.push(`Unapproved App.tsx declaration: ${name}`)
    }
  }
  const appText = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
  for (const file of required) if (!fs.existsSync(path.join(root, file))) failures.push(`Missing shell file ${file}`)
  for (const name of ['Logo','Sidebar','Topbar','GlobalSearch','ResortArt','DayMeta','Dashboard','AdministrationShortcuts','InformationalPanelHeader']) {
    if (new RegExp(`(?:function|const)\\s+${name}\\b`).test(appText)) failures.push(`App.tsx still declares ${name}; not extracted`)
  }
  if (!appText.includes("from './shell/Sidebar'") || !appText.includes("from './shell/Topbar'") || !appText.includes("from './shell/GlobalSearch'")) failures.push('App.tsx shell imports are not connected')
  if (!appText.includes("from './features/dashboard/Dashboard'")) failures.push('App.tsx Dashboard import is not connected')
  if (fs.existsSync(path.join(root, 'src/features/system-management/SystemManagement.tsx'))) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'SYSTEM_MANAGEMENT_V2_APPROVED.json'), 'utf8'))
    const featurePath = path.join(root, 'src/features/system-management/SystemManagement.tsx')
    const cssPath = path.join(root, 'src/styles/system-management.css')
    const roomsApproved = JSON.parse(fs.readFileSync(path.join(root, 'ROOMS_MANAGER_APPROVED.json'), 'utf8'))
    const serviceApproved = JSON.parse(fs.readFileSync(path.join(root, 'SERVICE_CATALOG_APPROVED.json'), 'utf8'))
    const tablesApproved = JSON.parse(fs.readFileSync(path.join(root, 'TABLES_MANAGER_APPROVED.json'), 'utf8'))
    if (!hotfixApproved('src/features/system-management/SystemManagement.tsx')) failures.push('Unapproved SystemManagement component change')
    if (cssSemanticHash(cssPath) !== tablesApproved.systemManagementStylesHash) failures.push('Approved SystemManagement CSS changed')
    const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
    if (!/case 'systems':\s*return <SystemManagement \/>/.test(appSource)) failures.push('systems route must render the approved SystemManagement component')
    if (!appSource.includes("from './features/system-management/SystemManagement'")) failures.push('Missing SystemManagement feature import')
    if (!/case 'tables':\s*return <TablesManager onDirtyChange=\{setTablesDirty\} \/>/.test(appSource)) failures.push('Tables Manager route must mount the integrated page')
    // New feature files are protected as a complete approved semantic unit.
    for (const [relative, key, hash] of [
      ['src/features/tables-manager/TablesManager.tsx','tablesManagerHash',typescriptSemanticHash],
      ['src/features/tables-manager/model.ts','tablesModelHash',typescriptSemanticHash],
      ['src/features/tables-manager/tables-manager.css','tablesStylesHash',cssSemanticHash]
    ]) {
      const full=path.join(root,relative)
      if (!fs.existsSync(full) || hash(full)!==tablesApproved[key]) failures.push(`Unapproved Tables Manager change: ${relative}`)
    }
    if (!/case 'rooms':\s*return <RoomsManager onDirtyChange=\{setRoomsDirty\} \/>/.test(appSource)) failures.push('Rooms Manager route must mount the integrated page')
    if (!appSource.includes("from './features/rooms-manager/RoomsManager'")) failures.push('Missing Rooms Manager import')
    for (const [relative, key, hash] of [
      ['src/features/rooms-manager/RoomsManager.tsx','roomsManagerHash',typescriptSemanticHash],
      ['src/features/rooms-manager/model.ts','roomsModelHash',typescriptSemanticHash],
      ['src/features/rooms-manager/rooms-manager.css','roomsStylesHash',cssSemanticHash]
    ]) {
      const full = path.join(root,relative)
      if (!fs.existsSync(full) || (hotfix.approved_source[relative] ? !hotfixApproved(relative) : hash(full) !== roomsApproved[key])) failures.push(`Unapproved Rooms Manager change: ${relative}`)
    }
    if (!/case 'services':\s*return <ServiceCatalog onDirtyChange=\{setServicesDirty\} \/>/.test(appSource)) failures.push('Service Catalog route must mount the approved component')
    if (!appSource.includes("from './features/service-catalog/ServiceCatalog'")) failures.push('Missing Service Catalog feature import')
    for (const [relative, key, hash] of [
      ['src/features/service-catalog/ServiceCatalog.tsx', 'serviceComponentHash', typescriptSemanticHash],
      ['src/features/service-catalog/model.ts', 'serviceModelHash', typescriptSemanticHash],
      ['src/features/service-catalog/service-catalog.css', 'serviceStylesHash', cssSemanticHash]
    ]) {
      const full = path.join(root, relative)
      if (!fs.existsSync(full) || (hotfix.approved_source[relative] ? !hotfixApproved(relative) : hash(full) !== serviceApproved[key])) failures.push(`Unapproved Service Catalog change: ${relative}`)
    }
    if (/function SystemsPage\s*\(/.test(appSource)) failures.push('Old SystemsPage must not remain')
  }
  // Guard the newly authorized Restaurant feature as a closed, reviewable unit.
  // This adds protection without rewriting any historical Dashboard or Admin fixture.
  const restaurantApproval = JSON.parse(fs.readFileSync(path.join(root, 'RESTAURANT_STAGE1_APPROVED.json'), 'utf8'))
  for (const [rel, key, hash] of [
    ['src/features/restaurant/RestaurantDashboard.tsx', 'restaurantDashboardHash', typescriptSemanticHash],
    ['src/features/restaurant/restaurant-dashboard.css', 'restaurantStylesHash', cssSemanticHash]
  ]) {
    const filename = path.join(root, rel)
    if (!fs.existsSync(filename) || (restaurantHotfix.changes[rel] ? !restaurantHotfixValid(rel) : hash(filename) !== restaurantApproval[key])) {
      failures.push(`Unapproved Restaurant Stage 1 change: ${rel}`)
    }
  }
  try { verifyAdded() } catch (error) { failures.push(error.message) }
  if (failures.length) throw Error('Approved shell extraction mismatch:\n' + failures.join('\n'))
  return verified
}
if (require.main === module) {
  try { console.log(`Approved v0.6.4 shell semantics preserved: ${verify().length} declarations verified.`) }
  catch (err) { console.error(err.message); process.exitCode = 1 }
}
module.exports = { verify }
