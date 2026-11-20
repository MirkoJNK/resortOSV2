import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
async function source(entry) {
  const result = await build({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',
    packages:'external',jsx:'automatic',write:false,logLevel:'silent',
    define:{'import.meta.env.BASE_URL':'"/"'}})
  const mod={exports:{}}
  new Function('module','exports','require',result.outputFiles[0].text)(mod,mod.exports,require)
  return mod.exports
}
const employees = await source('src/features/employees/model.ts')
const accountOptions = await source('src/shell/accountOptions.ts')
const access = await source('src/features/demo/access.ts')
const pictures = await source('src/shared/MenuFallbackImage.tsx')
const at = '2026-11-20T03:00:00.000Z'
const add = (directory,id,fullName,role='front-desk') =>
  employees.saveEmployee(directory,{fullName,role},at,id)
const choices = directory => accountOptions.activeAccountOptions(directory.employees)
const ids = directory => choices(directory).map(item => item.id)

test('every active newly created employee enters the switcher, with Super Admin first',()=>{
  let directory=employees.emptyEmployeeDirectory()
  directory=add(directory,'new-frontdesk','Zoe Santos')
  directory=add(directory,'new-restaurant','Ari Cruz','restaurant')
  assert.deepEqual(ids(directory),['system-super-admin','new-restaurant','new-frontdesk'])
  assert.deepEqual(choices(directory).map(employees.displayEmployeeName),['Admin','Ari Cruz','Zoe Santos'])
  assert.equal(choices(directory).find(item=>item.id==='new-frontdesk').role,'front-desk')
  assert.equal(access.resolveDemoAccount(directory,'new-frontdesk').id,'new-frontdesk')
})
test('preexisting seeded identities remain selectable after new additions',()=>{
  let directory=employees.emptyEmployeeDirectory()
  for(const [id,name,role] of [['demo-restaurant-luis','Luis Ramos','restaurant'],
    ['demo-restaurant-moy','Moy Rivera','restaurant'],['demo-frontdesk-sofia','Sofia Cruz','front-desk']])
    directory=add(directory,id,name,role)
  directory=add(directory,'new','Ben Torres')
  assert.deepEqual(new Set(ids(directory)),new Set(['system-super-admin','demo-restaurant-luis',
    'demo-restaurant-moy','demo-frontdesk-sofia','new']))
})
test('deactivate/reactivate is reflected without a seed-list rebuild',()=>{
  let directory=add(employees.emptyEmployeeDirectory(),'employee-1','Ana Reyes')
  directory=employees.setEmployeeStatus(directory,'employee-1',false,at)
  assert.deepEqual(ids(directory),['system-super-admin'])
  directory=employees.setEmployeeStatus(directory,'employee-1',true,at)
  assert.deepEqual(ids(directory),['system-super-admin','employee-1'])
})
test('rename and role edits appear immediately from the latest directory',()=>{
  let directory=add(employees.emptyEmployeeDirectory(),'employee-1','Zoe Ramos')
  directory=employees.saveEmployee(directory,{id:'employee-1',fullName:'Bea Ramos',role:'restaurant'},at)
  assert.deepEqual(choices(directory).map(item=>[item.fullName,item.role]),
    [['System Administrator','super-admin'],['Bea Ramos','restaurant']])
})
test('duplicate display names are separate IDs with stable deterministic order',()=>{
  let directory=add(employees.emptyEmployeeDirectory(),'z-id','Same Name')
  directory=add(directory,'a-id','Same Name')
  assert.deepEqual(ids(directory),['system-super-admin','a-id','z-id'])
  assert.deepEqual(ids(directory),ids(directory))
})
test('inactive current account resolves to protected fallback and loses route permissions',()=>{
  let directory=add(employees.emptyEmployeeDirectory(),'employee-1','Front Desk Employee')
  const individual=choices(directory).find(item=>item.id==='employee-1')
  const state={version:1,revision:0,subroles:[],access:[],events:[]}
  assert.equal(access.canAccessRoute(state,individual,'front-desk-dashboard'),true)
  assert.equal(access.canAccessRoute(state,individual,'employees'),false)
  directory=employees.setEmployeeStatus(directory,'employee-1',false,at)
  assert.equal(access.resolveDemoAccount(directory,'employee-1').id,'system-super-admin')
  assert.equal(access.canAccessRoute(state,directory.employees.find(item=>item.id==='employee-1'),'front-desk-dashboard'),false)
  assert.equal(choices(directory).some(item=>item.id==='employee-1'),false)
})
test('uploaded images win, removing them displays the correct static decorative fallback',()=>{
  for(const [kind,asset,label] of [
    ['category','menu-category-fallback.png','Category: Appetizers'],
    ['item','menu-item-fallback.png','Menu item: Calamansi Juice']
  ]){
    const render=image=>renderToStaticMarkup(React.createElement(pictures.MenuFallbackImage,{
      kind,image,name:kind==='item'?'Calamansi Juice':'Appetizers',large:true}))
    const fallback=render(undefined)
    assert.ok(fallback.includes('/assets/'+asset))
    assert.ok(fallback.includes('class="mc-fallback-art"'))
    assert.ok(fallback.includes('alt=""'))
    assert.ok(fallback.includes('aria-hidden="true"'))
    const uploaded=render('blob:employee-upload')
    assert.ok(uploaded.includes('blob:employee-upload'))
    assert.ok(uploaded.includes('alt="'+label+'"'))
    assert.ok(!uploaded.includes(asset))
    assert.equal(render(undefined),fallback)
  }
})
test('supplied fallback assets are non-empty PNGs, referenced by both lists and editors',()=>{
  for(const name of ['menu-category-fallback.png','menu-item-fallback.png']){
    const path='public/assets/'+name
    assert.ok(statSync(path).size>10_000)
    assert.deepEqual([...readFileSync(path).subarray(0,8)],[137,80,78,71,13,10,26,10])
  }
  for(const [file,kind] of [
    ['src/features/menu-categories/MenuCategories.tsx','category'],
    ['src/features/menu-management/MenuManagement.tsx','item']
  ]){
    const src=readFileSync(file,'utf8')
    assert.ok(src.includes('MenuFallbackImage'))
    assert.ok(src.includes('kind="'+kind+'"'))
    assert.ok(src.includes('image={imageUrl}'))
    assert.ok(src.includes('image={item.imageId')||src.includes('image={category.imageId'))
  }
})
test('image removal and upload controls still depend on actual upload state, not fallback URLs',()=>{
  const categories=readFileSync('src/features/menu-categories/MenuCategories.tsx','utf8')
  const items=readFileSync('src/features/menu-management/MenuManagement.tsx','utf8')
  assert.ok(categories.includes('{imageUrl && <button'))
  assert.ok(items.includes('{imageUrl && <button'))
  for(const sourceCode of [categories,items]){
    assert.ok(sourceCode.includes("draft?.imageAction === 'remove' ? undefined"))
    assert.ok(sourceCode.includes("imageAction: 'remove', pending: null"))
    assert.ok(!sourceCode.includes("imageId: '/assets/"))
  }
})
