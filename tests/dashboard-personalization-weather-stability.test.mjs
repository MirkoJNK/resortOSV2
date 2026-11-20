import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {build} from 'esbuild'
import {parseCurrentWeather,createWeatherEndpoint} from '../server/weather-api.mjs'

const require=createRequire(import.meta.url)
async function load(path){
  const result=await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',write:false,
    packages:'external',jsx:'automatic',define:{'import.meta.env.BASE_URL':'"/"'}})
  const module={exports:{}}
  new Function('module','exports','require',result.outputFiles[0].text)(module,module.exports,require)
  return module.exports
}
const {greetingForPhilippineTime,philippineDashboardDate}=await load('src/features/dashboard/dashboardGreeting.ts')
const employee=await load('src/features/employees/model.ts')
const {displayActorName}=await load('src/features/audit-log/actor.ts')
const {conditionIcon,DashboardHero,DashboardGreeting}=await load('src/features/dashboard/DashboardVisuals.tsx')
const icon=require('lucide-react')
const source=(path)=>fs.readFileSync(path,'utf8')
const when=(s)=>new Date(s)
const account=(id,name)=>({id,fullName:name})
const admin=employee.systemAdministrator()
const luis=account('demo-restaurant-luis',' Luis   Ramos ')
const sofia=account('demo-frontdesk-sofia','Sofia Cruz')
const cebuReading=(overrides={})=>({temp_c:30.5,condition:{code:1003,text:'Partly cloudy'},
  is_day:1,last_updated_epoch:1795032360,...overrides})
const provider=(overrides={})=>({current:cebuReading(overrides)})
const http=async(endpoint,{ip='127.0.0.1',method='GET'}={})=>{
  const headers=new Map(),res={statusCode:200,setHeader:(name,value)=>headers.set(name,value),end(body){this.body=body??''}}
  await endpoint({method,socket:{remoteAddress:ip}},res)
  return {status:res.statusCode,body:res.body?JSON.parse(res.body):null,headers}
}

test('morning until 11:59 in Manila and afternoon begins at noon',()=>{
  assert.equal(greetingForPhilippineTime(when('2026-11-19T03:59:59Z'),luis),'Good morning, Luis')
  assert.equal(greetingForPhilippineTime(when('2026-11-19T04:00:00Z'),luis),'Good afternoon, Luis')
})
test('afternoon until 17:59, evening begins 18:00 and ends 23:59 Manila',()=>{
  assert.equal(greetingForPhilippineTime(when('2026-11-19T09:59:59Z'),sofia),'Good afternoon, Sofia')
  assert.equal(greetingForPhilippineTime(when('2026-11-19T10:00:00Z'),sofia),'Good evening, Sofia')
  assert.equal(greetingForPhilippineTime(when('2026-11-19T15:59:59Z'),sofia),'Good evening, Sofia')
})
test('Philippine date rollover is independent of execution host timezone',()=>{
  assert.equal(greetingForPhilippineTime(when('2026-11-19T16:00:00Z'),sofia),'Good morning, Sofia')
  assert.match(philippineDashboardDate(when('2026-11-19T16:00:00Z')),/(Fri|Nov 20|20, 2026)/)
})
test('account switch rerenders identity and handles whitespace / missing names',()=>{
  const at=when('2026-11-19T04:00:00Z')
  assert.equal(greetingForPhilippineTime(at,luis),'Good afternoon, Luis')
  assert.equal(greetingForPhilippineTime(at,sofia),'Good afternoon, Sofia')
  assert.equal(greetingForPhilippineTime(at,account('other','   ')),'Good afternoon, Employee')
})
test('protected ID renders Admin while underlying canonical identity and directory validation remain untouched',()=>{
  assert.equal(admin.fullName,'System Administrator')
  assert.equal(admin.id,'system-super-admin')
  assert.equal(employee.displayEmployeeName(admin),'Admin')
  assert.equal(greetingForPhilippineTime(when('2026-11-19T01:00:00Z'),admin),'Good morning, Admin')
  assert.equal(employee.roleLabels[admin.role],'Super Admin')
  assert.ok(employee.isValidEmployeeDirectory(employee.emptyEmployeeDirectory()))
  assert.equal(employee.displayEmployeeName(account('other','System Administrator')),'System Administrator')
})
test('audit actors use verified administrator ID only; unknown and other snapshots remain truthful',()=>{
  assert.equal(displayActorName({id:'system-super-admin',source:'client-unverified',nameSnapshot:'System Administrator'}),'Admin')
  assert.equal(displayActorName({id:'staff-1',source:'client-unverified',nameSnapshot:'System Administrator'}),'System Administrator')
  assert.equal(displayActorName({id:null,source:'unknown'}),'Not recorded')
})
test('shared greeting props are active accounts and all hardcoded weather/slogan overlays are removed',()=>{
  const visuals=source('src/features/dashboard/DashboardVisuals.tsx')
  assert.match(visuals,/DashboardGreeting\(\{ account \}/)
  assert.ok(!visuals.includes('Good morning, {employee}'))
  assert.ok(!visuals.includes('28°C'))
  assert.ok(!visuals.includes('art-copy'))
  assert.ok(!visuals.includes('art-underline'))
  for(const page of ['src/features/dashboard/Dashboard.tsx','src/features/restaurant/RestaurantDashboard.tsx',
    'src/features/front-desk/FrontDeskDashboard.tsx'])assert.match(source(page),/<DashboardGreeting account=\{account\}/)
  assert.match(source('src/App.tsx'),/account=\{activeAccount\}/)
})
test('approved illustration pixels stay byte-identical and floating weather remains',()=>{
  assert.equal(createHash('sha256').update(fs.readFileSync('public/assets/resort-illustration.png')).digest('hex'),
    '8ecfcd238e1a7b588a8814f654d49298a50557225a0e3dce6a0fefed37368d82')
  assert.match(source('src/features/dashboard/DashboardVisuals.tsx'),/className=\{`weather /)
  assert.match(source('src/styles/app.css'),/\.weather\s*\{/)
})
test('weather icons distinguish day sun, night clear, cloud, rain, snow, fog and storm',()=>{
  const make=(code,isDay=true)=>({conditionCode:code,isDay})
  assert.equal(conditionIcon(make(1000)),icon.Sun)
  assert.equal(conditionIcon(make(1000,false)),icon.Moon)
  assert.equal(conditionIcon(make(1003)),icon.CloudSun)
  assert.equal(conditionIcon(make(1006)),icon.Cloud)
  assert.equal(conditionIcon(make(1183)),icon.CloudRain)
  assert.equal(conditionIcon(make(1210)),icon.CloudSnow)
  assert.equal(conditionIcon(make(1135)),icon.CloudFog)
  assert.equal(conditionIcon(make(1273)),icon.CloudLightning)
  assert.equal(conditionIcon(null),icon.CloudOff)
})
test('provider response is reduced to fixed location and whitelisted weather fields',()=>{
  assert.deepEqual(parseCurrentWeather({current:{...cebuReading(),sensitive:'ignored'},location:{name:'Other'}}),{
    tempC:30.5,condition:'Partly cloudy',conditionCode:1003,isDay:true,
    providerUpdatedAt:new Date(1795032360*1000).toISOString(),location:'Cebu City'})
})
test('malformed, misleading or impossible provider responses are rejected',()=>{
  for(const payload of [null,{},provider({temp_c:'30'}),provider({temp_c:Infinity}),
    provider({temp_c:120}),provider({is_day:5}),provider({condition:{code:'1000',text:'Sunny'}}),
    provider({condition:{code:1000,text:'<script>'}}),provider({last_updated_epoch:'bad'})])
    assert.throws(()=>parseCurrentWeather(payload),/Invalid weather/)
})
test('server weather endpoint uses server-only key, exact Cebu location and exposes no credentials',async()=>{
  let upstreamCalls=0,upstreamUrl
  const endpoint=createWeatherEndpoint({apiKey:'local-test-token',now:()=>1795032420000,
    fetchImpl:async url=>{upstreamCalls++;upstreamUrl=url;return {ok:true,json:async()=>provider()}}})
  const response=await http(endpoint)
  assert.equal(response.status,200)
  assert.equal(response.body.weather.tempC,30.5)
  assert.equal(response.body.weather.location,'Cebu City')
  assert.equal(upstreamUrl.searchParams.get('q'),'Cebu City, Philippines')
  assert.equal(upstreamUrl.searchParams.get('aqi'),'no')
  assert.equal(upstreamCalls,1)
  assert.ok(!JSON.stringify(response.body).includes('local-test-token'))
  assert.equal(response.headers.get('Cache-Control'),'no-store')
})
test('server deduplicates concurrent requests and caches for fifteen minutes',async()=>{
  let count=0,now=1795032420000
  const endpoint=createWeatherEndpoint({apiKey:'local-test-token',now:()=>now,
    fetchImpl:async()=>{count++;await new Promise(resolve=>setTimeout(resolve,4));return {ok:true,json:async()=>provider()}}})
  const batch=await Promise.all(Array.from({length:12},()=>http(endpoint)))
  assert.ok(batch.every(item=>item.status===200))
  assert.equal(count,1)
  now+=14*60*1000
  assert.equal((await http(endpoint)).status,200)
  assert.equal(count,1)
  now+=2*60*1000
  assert.equal((await http(endpoint)).status,200)
  assert.equal(count,2)
})
test('missing server credential, upstream 401 and 429 return no fabricated weather or key',async()=>{
  const missing=createWeatherEndpoint({apiKey:''})
  assert.deepEqual((await http(missing)).body,{status:'unavailable'})
  for(const code of [401,429]){
    const endpoint=createWeatherEndpoint({apiKey:'local-test-token',fetchImpl:async()=>({ok:false,status:code})})
    assert.equal((await http(endpoint)).status,503)
    assert.deepEqual((await http(endpoint)).body,{status:'unavailable'})
  }
})
test('server rejects invalid weather and network failure without leaking details',async()=>{
  const invalid=createWeatherEndpoint({apiKey:'local-test-token',fetchImpl:async()=>({ok:true,json:async()=>({current:{temp_c:'bad'}})})})
  const offline=createWeatherEndpoint({apiKey:'local-test-token',fetchImpl:async()=>{throw Error('INTERNAL SECRET ERROR')}})
  for(const endpoint of [invalid,offline]){
    const response=await http(endpoint)
    assert.equal(response.status,503)
    assert.deepEqual(response.body,{status:'unavailable'})
  }
})
test('server aborts a timed-out provider request',async()=>{
  const endpoint=createWeatherEndpoint({apiKey:'local-test-token',timeoutMs:5,
    fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))})
  const response=await http(endpoint)
  assert.equal(response.status,503)
  assert.deepEqual(response.body,{status:'unavailable'})
})
test('server restricts unexpected methods and has per-client rate limiting',async()=>{
  const endpoint=createWeatherEndpoint({apiKey:'local-test-token',fetchImpl:async()=>({ok:true,json:async()=>provider()})})
  assert.equal((await http(endpoint,{method:'POST'})).status,405)
  const results=await Promise.all(Array.from({length:61},()=>http(endpoint,{ip:'test-rate'})))
  assert.equal(results.filter(item=>item.status===429).length,1)
})
test('client shares one weather source with 15-minute cache, timeout, error and unmount-safe subscriptions',()=>{
  const code=source('src/features/weather/weatherStore.ts')
  assert.match(code,/const CACHE_MS=15\*60\*1000/)
  assert.match(code,/if\(inFlight\)return inFlight/)
  assert.match(code,/new AbortController\(\)/)
  assert.match(code,/useSyncExternalStore/)
  assert.match(code,/visibilitychange/)
  assert.match(code,/clearInterval\(interval\)/)
  assert.ok(!code.includes('localStorage'))
  assert.ok(!code.includes('api.weatherapi.com'))
})
test('weather remains same-origin and provider key absent from any frontend module or VITE env',()=>{
  const client=source('src/features/weather/weatherStore.ts')
  const server=source('server/weather-api.mjs')
  assert.match(client,/fetch\('\/api\/weather'/)
  assert.match(server,/process\.env\.WEATHER_API_KEY/)
  assert.ok(!client.includes('WEATHER_API_KEY'))
  assert.ok(!source('vite.config.ts').includes('VITE_WEATHER'))
})
test('fixed scrollbar gutter preserves workspace transition width while loader focus/routing stays intact',()=>{
  const css=source('src/styles/app.css')
  const loader=source('src/shell/WorkspaceTransitionOverlay.tsx')
  assert.match(css,/scrollbar-gutter:\s*stable/)
  assert.match(loader,/document\.body\.style\.overflow = 'hidden'/)
  assert.match(loader,/document\.body\.style\.overflow = previousOverflow/)
  assert.match(loader,/destinationContent\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(loader,/createPortal/)
})
