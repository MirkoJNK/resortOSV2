import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import { webcrypto } from 'node:crypto'

if (!globalThis.crypto) globalThis.crypto = webcrypto
const content = new Map()
globalThis.localStorage = {
  getItem: key => content.has(key) ? content.get(key) : null,
  setItem: (key,value) => {content.set(key,String(value))},
  removeItem: key => {content.delete(key)},
  clear: () => content.clear()
}
globalThis.window = {dispatchEvent:()=>{}}

const moduleFor = async path => {
  const result=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,
    logLevel:'silent',define:{'import.meta.env.BASE_URL':'"/"'}})
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'))
}
const [employees,permissions,seed,access,graph,model,initial,history,tables,rooms,services,finance,checkout,charges] = await Promise.all([
  'src/features/employees/model.ts','src/features/roles-permissions/model.ts',
  'src/features/demo/seed.ts','src/features/demo/access.ts',
  'src/features/roles-permissions/catalog.ts','src/features/restaurant-tables/model.ts',
  'src/features/restaurant-tables/initialData.ts','src/features/demo/operations.ts',
  'src/features/tables-manager/model.ts','src/features/rooms-manager/model.ts',
  'src/features/service-catalog/model.ts','src/features/discount-management/model.ts',
  'src/features/front-desk/checkout.ts','src/features/front-desk/charges.ts'
].map(moduleFor))

test('four permanent identities and Restaurant Manager are created once without duplication',()=>{
  localStorage.clear()
  seed.ensureDemoIdentityFixtures()
  const snapshot=JSON.parse(localStorage.getItem('resortos.employees.v1'))
  const permissionSnapshot=JSON.parse(localStorage.getItem('resortos.permissions.v1'))
  assert.deepEqual(snapshot.employees.map(e=>e.id),[
    'system-super-admin','demo-restaurant-luis','demo-restaurant-moy','demo-frontdesk-sofia'])
  assert.equal(permissionSnapshot.subroles.length,1)
  assert.deepEqual(permissionSnapshot.subroles[0].permissionIds,['restaurant.orders.remove-recorded-items'])
  seed.ensureDemoIdentityFixtures()
  assert.equal(localStorage.getItem('resortos.employees.v1'),JSON.stringify(snapshot))
  assert.equal(localStorage.getItem('resortos.permissions.v1'),JSON.stringify(permissionSnapshot))
})

test('only Moy gains manager removal permission; Super Admin is inherently unrestricted',()=>{
  const directory=JSON.parse(localStorage.getItem('resortos.employees.v1'))
  const state=JSON.parse(localStorage.getItem('resortos.permissions.v1'))
  const person=id=>directory.employees.find(e=>e.id===id)
  const luis=permissions.effectivePermissionIds(state,person('demo-restaurant-luis'))
  const moy=permissions.effectivePermissionIds(state,person('demo-restaurant-moy'))
  assert.deepEqual(moy.filter(id=>!luis.includes(id)),['restaurant.orders.remove-recorded-items'])
  assert.equal(permissions.hasPermission(state,person('demo-restaurant-luis'),'restaurant.orders.remove-recorded-items'),false)
  assert.equal(permissions.hasPermission(state,person('system-super-admin'),'restaurant.orders.remove-recorded-items'),true)
  assert.equal(permissions.hasPermission(state,person('demo-frontdesk-sofia'),'restaurant.orders.view'),false)
  assert.equal(graph.isSafeAdminAssignable(['restaurant.orders.remove-recorded-items'],'restaurant'),false)
  assert.equal(graph.PERMISSION_CATALOG.find(p=>p.id==='restaurant.menu.manage').module,'Administration')
})

test('route policy permits individually granted Administration menu without broad access',()=>{
  const d=JSON.parse(localStorage.getItem('resortos.employees.v1'))
  const state=JSON.parse(localStorage.getItem('resortos.permissions.v1'))
  const luis=d.employees.find(e=>e.id==='demo-restaurant-luis')
  assert.equal(access.canAccessRoute(state,luis,'systems'),false)
  const granted=permissions.saveEmployeeAccess(state,d,{role:'super-admin',id:'system-super-admin'},luis.id,
    {employeeId:luis.id,subroles:[],restrictions:[],grants:['restaurant.menu.manage']})
  assert.equal(access.canAccessRoute(granted,luis,'systems'),true)
  assert.equal(access.canAccessRoute(granted,luis,'menu'),true)
  assert.equal(access.canAccessRoute(granted,luis,'employees'),false)
  assert.equal(access.canAccessRoute(granted,luis,'roles-permissions'),false)
  assert.deepEqual(access.availableWorkspaces(granted,luis),['admin','restaurant'])
  assert.equal(access.preferredRoute(granted,luis,'admin'),'systems')
})

test('saved invalid or inactive account ID always falls back to canonical System Administrator',()=>{
  const d=JSON.parse(localStorage.getItem('resortos.employees.v1'))
  localStorage.setItem(access.ACTIVE_DEMO_ACCOUNT_KEY,'unknown-elevated-id')
  assert.equal(access.readActiveDemoAccount(d).id,'system-super-admin')
  localStorage.setItem(access.ACTIVE_DEMO_ACCOUNT_KEY,'demo-restaurant-luis')
  assert.equal(access.readActiveDemoAccount(d).id,'demo-restaurant-luis')
  localStorage.setItem('resortos.employees.v1',JSON.stringify({...d,employees:d.employees.map(e=>e.id==='demo-restaurant-luis'?{...e,active:false}:e)}))
  assert.equal(access.readActiveDemoAccount(JSON.parse(localStorage.getItem('resortos.employees.v1'))).id,'system-super-admin')
  localStorage.setItem('resortos.employees.v1',JSON.stringify(d))
  assert.throws(()=>access.requireCurrentDemoPermission('demo-restaurant-luis','restaurant.orders.remove-recorded-items'),/permission/)
})

test('permanent historical fixture reconciles all charges and separate guest stays on same room',()=>{
  const clock=new Date('2026-11-18T09:00:00.000Z')
  const items=['Chicken Adobo','Calamansi Juice','Chicken Wings'].map((name,i)=>({id:`item-${i}`,name,
    categoryId:'main',priceCentavos:[25000,8500,22000][i],imageId:null,active:true,
    createdAt:clock.toISOString(),updatedAt:clock.toISOString()}))
  const config=finance.defaultFinanceConfig()
  const baseline=initial.initialOperationalRecords(tables.sampleConfiguration.tables,rooms.sampleDirectory.rooms,
    items,services.sampleDirectory.services,config,clock)
  assert.ok(baseline)
  const result=history.addMissingDemoHistory(baseline,tables.sampleConfiguration.tables,rooms.sampleDirectory.rooms,
    items,services.sampleDirectory.services,config,clock)
  assert.ok(result)
  assert.equal(model.isValidOperations(result),true)
  const historic=result.stays.find(s=>s.id==='demo-history-stay-1')
  assert.equal(historic.status,'checked-out')
  assert.ok(result.stays.some(s=>s.id!==historic.id && s.roomId===historic.roomId && s.status==='active'))
  const settled=checkout.checkoutSummary(result,historic.id)
  assert.equal(settled.balanceDueCentavos,0)
  const receipt=result.checkouts.find(c=>c.stayId===historic.id)
  assert.equal(receipt.totalCentavos,receipt.alreadyPaidCentavos+receipt.settledCentavos)
  assert.ok(result.orders.some(o=>o.id==='demo-canceled-order-1'&&o.canceledAt))
  assert.equal(history.addMissingDemoHistory(result,tables.sampleConfiguration.tables,rooms.sampleDirectory.rooms,
    items,services.sampleDirectory.services,config,clock),result)
  assert.equal(charges.stayCharges(result,historic.id).length,2)
})

test('graph additions and persistence checks remain draft-based and non-bypassing',()=>{
  const graphSource=readFileSync('src/features/roles-permissions/AccessGraph.tsx','utf8')
  const rolesSource=readFileSync('src/features/roles-permissions/RolesPermissions.tsx','utf8')
  const tablesSource=readFileSync('src/features/restaurant-tables/RestaurantTables.tsx','utf8')
  assert.match(graphSource,/if \(!allIds\.has\(id\)\) onConnectPermission\(id\)/)
  assert.match(rolesSource,/e\.id !== SUPER_ADMIN_ID &&/)
  assert.doesNotMatch(rolesSource,/const localEditor/)
  assert.match(tablesSource,/requireCurrentDemoPermission\(accountId, 'restaurant\.orders\.remove-recorded-items'\)/)
})

test('conflicting manager role fails before partially installing employee fixtures',()=>{
  const previousEmployees=localStorage.getItem('resortos.employees.v1')
  const previousPermissions=localStorage.getItem('resortos.permissions.v1')
  const previousMarker=localStorage.getItem(seed.DEMO_SEED_KEY)
  try {
    localStorage.removeItem(seed.DEMO_SEED_KEY)
    const empty=employees.emptyEmployeeDirectory()
    const conflict=permissions.createSubrole(permissions.blankPermissionState(),{role:'super-admin',id:null},
      {id:'custom-existing-manager',name:'Restaurant Manager',permissionIds:[],adminAssignableTo:[]})
    localStorage.setItem('resortos.employees.v1',JSON.stringify(empty))
    localStorage.setItem('resortos.permissions.v1',JSON.stringify(conflict))
    assert.throws(()=>seed.ensureDemoIdentityFixtures(),/already in use/)
    assert.equal(localStorage.getItem('resortos.employees.v1'),JSON.stringify(empty))
    assert.equal(localStorage.getItem('resortos.permissions.v1'),JSON.stringify(conflict))
  } finally {
    if(previousEmployees===null)localStorage.removeItem('resortos.employees.v1')
    else localStorage.setItem('resortos.employees.v1',previousEmployees)
    if(previousPermissions===null)localStorage.removeItem('resortos.permissions.v1')
    else localStorage.setItem('resortos.permissions.v1',previousPermissions)
    if(previousMarker===null)localStorage.removeItem(seed.DEMO_SEED_KEY)
    else localStorage.setItem(seed.DEMO_SEED_KEY,previousMarker)
  }
})

test('employee mutations and role elevation require a current identity and role boundary',()=>{
  const source=readFileSync('src/features/employees/Employees.tsx','utf8')
  const app=readFileSync('src/App.tsx','utf8')
  assert.match(source,/requireCurrentDemoPermission\(accountId, 'administration\.employees\.manage'\)/)
  assert.match(source,/canManageEmployee\(actorRole,\s*target\)/)
  assert.match(source,/canAssignEmployeeRole\(actorRole, editor\.role\)/)
  assert.match(app,/<Employees onDirtyChange=\{setEmployeesDirty\} accountId=\{activeAccount\.id\}/)
})
