import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
const ts=require('typescript')
const read=path=>fs.readFileSync(path,'utf8')
const compiled=ts.transpileModule(read('src/features/roles-permissions/graphLayout.ts'),{
  fileName:'graphLayout.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText
const geometry=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const graph=read('src/features/roles-permissions/AccessGraph.tsx')
const graphCss=read('src/features/roles-permissions/roles-permissions.css')
const auditCss=read('src/features/audit-log/audit-log.css')
const headingCss=read('src/styles/admin-heading-consistency.css')
const supportCss=read('src/styles/support.css')

function permission(id,y,title='View Department Tickets',detail='Employee Operations',measured){
  return {id:`permission:${id}`,position:{x:565,y},data:{title,detail},measured:measured?{height:measured}:undefined}
}

test('permission geometry appends 1, 5 and 10 different-height cards without collisions',()=>{
  for(const count of [1,5,10]){
    const placed=[]
    for(let i=0;i<count;i++){
      const title=i%3===0?'View Department Tickets and Detailed Employee Activity':'View Menu'
      const detail=i%2===0?'Employee Operations':'Restaurant'
      const position=geometry.nextPermissionPosition(placed,565)
      const item=permission(i,position.y,title,detail,i%2===0?130:undefined)
      assert.ok(placed.every(prior=>item.position.y>=geometry.permissionBottom(prior)+geometry.PERMISSION_COLUMN_GAP))
      placed.push(item)
    }
    assert.equal(placed.length,count)
  }
})

test('manual downward moves and large measured heights affect next append',()=>{
  const previouslyMoved=permission('moved',620,'View Extra Detailed Department Tickets','Employee Operations',170)
  const atTop=permission('top',22,'View Menu','Restaurant',80)
  const next=geometry.nextPermissionPosition([atTop,previouslyMoved],565)
  assert.equal(next.y,620+170+geometry.PERMISSION_COLUMN_GAP)
  assert.equal(next.x,565)
})

test('after removal, a restored permission follows current last card',()=>{
  const original=[permission('one',22),permission('two',160),permission('three',310)]
  const withoutTwo=original.filter(node=>node.id!=='permission:two')
  const restored=geometry.nextPermissionPosition(withoutTwo,565)
  assert.equal(restored.y,geometry.permissionBottom(original[2])+geometry.PERMISSION_COLUMN_GAP)
})

test('graph has scoped noninteractive column labels in employee and subrole modes',()=>{
  assert.match(graph,/mode==='employee' \? \[graphHeading\('employee','Employee',22\)/)
  assert.match(graph,/graphHeading\('roles','Roles & Subroles',288\)/)
  assert.match(graph,/graphHeading\('permissions','Permissions',565\)/)
  assert.match(graph,/graphHeading\('subrole','Subrole',22\)/)
  for(const locked of ['draggable:false','connectable:false','selectable:false','deletable:false','focusable:false'])
    assert.ok(graph.includes(locked),`missing heading lock: ${locked}`)
  assert.match(graphCss,/\.rp-flow \.react-flow__node-heading\{[^}]*pointer-events:none/)
})

test('every graph removal is gated before controlled deletion and preserves Save Changes',()=>{
  assert.match(graph,/onBeforeDelete=\{async \(\{nodes:deletedNodes,edges:deletedEdges\}\)=>\{/)
  assert.match(graph,/requestRemoval\(removableTarget\(node\?\.id\?\?null,edge\?\.id\?\?null\)\)/)
  assert.match(graph,/\/\/ React Flow must not mutate its controlled graph before confirmation\./)
  assert.match(graph,/return false\s*\}\}/)
  assert.match(graph,/const removeSelected=\(\)=>requestRemoval\(/)
  assert.match(graph,/if\(!editable\|\|!target\|\|removalRef\.current\)return/)
  assert.match(graph,/This change will take effect when you save/)
  assert.match(graph,/even if it is included in an assigned role or subrole/)
  assert.match(graph,/The subrole definition will not be deleted/)
  assert.match(graph,/if \(mode==='employee' && id==='support\.tickets\.department-view'\) return/)
  assert.match(graph,/returnFocusTo=\{removalTrigger\.current\}/)
  assert.match(graph,/ref=\{cancelButton\}/)
})

test('all three Admin headings share one scoped metric specification',()=>{
  for(const path of ['src/features/system-management/SystemManagement.tsx',
    'src/features/audit-log/AuditLog.tsx','src/components/SupportWorkspace.tsx'])
    assert.match(read(path),/ros-admin-heading/)
  assert.match(headingCss,/:is\(\.sm-page,\.al-page,\.support-page\) \.ros-admin-heading h1/)
  assert.match(read('src/main.tsx'),/admin-heading-consistency\.css/)
})

test('Audit heading, tabs and content have short staggered entrance and reduced-motion handling',()=>{
  for(const selector of ['> .ros-admin-heading','> .al-tabs','> .al-surface','> .al-trace-open'])
    assert.ok(auditCss.includes(selector))
  assert.match(auditCss,/335ms cubic-bezier/)
  assert.match(auditCss,/translateY\(5px\)/)
  assert.match(auditCss,/prefers-reduced-motion:reduce/)
  assert.match(auditCss,/animation:none!important/)
})

test('Support status count is dynamic and plain inline text, no bubble badge',()=>{
  const source=read('src/components/SupportWorkspace.tsx')
  assert.match(source,/tickets\.filter\(t => t\.status === s\)\.length/)
  assert.match(source,/aria-label=\{`\$\{s\}, \$\{tickets\.filter/)
  const marker=supportCss.indexOf('.support-filter-tabs button span {')
  const rule=supportCss.slice(marker,supportCss.indexOf('}',marker))
  assert.match(rule,/background: transparent/)
  assert.match(rule,/border-radius: 0/)
  assert.match(rule,/font-variant-numeric: tabular-nums/)
})
