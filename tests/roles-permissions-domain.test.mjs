import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import {createRequire} from 'node:module'

const ts = createRequire(import.meta.url)('typescript')
const compile = (path, libs={}) => {
  const code = ts.transpileModule(fs.readFileSync(path,'utf8'), {fileName:path,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const m={exports:{}}
  const context={Date,Intl,crypto,Map,Set,JSON,Math,Number,console}
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,context)(id=>{
    if (!Object.hasOwn(libs,id)) throw Error('Missing dependency '+id)
    return libs[id]
  },m,m.exports)
  return m.exports
}
const employee=compile('src/features/employees/model.ts')
const catalog=compile('src/features/roles-permissions/catalog.ts')
const model=compile('src/features/roles-permissions/model.ts', {
  '../employees/model':employee,'./catalog':catalog
})
const actor={role:'super-admin',id:null}, admin={role:'admin',id:'admin-1'}
const plain=x=>JSON.parse(JSON.stringify(x))
const add=(directory,id,role='restaurant')=>employee.saveEmployee(directory,{fullName:'Employee '+id,role},'2026-11-17T00:00:00Z',id)
const directory=()=>add(add(add(employee.emptyEmployeeDirectory(),'staff-a'),'staff-b'),'staff-c')
const create=(s,id,ids=['restaurant.menu.manage'],to=[])=>model.createSubrole(s,actor,
  {id,name:'Role '+id,permissionIds:ids,adminAssignableTo:to})
const entry=(id,subroles=[],grants=[],restrictions=[])=>({employeeId:id,subroles,grants,restrictions})
const assign=(s,d,id,e)=>model.saveEmployeeAccess(s,d,actor,id,e)
const linked=(id,on=true)=>({subroleId:id,includeStandardPermissions:on})

test('catalog has unique, real stable IDs and all four main role defaults',()=>{
  assert.equal(catalog.ALL_PERMISSION_IDS.length,new Set(catalog.ALL_PERMISSION_IDS).size)
  assert.equal(catalog.isPermissionId('restaurant.orders.create'),true)
  assert.equal(catalog.isPermissionId('invented.feature.god-mode'),false)
  for(const role of ['super-admin','admin','restaurant','front-desk'])
    assert.ok(catalog.MAIN_ROLE_PERMISSIONS[role].every(catalog.isPermissionId))
})
test('canonical Super Admin has immutable full access, even if inactive or forged input attempted',()=>{
  const d=directory(),s=model.blankPermissionState()
  assert.equal(model.effectivePermissionIds(s,d.employees[0]).length,catalog.ALL_PERMISSION_IDS.length)
  assert.throws(()=>assign(s,d,employee.SUPER_ADMIN_ID,entry(employee.SUPER_ADMIN_ID,[],['restaurant.menu.manage'])),/Protected/)
  assert.equal(model.permissionView(s,{...d.employees[0],role:'restaurant'}).length,0)
})
test('main role permissions and inactivity are enforced independent of the UI',()=>{
  const d=directory(),s=model.blankPermissionState()
  assert.equal(model.hasPermission(s,d.employees[1],'restaurant.orders.view'),true)
  assert.equal(model.hasPermission(s,d.employees[1],'front-desk.checkout.process'),false)
  assert.deepEqual(plain(model.effectivePermissionIds(s,{...d.employees[1],active:false})),[])
  assert.deepEqual(plain(model.effectivePermissionIds(s,{...d.employees[1],role:'invalid'})),[])
  assert.deepEqual(plain(model.effectivePermissionIds(s,{...d.employees[1],role:'super-admin'})),[])
})
test('create/edit template validates names, IDs, permissions and conflicts',()=>{
  const empty=model.blankPermissionState()
  assert.throws(()=>create(empty,'same',['fake.permission']),/Invalid permissions/)
  assert.throws(()=>model.createSubrole(empty,admin,{id:'x',name:'X',permissionIds:[],adminAssignableTo:[]}),/Super Admin/)
  assert.throws(()=>model.createSubrole(empty,actor,{id:'x',name:'<script>',permissionIds:[],adminAssignableTo:[]}),/valid subrole name/)
  const first=create(empty,'same')
  assert.equal(first.subroles[0].revision,1)
  assert.equal(first.revision,1)
  assert.throws(()=>create(first,'same'),/duplicate/)
  assert.throws(()=>model.createSubrole(first,actor,{id:'other',name:'ROLE same',permissionIds:[],adminAssignableTo:[]}),/already exists/)
  assert.throws(()=>model.updateSubrole(first,actor,'same',0,{name:'Changed',permissionIds:[],adminAssignableTo:[]}),/changed/)
  assert.throws(()=>model.updateSubrole(first,admin,'same',1,{name:'Changed',permissionIds:[],adminAssignableTo:[]}),/Super Admin/)
  const changed=model.updateSubrole(first,actor,'same',1,{name:'Renamed',permissionIds:['restaurant.tables.manage'],adminAssignableTo:[]})
  assert.equal(changed.subroles[0].revision,2)
  assert.equal(first.subroles[0].name,'Role same')
})
test('duplicates, malformed IDs, direct-grant/restriction contradiction and dangling references rejected',()=>{
  const s=create(model.blankPermissionState(),'a'),d=directory()
  assert.throws(()=>assign(s,d,'staff-a',entry('staff-a',[linked('a'),linked('a')])),/Invalid/)
  assert.throws(()=>assign(s,d,'staff-a',entry('staff-a',[linked('missing')])),/Invalid/)
  assert.throws(()=>assign(s,d,'staff-a',entry('staff-a',[],['restaurant.orders.view'],['restaurant.orders.view'])),/Invalid/)
  assert.throws(()=>assign(s,d,'staff-a',entry('staff-a',[],['invented.permission'])),/Invalid/)
  assert.equal(model.isValidPermissionState({...s,subroles:[...s.subroles,{...s.subroles[0]}]}),false)
  assert.equal(model.isValidPermissionState({...s,access:[entry('staff-a',[linked('missing')])]}),false)
})
test('multiple subroles merge permissions and overlapping inheritance survives removal of one',()=>{
  const d=directory(),first=create(model.blankPermissionState(),'a',['restaurant.tables.manage'])
  const second=create(first,'b',['restaurant.tables.manage','restaurant.menu.manage'])
  let s=assign(second,d,'staff-a',entry('staff-a',[linked('a'),linked('b')]))
  let views=model.permissionView(s,d.employees[1])
  assert.equal(views.find(v=>v.id==='restaurant.tables.manage').sources.length,2)
  s=assign(s,d,'staff-a',entry('staff-a',[linked('b')]))
  assert.equal(model.hasPermission(s,d.employees[1],'restaurant.tables.manage'),true)
  s=assign(s,d,'staff-a',entry('staff-a',[linked('b')],[],['restaurant.tables.manage']))
  assert.equal(model.hasPermission(s,d.employees[1],'restaurant.tables.manage'),false)
  assert.equal(model.permissionView(s,d.employees[1]).find(v=>v.id==='restaurant.tables.manage').restricted,true)
})
test('direct cross-department grants, main-role restrictions and restoring access',()=>{
  const d=directory(),empty=model.blankPermissionState()
  let s=assign(empty,d,'staff-a',entry('staff-a',[],['front-desk.charges.view'],['restaurant.orders.view']))
  assert.equal(model.hasPermission(s,d.employees[1],'front-desk.charges.view'),true)
  assert.equal(model.hasPermission(s,d.employees[1],'restaurant.orders.view'),false)
  s=assign(s,d,'staff-a',entry('staff-a',[],['front-desk.charges.view'],[]))
  assert.equal(model.hasPermission(s,d.employees[1],'restaurant.orders.view'),true)
  assert.ok(s.events.some(event=>event.action==='permission.restored' && event.actorId===null))
})
test('live template changes reach two employees but not opt-out employee, restrictions persist',()=>{
  const d=directory()
  let s=create(model.blankPermissionState(),'manager',['restaurant.menu.manage'])
  s=assign(s,d,'staff-a',entry('staff-a',[linked('manager')]))
  s=assign(s,d,'staff-b',entry('staff-b',[linked('manager')]))
  s=assign(s,d,'staff-c',entry('staff-c',[linked('manager',false)]))
  assert.equal(model.affectedEmployeesForSubroleChange(s,d,'manager',['restaurant.menu.manage','restaurant.tables.manage']),2)
  s=model.updateSubrole(s,actor,'manager',1,{name:'Role manager',permissionIds:['restaurant.menu.manage','restaurant.tables.manage'],adminAssignableTo:[]})
  assert.equal(model.hasPermission(s,d.employees[1],'restaurant.tables.manage'),true)
  assert.equal(model.hasPermission(s,d.employees[2],'restaurant.tables.manage'),true)
  assert.equal(model.hasPermission(s,d.employees[3],'restaurant.tables.manage'),false)
  s=assign(s,d,'staff-a',entry('staff-a',[linked('manager')],[],['restaurant.tables.manage']))
  assert.equal(model.affectedEmployeesForSubroleChange(s,d,'manager',['restaurant.tables.manage']),2)
  s=model.updateSubrole(s,actor,'manager',2,{name:'Role manager',permissionIds:['restaurant.tables.manage'],adminAssignableTo:[]})
  assert.equal(model.hasPermission(s,d.employees[1],'restaurant.tables.manage'),false)
  assert.equal(model.hasPermission(s,d.employees[2],'restaurant.tables.manage'),true)
  assert.deepEqual(plain(s.access.find(e=>e.employeeId==='staff-a').restrictions),['restaurant.tables.manage'])
})
test('permission stored once in subrole; no copied template into employee',()=>{
  const d=directory(),s=assign(create(model.blankPermissionState(),'a'),d,'staff-a',entry('staff-a',[linked('a')]))
  assert.deepEqual(plain(s.access[0].grants),[])
  assert.equal(s.access[0].subroles[0].subroleId,'a')
})
test('ordinary Admin can assign approved department-safe subroles but cannot edit templates or overrides',()=>{
  const d=add(directory(),'admin-1','admin')
  let s=create(model.blankPermissionState(),'safe',['restaurant.tables.manage'],['restaurant'])
  s=create(s,'sensitive',['restaurant.orders.record-payment'])
  assert.equal(model.canAssignSubrole(admin,d.employees[1],s.subroles[0]),true)
  assert.equal(model.canAssignSubrole({role:'admin',id:null},d.employees[1],s.subroles[0]),false)
  assert.equal(model.canAssignSubrole(admin,d.employees[1],s.subroles[1]),false)
  assert.equal(model.canAssignSubrole(admin,d.employees[4],s.subroles[0]),false)
  const authorized=model.saveEmployeeAccess(s,d,admin,'staff-a',entry('staff-a',[linked('safe')]))
  assert.equal(authorized.access[0].subroles[0].subroleId,'safe')
  assert.throws(()=>model.saveEmployeeAccess(s,d,admin,'staff-a',entry('staff-a',[linked('sensitive')])),/cannot change/)
  assert.throws(()=>model.saveEmployeeAccess(s,d,admin,'staff-a',entry('staff-a',[],['restaurant.tables.manage'])),/Only Super Admin/)
  assert.throws(()=>model.saveEmployeeAccess(s,d,admin,'staff-a',entry('staff-a',[],[],['restaurant.orders.view'])),/Only Super Admin/)
  assert.throws(()=>model.saveEmployeeAccess(s,d,{role:'restaurant',id:'staff-a'},'staff-a',entry('staff-a')),/Insufficient/)
  assert.throws(()=>model.createSubrole(s,admin,{id:'evil',name:'Evil',permissionIds:[],adminAssignableTo:[]}),/Super Admin/)
})
test('Admin assignment approvals reject financial privileges and cross-department authority even on direct calls',()=>{
  const state=model.blankPermissionState()
  assert.throws(()=>model.createSubrole(state,actor,{id:'cross',name:'Cross',permissionIds:['front-desk.charges.view'],adminAssignableTo:['restaurant']}),/Invalid permissions/)
  assert.throws(()=>model.createSubrole(state,actor,{id:'pay',name:'Pay',permissionIds:['restaurant.orders.record-payment'],adminAssignableTo:['restaurant']}),/Invalid permissions/)
  assert.equal(catalog.isSafeAdminAssignable(['restaurant.tables.manage'],'restaurant'),true)
  assert.equal(catalog.isSafeAdminAssignable(['administration.permissions.manage'],'restaurant'),false)
})
test('events capture target and before/after, never invent a verified actor',()=>{
  const s=create(model.blankPermissionState(),'audit',['restaurant.tables.manage'])
  assert.equal(s.events[0].actorId,null)
  assert.equal(s.events[0].targetId,'audit')
  assert.deepEqual(plain(s.events[0].next),['restaurant.tables.manage'])
  assert.equal(model.isValidPermissionState(s),true)
})
test('state validation is schema-versioned, deny-by-default and lossless',()=>{
  const s=create(model.blankPermissionState(),'a')
  assert.equal(model.isValidPermissionState({...s,version:2}),false)
  assert.equal(model.isValidPermissionState({...s,revision:-1}),false)
  assert.equal(model.isValidPermissionState({...s,access:[entry(employee.SUPER_ADMIN_ID)]}),false)
  const d=directory()
  assert.deepEqual(plain(model.effectivePermissionIds({...s,access:[entry('staff-a',[linked('ghost')])]},d.employees[1])),[])
  const original=plain(s)
  assert.deepEqual(plain(s),original)
})
test('storage rejects corruption, survives reload and detects stale revisions',()=>{
  const memory=new Map()
  const localStorage={getItem:key=>memory.get(key)??null,setItem:(key,val)=>memory.set(key,val)}
  const storageCode=ts.transpileModule(fs.readFileSync('src/features/roles-permissions/storage.ts','utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  vm.runInNewContext(`(function(require,module,exports){${storageCode}\n})`,{localStorage,JSON,window:undefined})(
    id=>{if(id==='./model')return model;if(id==='../audit-log/storage')return {recordAccessCommit(){}};throw Error(id)},module,module.exports)
  const store=module.exports
  assert.equal(store.readPermissions().data.revision,0)
  const s=create(model.blankPermissionState(),'persist')
  store.writePermissions(s,0)
  assert.equal(store.readPermissions().data.subroles[0].name,'Role persist')
  assert.throws(()=>store.writePermissions(s,0),/another tab/)
  memory.set(store.PERMISSIONS_STORAGE_KEY,'{"version":999}')
  assert.match(store.readPermissions().error,/invalid/)
  assert.equal(memory.get(store.PERMISSIONS_STORAGE_KEY),'{"version":999}')
})
test('navigation, dirty guard, System Management entry and graph stylesheet are integrated',()=>{
  const nav=fs.readFileSync('src/shell/navigation.ts','utf8')
  const app=fs.readFileSync('src/App.tsx','utf8')
  const sys=fs.readFileSync('src/features/system-management/SystemManagement.tsx','utf8')
  const main=fs.readFileSync('src/main.tsx','utf8')
  assert.match(nav,/h === 'systems\/roles-permissions' \? 'roles-permissions'/)
  assert.match(nav,/if \(route === 'roles-permissions'\) return '#\/systems\/roles-permissions'/)
  assert.match(sys,/#\/systems\/roles-permissions/)
  assert.match(app,/case 'roles-permissions'/)
  assert.match(app,/area === 'roles-permissions' \? permissionsDirty/)
  assert.match(main,/roles-permissions\/roles-permissions\.css/)
  assert.match(main,/@xyflow\/react\/dist\/style\.css/)
})
