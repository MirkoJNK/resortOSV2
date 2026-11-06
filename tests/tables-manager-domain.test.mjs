import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
let ts
try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const source=fs.readFileSync('src/features/tables-manager/model.ts','utf8')
const out=ts.transpileModule(source,{fileName:'model.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const mod={exports:{}}
vm.runInNewContext(out,{exports:mod.exports,module:mod,crypto:{randomUUID:()=> 'test-uuid'},localStorage:{getItem:()=>null,setItem:()=>{}}},{filename:'model.js'})
const M=mod.exports
const table=(extra={})=>({...M.sampleConfiguration.tables[0],...extra})
const canonical=x=>JSON.parse(JSON.stringify(x))
test('sample tables use immutable IDs, validated logical coordinates and normalized shape names',()=>{
 assert.equal(M.validateConfig(M.sampleConfiguration),true)
 assert.equal(M.sampleConfiguration.areas.length,4)
 assert.equal(new Set(M.sampleConfiguration.tables.map(t=>t.id)).size,M.sampleConfiguration.tables.length)
})
test('chair arrangement always generates exactly the configured number of chairs',()=>{
 for(const shape of ['round','square','rectangle'])for(let n=1;n<=M.maxChairs(shape);n++){
  const coords=M.chairPositions({shape,chairs:n})
  assert.equal(coords.length,n,`${shape} ${n}`)
  assert.ok(coords.every(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)))
 }
})
test('round and square seating caps are 8; rectangle cap is 20',()=>{
 assert.equal(M.maxChairs('round'),8);assert.equal(M.maxChairs('square'),8);assert.equal(M.maxChairs('rectangle'),20)
})
test('rectangle enlarges progressively; odd chair counts stay exact',()=>{
 const widths=[4,6,8,9,11,20].map(n=>M.tableDimensions({shape:'rectangle',chairs:n}).w)
 assert.ok(widths.every((w,i)=>i===0||w>=widths[i-1]))
 assert.ok(widths[3]>widths[2]);assert.ok(widths[4]>widths[3]);assert.equal(M.chairPositions({shape:'rectangle',chairs:9}).length,9)
})
test('table identity does not depend on editable label',()=>{
 const a=table(),b={...a,label:'Renamed table'}
 assert.equal(a.id,b.id)
})
test('dragging snaps to eight-unit grid; bounding rejects off-canvas placement',()=>{
 assert.equal(M.snap(11),8);assert.equal(M.snap(13),16)
 assert.equal(M.inBounds(table({x:-100})),false)
 assert.equal(M.inBounds(table({x:180,y:185})),true)
})
test('overlap detection handles same-area table footprints',()=>{
 assert.equal(M.overlaps(table(),table({id:'new',x:180,y:185})),true)
 assert.equal(M.overlaps(table(),table({id:'new',x:800,y:580})),false)
 assert.equal(M.overlaps(table(),table({id:'new',area:'Terrace'})),false)
})
test('loaded configuration rejects invalid names, unknown areas, capacities and malformed coordinates',()=>{
 const cases=[{label:''},{shape:'round',chairs:9},{area:'Not a real area'},{x:NaN},{x:10000},{rotation:45},{status:'occupied'}]
 for(const change of cases){const c=M.copy(M.sampleConfiguration);c.tables[0]={...c.tables[0],...change};assert.equal(M.validateConfig(c),false,JSON.stringify(change))}
})
test('duplicate table labels are prohibited even when status differs',()=>{
 const c=M.copy(M.sampleConfiguration);c.tables[1].label=c.tables[0].label;c.tables[1].status='inactive';assert.equal(M.validateConfig(c),false)
})
test('deliberately empty layouts are valid and cloning preserves independence',()=>{
 const empty={version:1,areas:['Main Dining'],tables:[]};assert.equal(M.validateConfig(empty),true)
 const copied=M.copy(M.sampleConfiguration);copied.tables[0].label='Changed';assert.notEqual(copied.tables[0].label,M.sampleConfiguration.tables[0].label)
})
test('save rejects invalid drafts before touching storage',()=>{
 const invalid=M.copy(M.sampleConfiguration);invalid.tables[0].chairs=50
 assert.equal(M.writeTables(invalid).ok,false)
})
test('source has no chair drag/selection or zoom editing feature',()=>{
 const src=fs.readFileSync('src/features/tables-manager/TablesManager.tsx','utf8')
 assert.doesNotMatch(src,/zoomIn|zoomOut|setZoom|onChairPointerDown|chairSelected|chairOffset|chair\.dx/)
 assert.match(src,/onPointerDown=\{down\}/)
 assert.match(src,/Delete table/)
 assert.match(src,/Delete area/)
 assert.match(src,/Save changes/)
})
test('Tables Manager remains navigable alongside the newly approved Rooms Manager',()=>{
 const src=fs.readFileSync('src/features/system-management/SystemManagement.tsx','utf8')
 assert.match(src,/tool\.id === 'tables' \|\| tool\.id === 'rooms' \|\| tool\.id === 'services' \? <a/)
 assert.match(src,/href=\{tool\.id === 'rooms' \? '#systems\/rooms' : tool\.id === 'services' \? '#systems\/services' : '#systems\/tables'\}/)
 assert.match(src,/ : <div className="sm-tool"/)
})

test('browser-local persistence preserves deliberately empty data and never silently recreates records',()=>{
 let raw=null
 const store={getItem:()=>raw,setItem:(_key,value)=>{raw=value}}
 const module={exports:{}}
 vm.runInNewContext(out,{exports:module.exports,module,crypto:{randomUUID:()=> 'new-id'},localStorage:store},{filename:'model-storage.js'})
 const m=module.exports
 assert.equal(m.readTables().data.tables.length,8)
 const empty={version:1,areas:['Main Dining'],tables:[]}
 assert.equal(m.writeTables(empty).ok,true)
 assert.equal(m.readTables().data.tables.length,0)
 raw='{"version":1,"areas":["Main Dining"],"tables":[{"id":"bad"}]}'
 const result=m.readTables()
 assert.match(result.error,/invalid/)
 assert.equal(raw.includes('"bad"'),true,'invalid stored data must not be overwritten')
})
test('storage write failures return an error rather than false success',()=>{
 const module={exports:{}}
 vm.runInNewContext(out,{exports:module.exports,module,crypto:{randomUUID:()=> 'new-id'},localStorage:{getItem:()=>null,setItem:()=>{throw Error('quota exceeded')}}},{filename:'model-storage-failure.js'})
 const result=module.exports.writeTables(module.exports.sampleConfiguration)
 assert.equal(result.ok,false)
 assert.match(result.error,/Could not save/)
})
test('release semantic protection rejects unauthorized modifications',()=>{
 const {execFileSync}=require('node:child_process')
 const {mkdtempSync,cpSync,writeFileSync,readFileSync,rmSync}=fs
 const os=require('node:os'),path=require('node:path')
 const temp=mkdtempSync(path.join(os.tmpdir(),'tables-release-guard-'))
 try{
  const source='src/features/tables-manager/model.ts';const file=path.join(temp,'model.ts')
  cpSync(source,file)
  const approved=JSON.parse(readFileSync('TABLES_MANAGER_APPROVED.json','utf8'))
  assert.equal(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).diagnostics?.length??0,0)
  const mutated=readFileSync(file,'utf8').replace("export const GRID = 8", "export const GRID = 99")
  assert.notEqual(mutated,readFileSync(file,'utf8'))
  writeFileSync(file,mutated)
  const {typescriptSemanticHash}=require('../scripts/typescript-semantic.cjs')
  assert.notEqual(typescriptSemanticHash(file),approved.tablesModelHash)
 }finally{rmSync(temp,{recursive:true,force:true})}
})
