import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('typescript')
const manifest=JSON.parse(fs.readFileSync('MENU_CATEGORIES_APPROVED.json','utf8'))
const itemsRelease=JSON.parse(fs.readFileSync('MENU_MANAGEMENT_CANDIDATE_INTEGRITY.json','utf8'))
const tablesRelease=JSON.parse(fs.readFileSync('RESTAURANT_TABLES_PRODUCTION_INTEGRITY.json','utf8'))
const restaurantHotfix=JSON.parse(fs.readFileSync('RESTAURANT_TABLES_UI_HOTFIX_INTEGRITY.json','utf8'))
const ordersRelease=JSON.parse(fs.readFileSync('RESTAURANT_ORDERS_INTEGRATION_INTEGRITY.json','utf8'))
const { successorHash } = require('../scripts/front-desk-successor.cjs')
const pinned=(file,previous)=>{const change=restaurantHotfix.changes[file];if(change)assert.equal(change.before,previous,`Restaurant UI hotfix predecessor: ${file}`);const predecessor=change?.after ?? previous;const next=ordersRelease.changes[file];if(next)assert.equal(next.before,predecessor,`Restaurant Orders predecessor: ${file}`);assert.equal(sha(file),successorHash(file, next?.after ?? predecessor),file)}
const unchangedOrSuccessor=(file,expected)=>{
 const tableChange=tablesRelease.modified[file]
 if(tableChange){assert.equal(tableChange.before,itemsRelease.modified[file]?.after ?? expected,`Restaurant Tables predecessor: ${file}`);pinned(file,tableChange.after);return}
 const successor=itemsRelease.modified[file]
 if(successor){assert.equal(successor.before,expected,`Menu Management predecessor: ${file}`);pinned(file,successor.after)}
 else pinned(file,expected)
}
const sha=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')
const app=fs.readFileSync('src/App.tsx','utf8')
const nav=fs.readFileSync('src/shell/navigation.ts','utf8')
const list=fs.readFileSync('src/features/menu-categories/MenuCategories.tsx','utf8')
const storage=fs.readFileSync('src/features/menu-categories/storage.ts','utf8')
const image=fs.readFileSync('src/features/menu-categories/images.ts','utf8')

test('all newly approved source files are pinned and every other source and asset stays byte-identical',()=>{
 assert.equal(Object.keys(manifest.changed).length,4)
 assert.equal(Object.keys(manifest.added).length,5)
 assert.ok(Object.keys(manifest.protected).length>=50)
 for(const [file,item] of Object.entries(manifest.changed)){assert.match(item.before,/^[0-9a-f]{64}$/);unchangedOrSuccessor(file,item.after)}
 for(const [file,hash] of Object.entries(manifest.added))unchangedOrSuccessor(file,hash)
 for(const [file,hash] of Object.entries(manifest.protected))unchangedOrSuccessor(file,hash)
})
test('nested route is scoped to Administration and honors existing unsaved guards',()=>{
 assert.match(nav,/systems\/menu-categories/)
 assert.match(app,/case 'menu-categories':\s*return <MenuCategories onDirtyChange=\{setCategoriesDirty\} \/>/)
 assert.match(app,/area === 'menu-categories' && next !== 'menu-categories' && categoriesDirty/)
 assert.match(app,/Discard unsaved category changes/)
 for(const s of ['tablesDirty','roomsDirty','servicesDirty','restaurant-dashboard'])assert.ok(app.includes(s),s)
})
test('Menu Categories remains live alongside the authorized Menu Management route',()=>{
 const sm=fs.readFileSync('src/features/system-management/SystemManagement.tsx','utf8')
 assert.match(sm,/tool.id === 'menu-categories'/)
 assert.match(sm,/#systems\/menu-categories/)
 assert.match(sm,/tool.id === 'tables'/)
 assert.match(sm,/tool.id === 'rooms'/)
 assert.match(sm,/tool.id === 'services'/)
 assert.match(sm,/tool.id === 'menu'/)
 assert.match(sm,/#systems\/menu/)
 assert.match(sm,/#systems\/payment-methods/)
 for(const id of ['discounts','receipt-settings','receipt-builder','employees','roles'])assert.doesNotMatch(sm,new RegExp(`tool\\.id === '${id}'`))
})
test('Menu Categories toolbar directly reuses approved Rooms Manager design classes',()=>{
 for(const c of ['rm-toolbar','rm-search','rm-b-tabs','rm-b-tab','rm-select','rm-btn rm-btn-primary','rm-btn rm-btn-small','rm-modal-shade','rm-modal rm-confirm']) assert.ok(list.includes(c),c)
 assert.match(list,/Menu Categories/);assert.match(list,/Manage restaurant menu categories/)
 assert.doesNotMatch(list,/Administration<\/p>|Category code|Category description|Delete Category|canvas.*water/i)
})
test('sort, drag and accessible buttons use the same model and do not reorder filtered searches',()=>{
 assert.match(list,/sort === 'custom' && status === 'all' && !query.trim\(\)/)
 assert.match(list,/onPointerDown=\{event => onPointerStart/)
 assert.match(list,/onPointerCancel=\{onPointerCancel\}/)
 assert.match(list,/Move .* up/)
 assert.match(list,/Move .* down/)
 assert.match(list,/const changed = moveCategory\(categories, id, to\)/)
})
test('IndexedDB has separate category/image stores with atomic writes and no localStorage',()=>{
 for(const s of ['indexedDB.open','transaction([CATEGORIES, IMAGES, META]','Category image data','images.clear()','records.clear()','await done'])assert.ok(storage.includes(s.replace('Category image data','Saved category image data')),s)
 assert.doesNotMatch(storage,/localStorage/)
})
test('image processing uses content detection, decode, resizing and bounded Blob output',()=>{
 for(const s of ['detectImageType','createImageBitmap','MAX_IMAGE_BYTES','MAX_SIDE','MAX_OUTPUT_BYTES','canvas.toBlob','bitmap.close()'])assert.ok(image.includes(s),s)
 assert.match(image,/image\/jpeg/);assert.match(image,/image\/png/);assert.match(image,/image\/webp/)
})
test('feature honors one-time entrance motion and approved responsive toolbar geometry',()=>{
 const css=fs.readFileSync('src/features/menu-categories/menu-categories.css','utf8')
 assert.match(css,/\.mc-page \.mc-heading/);assert.match(css,/\.mc-page \.mc-toolbar/);assert.match(css,/\.mc-page \.mc-results-stage/)
 assert.match(css,/animation-delay: 55ms/);assert.match(css,/animation-delay: 110ms/);assert.match(css,/prefers-reduced-motion:reduce/)
 assert.match(css,/grid-template-columns/);assert.match(css,/@media\(max-width: 480px\)/)
})
test('all new TypeScript and JSX source parses without syntax errors',()=>{
 for(const file of [...Object.keys(manifest.added),...Object.keys(manifest.changed)].filter(p=>/\.tsx?$/.test(p))){
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  assert.equal(ast.parseDiagnostics.length,0,file)
 }
})
