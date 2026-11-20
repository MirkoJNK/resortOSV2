import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = fs.readFileSync('src/features/rooms-manager/model.ts','utf8')
const output = ts.transpileModule(source,{fileName:'model.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
function load(storage, idGenerator=()=> 'uuid-test-unique') {
  const mod={exports:{}}
  const context={module:mod,exports:mod.exports,localStorage:storage,crypto:{randomUUID:idGenerator},console,Date,Intl,Set,JSON,String,Object,Number,Array,
    require:name=>name==='../audit-log/storage'?{recordCollection(){}}:(()=>{throw Error('Unexpected '+name)})()}
  vm.runInNewContext(output,context,{filename:'rooms-model.js'})
  return mod.exports
}
const memory=()=> {let raw=null;return { getItem:()=>raw,setItem:(_k,v)=>{raw=v},set raw(v){raw=v},get raw(){return raw} }}
const create=()=>load(memory())
const asPlain=o=>JSON.parse(JSON.stringify(o))

test('approved initial room data contains the exact ten records and six fields',()=>{
  const m=create()
  assert.equal(m.sampleDirectory.rooms.length,10)
  for(const r of m.sampleDirectory.rooms)assert.deepEqual(Object.keys(asPlain(r)).sort(),['active','code','createdAt','id','name','updatedAt'])
  assert.equal(m.sampleDirectory.rooms.filter(r=>r.active).length,8)
  assert.equal(m.sampleDirectory.rooms.filter(r=>!r.active).length,2)
})
test('immutable ID survives room renaming and editing',()=>{
  const m=create(), a=m.sampleDirectory.rooms[0],b={...a,name:'Renamed Suite',code:'X7'}
  assert.equal(a.id,b.id)
})
test('new room uses unique ID and active status',()=>{
  const m=create(),r=m.createRoom({name:'  New   Villa ',code:' V-5 '},m.sampleDirectory.rooms,'2026-11-05T12:00:00.000Z','unique-test-id')
  assert.equal(r.id,'unique-test-id');assert.equal(r.active,true)
  assert.equal(r.name,'New Villa');assert.equal(r.code,'V-5');assert.equal(r.createdAt,r.updatedAt)
})
test('required names reject blank and whitespace-only values',()=>{
  const m=create();assert.equal(m.validateRoomFields({name:'   ',code:''},[]).name,'Enter a room name')
})
test('room names reject case-insensitive duplicates from active records',()=>{
  const m=create();assert.match(m.validateRoomFields({name:' rOoM 101 ',code:''},m.sampleDirectory.rooms).name,/already exists/)
})
test('room names reject duplicates from inactive records',()=>{
  const m=create();assert.match(m.validateRoomFields({name:'villa b',code:''},m.sampleDirectory.rooms).name,/already exists/)
})
test('optional codes are allowed but duplicates are not',()=>{
  const m=create();assert.equal(Object.keys(m.validateRoomFields({name:'Unique Room',code:''},m.sampleDirectory.rooms)).length,0)
  assert.match(m.validateRoomFields({name:'Unique Room',code:' bc-02 '},m.sampleDirectory.rooms).code,/already in use/)
})
test('editing same room without renaming is valid',()=>{
  const m=create(),r=m.sampleDirectory.rooms[0]
  assert.equal(Object.keys(m.validateRoomFields({name:r.name,code:r.code},m.sampleDirectory.rooms,r.id)).length,0)
})
test('names and codes enforce 60 and 20 char limits',()=>{
  const m=create();assert.match(m.validateRoomFields({name:'x'.repeat(61),code:'y'.repeat(21)},[]).name,/60/)
  assert.match(m.validateRoomFields({name:'x'.repeat(61),code:'y'.repeat(21)},[]).code,/20/)
})
test('room code search finds rooms without scanning hidden-only subsets',()=>{
  const m=create(),a=m.selectRooms(m.sampleDirectory.rooms,'206','all','natural')
  assert.equal(a.length,1);assert.equal(a[0].active,false)
})
test('natural sorting orders numbers 2 before 10',()=>{
  const m=create(),rooms=['Room 10','Room 2','Room 1'].map((name,i)=>({...m.sampleDirectory.rooms[i],name,code:String(i)}))
  assert.deepEqual(m.selectRooms(rooms,'','all','natural').map(r=>r.name),['Room 1','Room 2','Room 10'])
})
test('reverse and recently updated sort work without mutating stored order',()=>{
  const m=create(),rows=m.copyRooms(m.sampleDirectory).rooms
  const before=rows.map(r=>r.id)
  assert.equal(m.selectRooms(rows,'','all','reverse')[0].name,'Villa B')
  rows[1].updatedAt='2028-01-01T00:00:00Z'
  assert.equal(m.selectRooms(rows,'','all','latest')[0].name,rows[1].name)
  assert.deepEqual(rows.map(r=>r.id),before)
})
test('status filtering is separate from search and all includes inactive',()=>{
  const m=create()
  assert.equal(m.selectRooms(m.sampleDirectory.rooms,'','all','natural').length,10)
  assert.equal(m.selectRooms(m.sampleDirectory.rooms,'','active','natural').length,8)
  assert.equal(m.selectRooms(m.sampleDirectory.rooms,'','inactive','natural').length,2)
})
test('directory validation rejects duplicate IDs and duplicate display names',()=>{
  const m=create(),a=m.copyRooms(m.sampleDirectory)
  a.rooms[1].id=a.rooms[0].id;assert.equal(m.validateDirectory(a),false)
  a.rooms[1].id='id2';a.rooms[1].name=a.rooms[0].name.toUpperCase();assert.equal(m.validateDirectory(a),false)
})
test('directory validation rejects duplicate codes, including inactive rooms',()=>{
  const m=create(),a=m.copyRooms(m.sampleDirectory)
  a.rooms[0].code='vb';assert.equal(m.validateDirectory(a),false)
})
test('directory validation rejects malformed status, timestamps, missing fields and extra input shape',()=>{
  const m=create(),a=m.copyRooms(m.sampleDirectory)
  for(const invalid of [{active:'occupied'},{createdAt:'bogus'},{name:' '},{code:null}]){
    const b=m.copyRooms(a);b.rooms[0]={...b.rooms[0],...invalid};assert.equal(m.validateDirectory(b),false)
  }
  assert.equal(m.validateDirectory({version:99,rooms:[]}),false)
})
test('deliberately empty room configuration is valid',()=>{
  const m=create();assert.equal(m.validateDirectory({version:1,rooms:[]}),true)
})
test('first read seeds demo data only when no storage exists',()=>{
  const store=memory(),m=load(store)
  assert.equal(m.readRooms().data.rooms.length,10)
  assert.equal(store.raw,null)
})
test('saved empty directory remains empty on reload without reseeding',()=>{
  const store=memory(),m=load(store)
  assert.equal(m.writeRooms({version:1,rooms:[]}).ok,true)
  assert.equal(m.readRooms().data.rooms.length,0)
})
test('successful persistent edits survive reload with immutable id',()=>{
  const store=memory(),m=load(store),data=m.copyRooms(m.sampleDirectory)
  const old=data.rooms[0].id;data.rooms[0]={...data.rooms[0],name:'New Name',active:false}
  assert.equal(m.writeRooms(data).ok,true)
  const read=m.readRooms();assert.equal(read.data.rooms[0].id,old)
  assert.equal(read.data.rooms[0].name,'New Name');assert.equal(read.data.rooms[0].active,false)
})
test('corrupted storage is neither overwritten nor treated as empty successfully',()=>{
  const store=memory();store.raw='{invalid-json';const m=load(store)
  const result=m.readRooms();assert.equal(result.recoverable,false)
  assert.match(result.error,/unavailable or corrupted/)
  assert.equal(store.raw,'{invalid-json')
})
test('invalid stored data is not silently overwritten',()=>{
  const store=memory();store.raw='{"version":1,"rooms":[{"id":"bad"}]}'
  const m=load(store),result=m.readRooms();assert.equal(result.recoverable,false)
  assert.match(result.error,/invalid/)
  assert.ok(store.raw.includes('bad'))
})
test('storage write failure does not falsely claim success',()=>{
  const m=load({getItem:()=>null,setItem:()=>{throw Error('quota exceeded')}})
  const result=m.writeRooms(m.sampleDirectory);assert.equal(result.ok,false)
  assert.match(result.error,/Could not save rooms/)
})
test('invalid save does not call setItem or change storage',()=>{
  let called=0;const m=load({getItem:()=>null,setItem:()=>{called++}})
  assert.equal(m.writeRooms({version:1,rooms:[{id:'bad'}]}).ok,false)
  assert.equal(called,0)
})
test('room model has no guest, pricing, booking or charge fields',()=>{
  const m=create()
  for(const room of m.sampleDirectory.rooms)for(const key of ['guest','price','rate','floor','location','capacity','balance'])assert.equal(key in room,false)
})
test('routing and app use only approved nested rooms destination and preserve Tables',()=>{
  const app=fs.readFileSync('src/App.tsx','utf8'),nav=fs.readFileSync('src/shell/navigation.ts','utf8')
  assert.match(nav,/systems\/rooms/);assert.match(nav,/systems\/tables/)
  assert.match(app,/case 'rooms':/);assert.match(app,/case 'tables':/)
  assert.match(app,/roomsDirty/);assert.match(app,/tablesDirty/)
})
test('page provides inline editing, confirmation, and three-stage animation selectors',()=>{
  const jsx=fs.readFileSync('src/features/rooms-manager/RoomsManager.tsx','utf8')
  const css=fs.readFileSync('src/features/rooms-manager/rooms-manager.css','utf8')
  assert.match(jsx,/rm-b-create/);assert.match(jsx,/rm-b-inline/);assert.match(jsx,/role="alertdialog"/)
  for(const s of ['.rm-page .rm-heading','.rm-page .rm-toolbar','.rm-page .rm-results-stage'])assert.ok(css.includes(s),s)
  for(const ms of [0,55,110])assert.match(css,new RegExp(`animation-delay:\\s*${ms}ms`))
  assert.match(css,/prefers-reduced-motion:\s*reduce/)
  assert.doesNotMatch(jsx,/Delete Room|Room prices|Room type|Room balance/)
})
test('source guards reject unauthorized changes to the Rooms feature',()=>{
  const {typescriptSemanticHash}=require('../scripts/typescript-semantic.cjs'),{cssSemanticHash}=require('../scripts/css-semantic.cjs')
  const approved=JSON.parse(fs.readFileSync('ROOMS_MANAGER_APPROVED.json','utf8'))
  const hotfix = JSON.parse(fs.readFileSync('GLOBAL_UI_HOTFIX_APPROVED.json', 'utf8')).approved_source['src/features/rooms-manager/RoomsManager.tsx']
  assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync('src/features/rooms-manager/RoomsManager.tsx')).digest('hex'), hotfix.after)
  assert.equal(typescriptSemanticHash('src/features/rooms-manager/model.ts'),approved.roomsModelHash)
  assert.equal(cssSemanticHash('src/features/rooms-manager/rooms-manager.css'),approved.roomsStylesHash)
})

test('loaded room records cannot add unapproved properties to the six-field model',()=>{
 const m=create(),data=m.copyRooms(m.sampleDirectory)
 data.rooms[0].guest='Private name'
 assert.equal(m.validateDirectory(data),false)
})
