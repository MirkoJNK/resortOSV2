import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from './helpers/source-for-legacy-checks.mjs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
const require=createRequire(import.meta.url)
const ts=require('typescript')
function load(path){
 const code=readFileSync(new URL(path,import.meta.url),'utf8')
 const js=ts.transpileModule(code,{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const module={exports:{}}
 const localRequire=(name)=>name==='./demo'?demo:name.includes('demo')?demo:{}
 const fn=vm.runInThisContext(`(function(require,module,exports){${js}\n})`)
 fn(localRequire,module,module.exports)
 return module.exports
}
const demo=load('../src/data/demo.ts')
const {qualityStore,qualityScenario,qualitySupportTickets}=load('../src/data/qualityFixtures.ts')
test('QA URL modes are valid and unknown URL mode is ignored',()=>{
 assert.equal(qualityScenario('?qa=empty'),'empty')
 assert.equal(qualityScenario('?qa=stress'),'stress')
 assert.equal(qualityScenario('?qa=quiet'),'quiet')
 assert.equal(qualityScenario('?qa=untrusted'),'default')
})
test('empty QA removes dashboard records without changing the original demo store',()=>{
 const before=demo.createDemoStore(),snapshot=JSON.stringify(before)
 const empty=qualityStore(before,'empty')
 for(const name of ['employees','payments','events','approvals'])assert.equal(empty[name].length,0)
 assert.equal(JSON.stringify(before),snapshot)
})
test('stress QA supports huge ticket counts and long names without changing the original',()=>{
 const before=demo.createDemoStore(),snapshot=JSON.stringify(before)
 const stress=qualityStore(before,'stress')
 assert.equal(qualitySupportTickets([{id:'2481',status:'Open',priority:'High'}],'stress').length,1024)
 assert.ok(stress.employees[0].name.length>40)
 assert.ok(stress.payments[0].amount>999999999)
 assert.equal(JSON.stringify(before),snapshot)
})
test('quiet QA never hides or mutates underlying records',()=>{
 const before=demo.createDemoStore()
 const quiet=qualityStore(before,'quiet')
 const tickets=[{id:'2481',status:'Open',priority:'Urgent'},{id:'2482',status:'In progress',priority:'Low'}]
 assert.ok(qualitySupportTickets(tickets,'quiet').every(t=>t.status==='Closed'))
 assert.equal(tickets[0].status,'Open')
 assert.equal(qualityStore(before,'default'),before)
})

test('support QA fixture scenarios only modify preview copies and use Closed terminology',()=>{
 const tickets=[{id:'2481',status:'Open',priority:'Urgent'}]
 assert.strictEqual(qualitySupportTickets(tickets,'default'),tickets)
 assert.deepEqual(qualitySupportTickets(tickets,'empty'),[])
 assert.equal(qualitySupportTickets(tickets,'quiet')[0].status,'Closed')
 assert.equal(tickets[0].status,'Open')
})
