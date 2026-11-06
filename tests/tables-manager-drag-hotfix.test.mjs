import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('typescript')
const source=fs.readFileSync('src/features/tables-manager/model.ts','utf8')
const tsx=fs.readFileSync('src/features/tables-manager/TablesManager.tsx','utf8')
const compiled=ts.transpileModule(source,{fileName:'model.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const module={exports:{}}
vm.runInNewContext(compiled,{exports:module.exports,module,crypto:{randomUUID:()=> 'drag-uuid'},localStorage:{getItem:()=>null,setItem:()=>{}}})
const M=module.exports
const table=(extra={})=>({...M.sampleConfiguration.tables[0],...extra})

test('Live drag coordinates remain continuous and unsnapped before release',()=>{
 const t=table()
 const live=M.boundedTablePosition(t, t.x+12.32, t.y+5.17)
 assert.ok(Math.abs(live.x-(t.x+12.32))<0.00001)
 assert.ok(Math.abs(live.y-(t.y+5.17))<0.00001)
 assert.notEqual(live.x,M.snap(live.x))
 assert.notEqual(live.y,M.snap(live.y))
})
test('Logical pointer-to-table offset is preserved by position calculation',()=>{
 const t=table({x:400,y:290})
 const pointerStart={x:416.5,y:282.25}
 const offset={x:pointerStart.x-t.x,y:pointerStart.y-t.y}
 const pointerMove={x:459.75,y:309.5}
 const live=M.boundedTablePosition(t,pointerMove.x-offset.x,pointerMove.y-offset.y)
 assert.ok(Math.abs((pointerMove.x-live.x)-offset.x)<1e-8)
 assert.ok(Math.abs((pointerMove.y-live.y)-offset.y)<1e-8)
})
test('Final table placement is snapped once to the eight-unit grid',()=>{
 assert.equal(M.GRID,8)
 const t=table()
 const result=M.boundedTablePosition(t,283.3,293.4,true)
 assert.equal(result.x,280)
 assert.equal(result.y,296)
 assert.equal(result.x%M.GRID,0)
 assert.equal(result.y%M.GRID,0)
 assert.equal(M.inBounds({...t,...result}),true)
})
test('Out-of-bounds previews clamp smoothly rather than returning to the starting location',()=>{
 for(const t of [table(),table({shape:'square',chairs:8,rotation:90}),table({shape:'rectangle',chairs:20,rotation:90})]){
  for(const [x,y] of [[-900,-700],[10000,10000],[-500,300],[11000,400]]){
   const live=M.boundedTablePosition(t,x,y)
   const final=M.boundedTablePosition(t,x,y,true)
   assert.equal(M.inBounds({...t,...live}),true,`${t.shape} live ${x},${y}`)
   assert.equal(M.inBounds({...t,...final}),true,`${t.shape} final ${x},${y}`)
   assert.ok(Number.isFinite(live.x)&&Number.isFinite(live.y))
  }
 }
})
test('Rotated expanded rectangles preserve whole-table and chair bounds',()=>{
 const t=table({shape:'rectangle',chairs:20,rotation:270})
 const final=M.boundedTablePosition(t,1200,600,true)
 assert.equal(M.inBounds({...t,...final}),true)
 assert.equal(M.chairPositions(t).length,20)
 const ext=M.extent(t)
 assert.ok(final.x+ext.w/2<=M.WIDTH-24)
 assert.ok(final.y+ext.h/2<=M.HEIGHT-24)
})
test('Overlap detection is preserved and does not automatically block a table move',()=>{
 const moving=table({x:180,y:185})
 const adjacent=table({id:'t-other',x:190,y:180})
 assert.equal(M.overlaps(moving,adjacent),true)
 assert.equal(M.inBounds(moving),true)
})
test('Transient previews do not mutate the draft or committed table positions',()=>{
 const draft=M.copy(M.sampleConfiguration)
 const original=JSON.stringify(draft)
 const preview=M.boundedTablePosition(draft.tables[0],draft.tables[0].x+13.1,draft.tables[0].y+2.9)
 assert.ok(preview.x!==draft.tables[0].x)
 assert.equal(JSON.stringify(draft),original)
})
test('Only the actively dragged SVG table receives preview updates; commit is on release',()=>{
 assert.match(tsx,/const \[preview,setPreview\]=useState<Point\|null>\(null\)/)
 assert.match(tsx,/transform=\{`translate\(\$\{position\.x\} \$\{position\.y\}\)/)
 assert.match(tsx,/onPointerMove=\{move\}/)
 assert.match(tsx,/setPreview\(d\.latest\)/)
 assert.match(tsx,/onMove\(finalPosition\.x,finalPosition\.y\)/)
 assert.match(tsx,/onPointerCancel=\{cancelDrag\}/)
 assert.match(tsx,/onLostPointerCapture=\{cancelDrag\}/)
 assert.match(tsx,/if\(!editing\|\|event\.button!==0\|\|drag\.current\)return/)
 assert.match(tsx,/if\(d\.moved&&\(finalPosition\.x!==d\.start\.x\|\|finalPosition\.y!==d\.start\.y\)\)/)
})
test('Drag does not add zoom or independent chair-position handlers',()=>{
 assert.doesNotMatch(tsx,/setZoom|onChairPointerDown|chairOffset|chair\.dx|chairSelected/)
 assert.match(tsx,/pointerEvents="none"/)
})
test('Many tables can be bounded without changing or allocating persisted configuration',()=>{
 const template=table({shape:'rectangle',chairs:20})
 const data=Array.from({length:50},(_,i)=>({...template,id:`table-${i}`}))
 const results=data.map((item,i)=>M.boundedTablePosition(item,120+i*14.23,190+i*4.11))
 assert.equal(results.length,50)
 assert.ok(results.every((p,i)=>M.inBounds({...data[i],...p})))
})
