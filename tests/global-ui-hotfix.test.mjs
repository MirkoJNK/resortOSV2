import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const read = file => fs.readFileSync(file, 'utf8')
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const approved = JSON.parse(read('GLOBAL_UI_HOTFIX_APPROVED.json'))
const menuRelease = JSON.parse(read('MENU_CATEGORIES_APPROVED.json'))
const itemsRelease = JSON.parse(read('MENU_MANAGEMENT_CANDIDATE_INTEGRITY.json'))
const tablesRelease = JSON.parse(read('RESTAURANT_TABLES_PRODUCTION_INTEGRITY.json'))
const restaurantHotfix = JSON.parse(read('RESTAURANT_TABLES_UI_HOTFIX_INTEGRITY.json'))
const ordersRelease = JSON.parse(read('RESTAURANT_ORDERS_INTEGRATION_INTEGRITY.json'))
const { successorHash } = require('../scripts/front-desk-successor.cjs')
const hotfixPinned = (file,previous) => { const change=restaurantHotfix.changes[file];if(change)assert.equal(change.before,previous,`restaurant hotfix predecessor ${file}`);const predecessor=change?.after ?? previous;const next=ordersRelease.changes[file];if(next)assert.equal(next.before,predecessor,`Orders predecessor ${file}`);assert.equal(sha(file),successorHash(file, next?.after ?? predecessor),file) }
const currentPinned = (file, prior) => {
 const latest=tablesRelease.modified[file]
 if(latest){assert.equal(latest.before,itemsRelease.modified[file]?.after ?? prior,`Restaurant Tables predecessor: ${file}`);hotfixPinned(file,latest.after);return}
 const change = itemsRelease.modified[file]
 if (change) { assert.equal(change.before, prior, `Menu Management predecessor: ${file}`); hotfixPinned(file, change.after) }
 else hotfixPinned(file, prior)
}
const top = read('src/shell/Topbar.tsx')
const sidebar = read('src/shell/Sidebar.tsx')
const work = read('src/shell/WorkspaceSwitcher.tsx')
const rooms = read('src/features/rooms-manager/RoomsManager.tsx')
const services = read('src/features/service-catalog/ServiceCatalog.tsx')

test('every authorized file and all frozen source and assets match exact pinned release hashes', () => {
 for (const [file, record] of Object.entries(approved.approved_source)) {
   const successor = menuRelease.changed[file]
   if (successor) { assert.equal(successor.before, record.after, `prior hotfix pin: ${file}`); currentPinned(file, successor.after) }
   else currentPinned(file, record.after)
 }
 for (const [file, hash] of Object.entries(approved.protected_source)) {
   const successor = menuRelease.changed[file]
   if (successor) { assert.equal(successor.before, hash, `protected baseline: ${file}`); currentPinned(file, successor.after) }
   else currentPinned(file, hash)
 }
 assert.ok(Object.keys(approved.protected_source).length >= 45)
})
test('profile is accessible display-only and keeps search bell help controls', () => {
 assert.match(top, /ros-profile-avatar/);assert.match(top, /ros-profile-name/)
 for (const s of ['Demo Administrator','Demo Restaurant',"'DA'","'DR'",'global-search','header-circle notification','Help unavailable']) assert.ok(top.includes(s),s)
 assert.doesNotMatch(top, /onClick.*switch|onDepartmentChange|accountOpen|user-select/)
})
test('workspace switcher is separate, navigable, and URL-driven through App route guard', () => {
 const app=read('src/App.tsx')
 assert.doesNotMatch(sidebar, /<WorkspaceSwitcher/)
 assert.match(top, /<WorkspaceSwitcher/)
 assert.match(work, /aria-haspopup="menu"/);assert.match(work, /onSwitch\(next\)/)
 assert.match(work, /document.addEventListener\('pointerdown'/)
 assert.match(work, /Escape/);assert.match(work, /ArrowDown/);assert.match(work, /ArrowUp/)
 assert.match(app, /onWorkspaceChange=\{switchDepartment\}/)
 for (const word of ['tablesDirty', 'roomsDirty','servicesDirty', 'hashForRoute\(a\)']) assert.ok(app.includes(word.replaceAll('\\','')),word)
})
test('page eyebrow is gone only from title headers; other Administration labels preserved', () => {
 for(const file of ['src/App.tsx','src/components/SupportWorkspace.tsx','src/features/system-management/SystemManagement.tsx']) assert.doesNotMatch(read(file), /<p>Administration<\/p>/,file)
 assert.match(read('src/features/dashboard/Dashboard.tsx'),/Administration shortcuts/)
 assert.match(work,/Administration/)
})
test('Rooms and Services deactivation dialogs use the exact approved wording and shared room modal classes',()=>{
 assert.match(rooms,/Deactivate' : 'Reactivate'/)
 assert.doesNotMatch(rooms,/Deactivate room' : 'Reactivate room'/)
 assert.match(rooms,/Deactivate' : 'Reactivate'/)
 for(const text of ['rm-modal-shade','rm-modal rm-confirm','rm-modal-head','rm-confirm-body','rm-form-actions','rm-btn-danger','Close dialog','Deactivate “']) assert.ok(services.includes(text),text)
 assert.match(services,/aria-labelledby="sc-confirm-title"/)
 assert.match(services,/document.addEventListener\('keydown'/)
 assert.doesNotMatch(services,/Delete Service|Deactivate service\?/)
})
test('TypeScript parses all changed TS/TSX source files without syntax diagnostics',()=>{
 for(const f of Object.keys(approved.approved_source).filter(f=>/\.tsx?$/.test(f))) {
  const parsed=ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  assert.equal(parsed.parseDiagnostics.length,0,f)
 }
})
test('no financial logic or Admin dashboard assets were changed by the UI hotfix',()=>{
 const preserved=approved.protected_source
 for(const path of ['src/features/dashboard/Dashboard.tsx','src/features/rooms-manager/model.ts','src/features/service-catalog/model.ts','src/features/tables-manager/TablesManager.tsx','public/assets/sidebar-coastal-approved-v058.png']) assert.equal(sha(path),successorHash(path,preserved[path]),path)
 assert.match(read('src/features/dashboard/Dashboard.tsx'),/Good morning, Admin/)
})
