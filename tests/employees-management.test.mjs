import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
import crypto from 'node:crypto'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const T1 = '2026-11-17T01:00:00.000Z'
const T2 = '2026-11-17T02:00:00.000Z'
const T3 = '2026-11-17T03:00:00.000Z'
const clone = x => JSON.parse(JSON.stringify(x))
function compile(file, mapping = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {fileName:file,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module = {exports:{}}
  const sandbox = {Date,Intl,crypto,BigInt,Number,Map,Set,JSON,Math,console,...globals}
  const runner = vm.runInNewContext(`(function(require,module,exports){${code}\n})`, sandbox)
  runner(key => {if (key==='../audit-log/storage')return {recordCollection(){}}
    if (!(key in mapping)) throw Error(`Unmapped ${key}`); return mapping[key]}, module, module.exports)
  return module.exports
}
const m = compile('src/features/employees/model.ts')
const base = () => m.emptyEmployeeDirectory()
const add = (d, name = 'Moy Cruz', role = 'restaurant', id = 'employee-1', when = T1) =>
  m.saveEmployee(d,{fullName:name,role},when,id)

test('default directory contains exactly one active protected canonical Super Admin', () => {
  const d = base()
  assert.equal(m.isValidEmployeeDirectory(d), true)
  assert.equal(d.employees.length,1)
  assert.deepEqual(clone(d.employees[0]), {
    id:'system-super-admin',fullName:'System Administrator',role:'super-admin',
    active:true,protected:true,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'
  })
  assert.equal(m.roleLabels['front-desk'],'Front Desk Employee')
})
test('add employee trims/normalizes name, assigns role and active status with stable ID', () => {
  const d = add(base(),'  Mirko   Jankovic  ','admin')
  assert.equal(d.revision,1)
  assert.deepEqual(clone(d.employees[1]),{
    id:'employee-1',fullName:'Mirko Jankovic',role:'admin',active:true,protected:false,createdAt:T1,updatedAt:T1
  })
  assert.equal(m.isValidEmployeeDirectory(d),true)
})
test('two employees may share a name but never a stable ID', () => {
  const d = add(add(base()),'Moy Cruz','front-desk','employee-2')
  assert.equal(d.employees.filter(e=>e.fullName==='Moy Cruz').length,2)
  assert.throws(()=>add(d,'Another Name','front-desk','employee-2'),/duplicate employee ID/)
})
test('non-Latin, apostrophe and hyphenated names are accepted', () => {
  const d = add(base(),'  José  María-Santos O’Neil  ')
  assert.equal(d.employees[1].fullName,'José María-Santos O’Neil')
  assert.equal(add(d,'李 小龙','front-desk','employee-2').employees[2].fullName,'李 小龙')
})
test('required name, whitespace, markup, controls, and max 100 chars enforced at domain layer', () => {
  for(const name of ['','  \n \t  ','<script>x</script>','a\0b','x'.repeat(101)]) {
    assert.throws(()=>add(base(),name),/full name/i)
  }
  assert.equal(add(base(),'x'.repeat(100)).employees[1].fullName.length,100)
})
test('unsupported roles including super-admin are rejected on direct create', () => {
  for(const role of ['super-admin','housekeeping','ADMIN',null,undefined]) {
    assert.throws(()=>m.saveEmployee(base(),{fullName:'Employee',role},T1,'employee-1'),/valid employee role/)
  }
})
test('edit name and role preserves immutable identity, activity and created timestamp', () => {
  const before = add(base())
  const next = m.saveEmployee(before,{id:'employee-1',fullName:'  Moy  Jankovic ',role:'front-desk'},T2)
  assert.equal(next.employees[1].fullName,'Moy Jankovic')
  assert.equal(next.employees[1].role,'front-desk')
  assert.equal(next.employees[1].id,'employee-1')
  assert.equal(next.employees[1].createdAt,T1)
  assert.equal(next.employees[1].updatedAt,T2)
  assert.equal(next.employees[1].active,true)
  assert.equal(before.employees[1].fullName,'Moy Cruz')
})
test('canceling an edit leaves directory unchanged (domain mutations are pure)', () => {
  const before = add(base())
  const draft = {id:'employee-1',fullName:'Unsaved',role:'admin'}
  assert.equal(draft.fullName,'Unsaved')
  assert.equal(before.employees[1].fullName,'Moy Cruz')
  assert.equal(before.revision,1)
})
test('editing rejects unknown IDs and invalid input', () => {
  const d=add(base())
  assert.throws(()=>m.saveEmployee(d,{id:'missing',fullName:'Name',role:'admin'}),/not found/)
  assert.throws(()=>m.saveEmployee(d,{id:'employee-1',fullName:'',role:'admin'}),/full name/)
  assert.throws(()=>m.saveEmployee(d,{id:'employee-1',fullName:'Name',role:'super-admin'}),/valid employee role/)
})
test('deactivation and reactivation preserve identity and role', () => {
  const active=add(base())
  const inactive=m.setEmployeeStatus(active,'employee-1',false,T2)
  const restored=m.setEmployeeStatus(inactive,'employee-1',true,T3)
  assert.equal(inactive.employees[1].active,false)
  assert.equal(restored.employees[1].active,true)
  assert.equal(inactive.employees[1].fullName,active.employees[1].fullName)
  assert.equal(inactive.employees[1].id,active.employees[1].id)
  assert.equal(inactive.employees[1].role,active.employees[1].role)
  assert.equal(restored.revision,3)
  assert.throws(()=>m.setEmployeeStatus(restored,'employee-1',true,T3),/already changed/)
})
test('deletion removes ordinary directory entry and never rewrites other employee IDs', () => {
  const d=add(add(base(),'One','restaurant','employee-1'),'Two','front-desk','employee-2')
  const next=m.deleteEmployee(d,'employee-1')
  assert.deepEqual(clone(next.employees.map(e=>e.id)),['system-super-admin','employee-2'])
  assert.deepEqual(clone(d.employees.map(e=>e.id)),['system-super-admin','employee-1','employee-2'])
  assert.throws(()=>m.deleteEmployee(next,'employee-1'),/not found/)
})
test('all Super Admin direct mutations are rejected even with bypassed UI', () => {
  const d=base()
  assert.throws(()=>m.saveEmployee(d,{id:'system-super-admin',fullName:'Changed',role:'admin'},T2),/protected Super Admin/)
  assert.throws(()=>m.saveEmployee(d,{id:'system-super-admin',fullName:'System Administrator',role:'super-admin'},T2),/valid employee role/)
  assert.throws(()=>m.setEmployeeStatus(d,'system-super-admin',false,T2),/protected Super Admin/)
  assert.throws(()=>m.setEmployeeStatus(d,'system-super-admin',true,T2),/protected Super Admin/)
  assert.throws(()=>m.deleteEmployee(d,'system-super-admin'),/protected Super Admin/)
  assert.throws(()=>add(d,'Other','admin','system-super-admin'),/duplicate employee ID/)
  assert.equal(d.employees[0].active,true)
})
test('tampered system record, duplicate Super Admin identity, and forged protected flags invalidate directory', () => {
  const d=add(base())
  assert.equal(m.isValidEmployeeDirectory({...d, employees:d.employees.slice(1)}),false)
  assert.equal(m.isValidEmployeeDirectory({...d, employees:[{...d.employees[0],active:false},d.employees[1]]}),false)
  assert.equal(m.isValidEmployeeDirectory({...d, employees:[d.employees[0],{...d.employees[1],role:'super-admin'}]}),false)
  assert.equal(m.isValidEmployeeDirectory({...d, employees:[d.employees[0],{...d.employees[1],protected:true}]}),false)
  assert.equal(m.isValidEmployeeDirectory({...d, employees:[d.employees[0],d.employees[0]]}),false)
  assert.equal(m.isValidEmployeeDirectory({...d, employees:[{...d.employees[0],untrusted:true},d.employees[1]]}),false)
})
test('permission boundary functions exclude protected records and Admin role escalation', () => {
  const d=add(add(base(),'Admin Employee','admin','employee-admin'),'Restaurant Employee','restaurant','employee-restaurant')
  assert.equal(m.canManageEmployee('super-admin',d.employees[1]),true)
  assert.equal(m.canManageEmployee('admin',d.employees[1]),false)
  assert.equal(m.canManageEmployee('admin',d.employees[2]),true)
  assert.equal(m.canManageEmployee('super-admin',d.employees[0]),false)
  assert.equal(m.canAssignEmployeeRole('admin','admin'),false)
  assert.equal(m.canAssignEmployeeRole('admin','restaurant'),true)
  assert.equal(m.canAssignEmployeeRole('super-admin','admin'),true)
  assert.equal(m.canAssignEmployeeRole('admin','super-admin'),false)
})
test('search by employee name and display role; filtering by Active and Inactive', () => {
  const d=add(add(base(),'Ana Santos','restaurant','employee-1'),'Ben Cruz','front-desk','employee-2')
  const updated=m.setEmployeeStatus(d,'employee-2',false,T2)
  assert.deepEqual(clone(m.selectEmployees(updated,' ana ','all','az').map(e=>e.id)),['employee-1'])
  assert.deepEqual(clone(m.selectEmployees(updated,'front desk','all','az').map(e=>e.id)),['employee-2'])
  assert.deepEqual(clone(m.selectEmployees(updated,'','inactive','az').map(e=>e.id)),['employee-2'])
  assert.equal(m.selectEmployees(updated,'','active','az').length,2)
  assert.equal(m.selectEmployees(updated,'','all','az').length,3)
})
test('Name A–Z, Name Z–A, and newest-first sorting are deterministic', () => {
  const d=add(add(base(),'Zoe','restaurant','employee-1',T1),'Adam','admin','employee-2',T2)
  assert.deepEqual(clone(m.selectEmployees(d,'','all','az').filter(e=>!e.protected).map(e=>e.fullName)),['Adam','Zoe'])
  assert.deepEqual(clone(m.selectEmployees(d,'','all','za').filter(e=>!e.protected).map(e=>e.fullName)),['Zoe','Adam'])
  assert.deepEqual(clone(m.selectEmployees(d,'','all','newest').map(e=>e.id)),['employee-2','employee-1','system-super-admin'])
})

function storageHarness(initialRaw=null) {
  let raw=initialRaw
  let writes=0
  const events=[]
  const localStorage={
    getItem(key){assert.equal(key,'resortos.employees.v1');return raw},
    setItem(key,value){assert.equal(key,'resortos.employees.v1');raw=value;writes++}
  }
  const s=compile('src/features/employees/storage.ts',{'./model':m},{
    localStorage,window:{dispatchEvent:event=>events.push(event.type)},
    Event:class {constructor(type){this.type=type}}
  })
  return {s,events, get raw(){return raw}, set raw(v){raw=v}, get writes(){return writes}}
}
test('create, edit, deactivate, reactivate, delete all persist across fresh reads', () => {
  const h=storageHarness()
  let current=h.s.readEmployees().data
  const transitions=[
    d=>add(d),
    d=>m.saveEmployee(d,{id:'employee-1',fullName:'Updated Name',role:'admin'},T2),
    d=>m.setEmployeeStatus(d,'employee-1',false,T2),
    d=>m.setEmployeeStatus(d,'employee-1',true,T3),
    d=>m.deleteEmployee(d,'employee-1')
  ]
  for(const action of transitions){const next=action(current);h.s.writeEmployees(next,current.revision);current=h.s.readEmployees().data}
  assert.equal(current.revision,5)
  assert.equal(current.employees.length,1)
  assert.equal(h.events.length,5)
  assert.equal(h.writes,5)
})
test('stale writes are rejected, including after another tab changes the revision', () => {
  const h=storageHarness()
  const a=h.s.readEmployees().data
  const newA=add(a)
  h.s.writeEmployees(newA,0)
  assert.throws(()=>h.s.writeEmployees(add(a,'Other','admin','employee-2'),0),/another tab/i)
  assert.equal(h.s.readEmployees().data.employees[1].id,'employee-1')
})
test('malformed JSON and invalid data are left untouched, not silently overwritten', () => {
  for(const bad of ['{not JSON}',JSON.stringify({version:1,revision:5,employees:[{role:'super-admin',id:'hacker'}]}),
    JSON.stringify({version:2,revision:0,employees:[]})]) {
    const h=storageHarness(bad)
    assert.match(h.s.readEmployees().error,/unreadable|invalid/)
    assert.equal(h.writes,0)
    assert.equal(h.raw,bad)
    assert.throws(()=>h.s.writeEmployees(add(base()),0),/invalid|unreadable/)
  }
})
test('missing canonical Super Admin is restored once without discarding ordinary rows', () => {
  const original=add(base())
  const raw=JSON.stringify({...original,employees:original.employees.slice(1)})
  const h=storageHarness(raw)
  const first=h.s.readEmployees()
  assert.equal(first.error,null)
  assert.match(first.notice,/restored/)
  assert.equal(first.data.revision,original.revision+1)
  assert.equal(first.data.employees.filter(e=>e.role==='super-admin').length,1)
  assert.equal(first.data.employees[1].fullName,'Moy Cruz')
  assert.equal(h.writes,1)
  assert.equal(h.s.readEmployees().notice,null)
  assert.equal(h.writes,1)
})
test('a tampered canonical status or role is restored while preserving valid staff', () => {
  const original=add(base())
  const raw=JSON.stringify({...original,employees:[{...original.employees[0],active:false,role:'admin',fullName:'Tampered'},original.employees[1]]})
  const h=storageHarness(raw)
  const {data,error,notice}=h.s.readEmployees()
  assert.equal(error,null)
  assert.match(notice,/restored/)
  assert.equal(data.employees[0].role,'super-admin')
  assert.equal(data.employees[0].active,true)
  assert.equal(data.employees[0].fullName,'System Administrator')
  assert.equal(data.employees[1].fullName,'Moy Cruz')
})
test('unknown second Super Admin and forged ordinary protected flags are rejected without overwriting storage', () => {
  const original=add(base())
  for(const forged of [{...original.employees[1],role:'super-admin'}, {...original.employees[1],protected:true}]) {
    const raw=JSON.stringify({...original,employees:[original.employees[0],forged]})
    const h=storageHarness(raw)
    assert.match(h.s.readEmployees().error,/invalid/)
    assert.equal(h.writes,0)
    assert.equal(h.raw,raw)
  }
})
test('routing, top-level dirty tracking, management tool and stylesheet are integrated', () => {
  const source=p=>fs.readFileSync(p,'utf8')
  assert.match(source('src/shell/navigation.ts'),/systems\/employees/)
  assert.match(source('src/shell/navigation.ts'),/\| 'employees'/)
  assert.match(source('src/App.tsx'),/case 'employees'/)
  assert.match(source('src/App.tsx'),/employeesDirty/)
  assert.match(source('src/features/system-management/SystemManagement.tsx'),/#systems\/employees/)
  assert.match(source('src/main.tsx'),/features\/employees\/employees\.css/)
  assert.match(source('src/features/employees/Employees.tsx'),/No employees found/)
  assert.match(source('src/features/employees/Employees.tsx'),/useDiscardConfirmation/)
  assert.match(source('src/features/employees/Employees.tsx'),/employee\.id !== SUPER_ADMIN_ID/)
  assert.doesNotMatch(source('src/features/employees/Employees.tsx'),/dangerouslySetInnerHTML/)
})
test('Employees deep link resolves to the Admin workspace and generates a stable canonical hash', () => {
  const location={hash:'#/systems/employees'}
  const nav=compile('src/shell/navigation.ts',{'./assets':{publicAsset:path=>path}},{location})
  assert.equal(nav.routeFromHash(),'employees')
  assert.equal(nav.hashForRoute('employees'),'#systems/employees')
  assert.equal(nav.departmentForRoute('employees'),'admin')
  location.hash='#systems/employees'
  assert.equal(nav.routeFromHash(),'employees')
  location.hash='#/restaurant/orders'
  assert.equal(nav.routeFromHash(),'restaurant-orders')
  location.hash='#/front-desk/rooms'
  assert.equal(nav.routeFromHash(),'front-desk-rooms')
})
