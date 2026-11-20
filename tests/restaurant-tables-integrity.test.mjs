import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const prior = JSON.parse(fs.readFileSync('MENU_MANAGEMENT_CANDIDATE_INTEGRITY.json','utf8'))
const release = JSON.parse(fs.readFileSync('RESTAURANT_TABLES_PRODUCTION_INTEGRITY.json','utf8'))
const hotfix = JSON.parse(fs.readFileSync('RESTAURANT_TABLES_UI_HOTFIX_INTEGRITY.json','utf8'))
const ordersRelease = JSON.parse(fs.readFileSync('RESTAURANT_ORDERS_INTEGRATION_INTEGRITY.json','utf8'))
const require = createRequire(import.meta.url)
const { successorHash } = require('../scripts/front-desk-successor.cjs')
const protectedHash = (file, former) => {
 const change=hotfix.changes[file]
 const previous = change ? change.after : former
 if (change) assert.equal(change.before,former,`hotfix predecessor ${file}`)
 const successor = ordersRelease.changes[file]
 if (successor) assert.equal(successor.before,previous,`Orders predecessor ${file}`)
 return successorHash(file, successor?.after ?? previous)
}
const read=file=>fs.readFileSync(file,'utf8')
test('only explicitly authorized App, navigation and entrypoint bytes changed; new source is pinned',()=>{
 assert.deepEqual(Object.keys(release.modified).sort(),['src/App.tsx','src/main.tsx','src/shell/navigation.ts'])
 for (const [file,{before,after}] of Object.entries(release.modified)) {
  assert.equal(before,prior.modified[file]?.after,`predecessor ${file}`)
  assert.equal(sha(file),protectedHash(file,after),`exact authorized successor ${file}`)
 }
 for(const [file,digest] of Object.entries(release.added)) {
  assert.match(file,/^src\/features\/restaurant-tables\/[^/]+\.(ts|tsx|css)$/)
  assert.equal(sha(file),protectedHash(file,digest),`reviewed source ${file}`)
 }
 const current=fs.readdirSync('src/features/restaurant-tables').map(name=>`src/features/restaurant-tables/${name}`).sort()
 assert.deepEqual(current,[...Object.keys(release.added),...Object.keys(ordersRelease.added).filter(f=>f.startsWith('src/features/restaurant-tables/'))].sort())
})
test('previously delivered Menu Management files and physical table configuration remain exact',()=>{
 for(const [file,hash] of Object.entries(prior.added))assert.equal(sha(file),hash,file)
 const tables = JSON.parse(read('TABLES_MANAGER_APPROVED.json'))
 const require=createRequire(import.meta.url)
 const {typescriptSemanticHash}=require('../scripts/typescript-semantic.cjs')
 assert.equal(typescriptSemanticHash('src/features/tables-manager/model.ts'),tables.tablesModelHash)
 assert.equal(typescriptSemanticHash('src/features/tables-manager/TablesManager.tsx'),tables.tablesManagerHash)
 assert.equal(sha('public/assets/sidebar-coastal-approved-v058.png'),JSON.parse(read('GLOBAL_UI_HOTFIX_APPROVED.json')).protected_source['public/assets/sidebar-coastal-approved-v058.png'])
})
test('no guest counts, reservation duration inputs, prototype controls or iframe used in native feature',()=>{
 const tsx=fs.readdirSync('src/features/restaurant-tables').filter(f=>f.endsWith('.tsx'))
  .map(f=>read(`src/features/restaurant-tables/${f}`)).join('\n')
 assert.doesNotMatch(tsx,/guestCount|partySize|guest count|number of guests|duration in minutes|duration input/i)
 assert.doesNotMatch(tsx,/Review-only|Stage 3|source-derived sample|time simulation|<iframe|Recent Ended Sessions|OUR MENU|YOUR CURRENT TABLE/)
 assert.match(tsx,/Floor Plan/)
 assert.match(tsx,/Table Cards/)
 assert.match(tsx,/Upcoming Reservations/)
 assert.match(tsx,/Record Order/)
 assert.match(tsx,/Ready to Pay/)
 assert.match(tsx,/Cancel Order/)
})
