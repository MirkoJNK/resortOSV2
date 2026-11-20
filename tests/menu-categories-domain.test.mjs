import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const compiled = file => ts.transpileModule(fs.readFileSync(file,'utf8'), {fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
function load(file, libs={}) {
 const m={exports:{}}
 const ctx={module:m,exports:m.exports,crypto:{randomUUID:()=> 'new-category'},Intl,Date,Blob,Uint8Array,String,Set,Map,Number,Error,Array,RegExp,...libs}
 vm.runInNewContext(`(function(require,module,exports){${compiled(file)}\n})`,ctx,{filename:file})(name=>{throw Error('Unexpected dependency '+name)},m,m.exports)
 return m.exports
}
const m=load('src/features/menu-categories/model.ts')
const images=load('src/features/menu-categories/images.ts')
const sample=()=>m.sampleCategories.map(c=>({...c}))
const plain=value=>JSON.parse(JSON.stringify(value))

test('seed is seven uniquely identified active flat categories with deterministic custom order',()=>{
 const cats=sample();assert.equal(cats.length,7);assert.deepEqual([...cats.map(c=>c.name)],['Appetizers','Main Dishes','Noodles','Desserts','Beverages','Seafood','Breakfast']);
 assert.equal(new Set(cats.map(c=>c.id)).size,7);assert.deepEqual([...cats.map(c=>c.order)],[0,1,2,3,4,5,6]);assert.ok(cats.every(c=>c.active&&c.imageId===null));assert.ok(m.validCategories(cats))
})
test('name normalization trims, folds repeated spaces and handles unicode case',()=>{
 assert.equal(m.cleanCategoryName('  Main   Dishes  '),'Main Dishes');assert.equal(m.normalizedCategoryName('  NOODLES  '),'noodles');
 assert.equal(m.categoryNameError('   ',sample()),'Enter a category name');
 assert.equal(m.categoryNameError('x'.repeat(61),sample()),'Use 60 characters or fewer')
})
test('duplicates are rejected against all records, including inactive and normalized whitespace',()=>{
 const cats=sample();cats[2].active=false
 for(const value of ['noodles',' NOODLES ','NoOdLeS']) assert.match(m.categoryNameError(value,cats),/already exists/)
 assert.match(m.categoryNameError(' Main    Dishes  ',cats),/already exists/)
 assert.equal(m.categoryNameError('NEW category',cats),null)
})
test('new category appends, normalizes, starts active and retains provided immutable identity',()=>{
 const original=sample();const next=m.addCategory(original,'  New    Category  ',null,'2026-11-09T09:00:00.000Z','id-300')
 assert.equal(original.length,7);assert.equal(next.length,8);assert.deepEqual(plain(next[7]),{id:'id-300',name:'New Category',imageId:null,order:7,active:true,createdAt:'2026-11-09T09:00:00.000Z',updatedAt:'2026-11-09T09:00:00.000Z'});assert.ok(m.validCategories(next))
})
test('existing identity, original timestamp and order survive a rename and new image',()=>{
 const a=sample(), old=a[2]
 const next=m.editCategory(a,old.id,'Noodle Dishes','image-123','2026-11-09T10:00:00Z')
 assert.equal(next[2].id,old.id);assert.equal(next[2].createdAt,old.createdAt);assert.equal(next[2].order,old.order)
 assert.equal(next[2].imageId,'image-123');assert.equal(next[2].updatedAt,'2026-11-09T10:00:00Z');assert.equal(a[2].name,'Noodles')
})
test('no-op edit preserves update timestamp; missing target edit does not create records',()=>{
 const a=sample();assert.equal(m.editCategory(a,a[0].id,a[0].name,a[0].imageId)[0].updatedAt,a[0].updatedAt)
 assert.throws(()=>m.editCategory(a,'missing','New',null),/no longer exists/)
})
test('new creation and edit validate duplicate names before any mutation',()=>{
 const a=sample();assert.throws(()=>m.addCategory(a,' noodles ',null),/already exists/)
 assert.throws(()=>m.editCategory(a,a[0].id,'beverages',null),/already exists/)
 assert.equal(a[0].name,'Appetizers')
})
test('deactivation/reactivation maintains identity, image and custom order',()=>{
 const a=sample();a[0].imageId='image-x';const off=m.flipCategoryStatus(a,a[0].id,'2026-11-09T10:00:00Z')
 assert.equal(off[0].active,false);assert.equal(off[0].imageId,'image-x');assert.equal(off[0].order,0)
 assert.equal(off[0].createdAt,a[0].createdAt);assert.equal(m.flipCategoryStatus(off,a[0].id)[0].active,true)
 assert.equal(a[0].active,true);assert.throws(()=>m.flipCategoryStatus(a,'absent'),/no longer exists/)
})
test('all custom ordering, name sorting and status filtering preserve the saved array',()=>{
 const a=sample();a[3].active=false
 assert.deepEqual(plain(m.selectCategories(a,'','all','custom').map(c=>c.name)),plain(a.map(c=>c.name)))
 assert.deepEqual(plain(m.selectCategories(a,'','all','az').map(c=>c.name).slice(0,2)),['Appetizers','Beverages'])
 assert.equal(m.selectCategories(a,' dessert ','inactive','custom').length,1)
 assert.equal(m.selectCategories(a,'','active','custom').length,6)
 assert.deepEqual([...a.map(c=>c.order)],[0,1,2,3,4,5,6])
})
test('Move Up, Move Down and drag destination share one reorder function',()=>{
 const a=sample();const next=m.moveCategory(a,a[4].id,0,'2026-11-09T10:00:00Z')
 assert.deepEqual([...next.map(c=>c.name)].slice(0,3),['Beverages','Appetizers','Main Dishes'])
 assert.ok(m.validCategories(next));assert.deepEqual([...next.map(c=>c.order)],[0,1,2,3,4,5,6])
 const back=m.moveCategory(next,a[4].id,4)
 assert.deepEqual(plain(back.map(c=>c.id)),plain(a.map(c=>c.id)));assert.equal(a[4].order,4)
})
test('reordering preserves image references and inactive lifecycle without mutation',()=>{
 const a=sample();a[1].active=false;a[1].imageId='image-2'
 const b=m.moveCategory(a,a[1].id,5)
 assert.equal(b.find(c=>c.id===a[1].id).imageId,'image-2');assert.equal(b.find(c=>c.id===a[1].id).active,false)
 assert.equal(a[1].order,1)
 assert.equal(m.moveCategory(a,'absent',0),a);assert.equal(m.moveCategory(a,a[0].id,-1),a);assert.equal(m.moveCategory(a,a[0].id,0),a)
})
test('stored directory rejects corrupt IDs, timestamps, names and order gaps',()=>{
 const invalid = mutator => { const rows=sample();mutator(rows);assert.equal(m.validCategories(rows),false) }
 invalid(rows=>rows[2].id=rows[1].id);invalid(rows=>rows[2].name='NOODLES ')
 invalid(rows=>rows[2].name='beverages');invalid(rows=>rows[2].order=9)
 invalid(rows=>rows[2].order=rows[1].order);invalid(rows=>rows[2].createdAt='not-date')
 invalid(rows=>rows[2].imageId=99);invalid(rows=>rows[2].active='yes')
 invalid(rows=>rows[2].unknown='field')
})
test('stored empty directory is valid and does not imply automatic reseeding',()=>{
 assert.equal(m.validCategories([]),true)
})
test('JPEG, PNG and WebP signatures are detected independent of extensions',()=>{
 assert.equal(images.detectImageType(Uint8Array.from([255,216,255,0,0,0,0,0,0,0,0,0])),'image/jpeg')
 assert.equal(images.detectImageType(Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0])),'image/png')
 assert.equal(images.detectImageType(Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80])),'image/webp')
 assert.equal(images.detectImageType(Uint8Array.from([60,115,118,103,0,0,0,0,0,0,0,0])),null)
 assert.equal(images.detectImageType(Uint8Array.from([71,73,70,56,57,97,0,0,0,0,0,0])),null)
})
test('image input checks true signatures, MIME mismatch and 5MB policy',async()=>{
 const make=(contents,type)=>new Blob([contents],{type})
 const jpeg=Uint8Array.from([255,216,255,0,0,0,0,0,0,0,0,0]);const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0])
 assert.equal(await images.inspectImage(make(jpeg,'image/jpeg')),'image/jpeg')
 assert.equal(await images.inspectImage(make(png,'image/png')),'image/png')
 await assert.rejects(images.inspectImage(make(jpeg,'image/png')),/does not match/)
 await assert.rejects(images.inspectImage(make('<svg><script>','image/svg+xml')),/not a supported/)
 await assert.rejects(images.inspectImage(make(new Uint8Array(6*1024*1024),'image/jpeg')),/under 5 MB/)
})
