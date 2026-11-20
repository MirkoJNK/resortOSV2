import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = fs.readFileSync('src/features/service-catalog/model.ts','utf8')
const js = ts.transpileModule(source,{fileName:'service-model.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const store = () => {let raw=null,calls=0;return {getItem(){return raw},setItem(_key,value){raw=value;calls++},get raw(){return raw},set raw(v){raw=v},get calls(){return calls}}}
function load(storage=store(), nextId=()=> 'uuid-fresh-1') {
  const mod={exports:{}}
  vm.runInNewContext(js,{module:mod,exports:mod.exports,console,Date,Intl,Number,BigInt,Set,JSON,Math,crypto:{randomUUID:nextId},localStorage:storage,
    require:name=>name==='../audit-log/storage'?{recordCollection(){}}:(()=>{throw Error('Unexpected '+name)})()},{filename:'service-model.js'})
  return mod.exports
}
const plain = x=>JSON.parse(JSON.stringify(x))
const s=()=>load()
test('eight approved sample services and only nine approved properties',()=>{
 const data=s().sampleDirectory.services
 assert.equal(data.length,8)
 for(const item of data)assert.deepEqual(Object.keys(plain(item)).sort(),['code','createdAt','description','id','name','priceCents','status','unit','updatedAt'])
 assert.equal(data.filter(x=>x.status==='active').length,7)
 assert.equal(data.filter(x=>x.status==='inactive').length,1)
})
test('currency parses whole and fractional centavos exactly',()=>{
 const m=s();for(const [value,cents] of [['500',50000],['0.01',1],['500.00',50000],['00080.50',8050],['9999999.99',999999999]])assert.equal(m.parseCentavos(value),cents)
})
test('currency rejects scientific notation, negatives, too many decimals and overflow',()=>{
 const m=s();for(const v of ['-2','1e6','1.001','Infinity','NaN','₱80','999999999.99','1.2.3',''])assert.equal(m.parseCentavos(v),null,v)
})
test('exact fixed-price service ignores a quantity field',()=>{
 const m=s(),result=m.calculatePrice(80000,'fixed','')
 assert.equal(result.ok,true);assert.equal(result.value.totalCents,80000)
 assert.equal(m.calculatePrice(80000,'fixed','42').value.totalCents,80000)
})
test('Motorbike daily pricing: 500 pesos x 3 = 1500',()=>assert.equal(s().calculatePrice(50000,'day','3').value.totalCents,150000))
test('Laundry pricing: 80 pesos per kilo x 2.5 = 200',()=>assert.equal(s().calculatePrice(8000,'kg','2.5').value.totalCents,20000))
test('Equipment rental pricing: 150 pesos/hour x 4 = 600',()=>assert.equal(s().calculatePrice(15000,'hour','4').value.totalCents,60000))
test('small fractional quantity uses exact BigInt half-up centavo rounding',()=>{
 const m=s();assert.equal(m.calculatePrice(101,'kg','0.1').value.totalCents,10)
 assert.equal(m.calculatePrice(105,'kg','0.1').value.totalCents,11)
})
test('item, trip, day, and service units require whole quantities',()=>{
 const m=s();for(const unit of ['item','trip','day','service']){
   assert.equal(m.calculatePrice(100,unit,'3').ok,true)
   assert.equal(m.calculatePrice(100,unit,'1.5').ok,false,unit)
 }
})
test('hourly units accept half hours and reject quarter hours',()=>{
 const m=s();assert.equal(m.calculatePrice(10000,'hour','1.5').value.totalCents,15000)
 assert.equal(m.calculatePrice(10000,'hour','1.25').ok,false)
})
test('kilograms accept tenths and reject hundredths',()=>{
 const m=s();assert.equal(m.calculatePrice(10000,'kg','0.1').value.totalCents,1000)
 assert.equal(m.calculatePrice(10000,'kg','0.25').ok,false)
})
test('zero, negative, invalid, huge or fractional-overprecise quantities are rejected',()=>{
 const m=s();for(const q of ['0','-3','NaN','Infinity','1e4','2.2345','1001',''])assert.equal(m.calculatePrice(5000,'kg',q).ok,false,q)
})
test('zero, noninteger, excessive or invalid prices are rejected',()=>{
 const m=s();for(const c of [0,-1,NaN,Infinity,1.5,1000000000])assert.equal(m.calculatePrice(c,'kg','2').ok,false,String(c))
})
test('peso formatting is visibly Philippine currency',()=>{const m=s();assert.match(m.peso(123456),/₱1,234\.56/)})
test('names are required and normalized',()=>{
 const m=s(),draft={name:'    ',code:'',description:'',unit:'day',price:'500'}
 assert.match(m.validateDraft(draft,[]).errors.name,/required/)
 draft.name='  Motorbike   Hire ';assert.equal(m.validateDraft(draft,[]).cleaned.name,'Motorbike Hire')
})
test('all names are unique without regard to case or surrounding spaces',()=>{
 const m=s(),r=m.sampleDirectory.services
 assert.match(m.validateDraft({name:'   mOtOrBiKe    rEnTaL ',code:'',description:'',unit:'day',price:'500'},r).errors.name,/already exists/)
})
test('duplicate service codes are rejected case insensitively',()=>{
 const m=s(),r=m.sampleDirectory.services
 assert.match(m.validateDraft({name:'Unused',code:'bIkE',description:'',unit:'day',price:'2'},r).errors.code,/already in use/)
})
test('duplicate inactive name and code are rejected',()=>{
 const m=s(),r=m.sampleDirectory.services
 assert.match(m.validateDraft({name:'luggage storage',code:'',description:'',unit:'day',price:'2'},r).errors.name,/already exists/)
 assert.match(m.validateDraft({name:'Never used',code:'luggage',description:'',unit:'day',price:'2'},r).errors.code,/already in use/)
})
test('editing self with unchanged name/code is allowed',()=>{
 const m=s(),r=m.sampleDirectory.services[0],v=m.validateDraft({...r,price:'500'},m.sampleDirectory.services,r.id)
 assert.equal(Object.keys(v.errors).length,0)
})
test('code and description are optional',()=>{
 const m=s();assert.equal(Object.keys(m.validateDraft({name:'New',code:'',description:'',unit:'fixed',price:'500'},[]).errors).length,0)
})
test('limits are enforced for name, code, and description',()=>{
 const m=s(),v=m.validateDraft({name:'a'.repeat(61),code:'b'.repeat(21),description:'c'.repeat(181),unit:'day',price:'2'},[])
 assert.equal(Object.keys(v.errors).length,3)
})
test('price must be a positive amount with no more than two decimal places',()=>{
 const m=s();for(const price of ['0','0.00','1.234','-2',''])assert.match(m.validateDraft({name:'New',code:'',description:'',unit:'fixed',price},[]).errors.price,/valid price/)
})
test('seven approved billing units are present',()=>assert.deepEqual(plain(s().unitKeys).sort(),['day','fixed','hour','item','kg','service','trip']))
test('invalid billing unit is rejected',()=>{
 const m=s();assert.match(m.validateDraft({name:'New',code:'',description:'',unit:'invalid',price:'10'},[]).errors.unit,/valid billing unit/)
})
test('catalog search matches both service names and codes, including inactive',()=>{
 const m=s(),r=m.sampleDirectory.services
 assert.equal(m.selectServices(r,'LAUNDRY','all','az').length,1)
 assert.equal(m.selectServices(r,'luggage','all','az').length,1)
 assert.equal(m.selectServices(r,'luggage','active','az').length,0)
 assert.equal(m.selectServices(r,'luggage','inactive','az').length,1)
})
test('natural name sorting and reverse sorting are stable without mutation',()=>{
 const m=s(),records=['Service 10','Service 2','Service 1'].map((name,i)=>({...m.sampleDirectory.services[i],name}));const before=plain(records)
 assert.deepEqual(plain(m.selectServices(records,'','all','az').map(x=>x.name)),['Service 1','Service 2','Service 10'])
 assert.deepEqual(plain(m.selectServices(records,'','all','za').map(x=>x.name)),['Service 10','Service 2','Service 1'])
 assert.deepEqual(plain(records),before)
})
test('new service gets a unique immutable identity and active default',()=>{
 const m=s(),r=m.createService({name:'  Test ',code:' T ',description:'',unit:'fixed',price:'100'},10000,m.sampleDirectory.services,'2026-11-06T03:00:00.000Z',()=> 'unique-test')
 assert.equal(r.id,'unique-test');assert.equal(r.status,'active');assert.equal(r.name,'Test');assert.equal(r.createdAt,r.updatedAt)
})
test('duplicate UUID retries until a unique ID is available',()=>{
 let count=0;const m=load(store(),()=>count++===0?'sample-service-001':'next-unique')
 const r=m.createService({name:'New',code:'',description:'',unit:'day',price:'1'},100,m.sampleDirectory.services)
 assert.equal(r.id,'next-unique')
})
test('rename and deactivation can preserve original ID and createdAt',()=>{
 const m=s(),r=m.sampleDirectory.services[0],other={...r,name:'Changed',status:'inactive',updatedAt:'2027-01-01T00:00:00Z'}
 assert.equal(r.id,other.id);assert.equal(r.createdAt,other.createdAt)
})
test('catalog rejects duplicate immutable IDs',()=>{
 const m=s(),d=m.copyDirectory(m.sampleDirectory);d.services[1].id=d.services[0].id;assert.equal(m.validateDirectory(d),false)
})
test('catalog rejects duplicate inactive identities and codes',()=>{
 const m=s(),d=m.copyDirectory(m.sampleDirectory);d.services[0].code=d.services[6].code;assert.equal(m.validateDirectory(d),false)
})
test('catalog rejects malicious unexpected properties, status, timestamps, and prices',()=>{
 const m=s();for(const patch of [{guest:'secret'}, {status:'deleted'}, {createdAt:'bad'}, {priceCents:-1}, {unit:'bogus'}, {priceCents:1.25}]){
   const d=m.copyDirectory(m.sampleDirectory);d.services[0]={...d.services[0],...patch};assert.equal(m.validateDirectory(d),false,JSON.stringify(patch))
 }
})
test('deliberately empty catalog is valid',()=>assert.equal(s().validateDirectory({version:1,services:[]}),true))
test('first run seeds sample records but does not write until explicit Save',()=>{
 const st=store(),m=load(st);assert.equal(m.readServices().data.services.length,8);assert.equal(st.calls,0)
})
test('explicit Save and reload preserve records',()=>{
 const st=store(),m=load(st),d=m.copyDirectory(m.sampleDirectory)
 d.services[0].priceCents=60000;assert.equal(m.writeServices(d).ok,true)
 const r=m.readServices();assert.equal(r.data.services[0].priceCents,60000)
 assert.equal(r.data.services[0].id,d.services[0].id)
})
test('deliberately empty saved catalog remains empty after reload',()=>{
 const st=store(),m=load(st);assert.equal(m.writeServices({version:1,services:[]}).ok,true)
 assert.equal(m.readServices().data.services.length,0)
})
test('corrupt JSON is not overwritten automatically',()=>{
 const st=store();st.raw='{invalid-json';const m=load(st),r=m.readServices()
 assert.equal(r.recoverable,false);assert.equal(st.raw,'{invalid-json');assert.match(r.error,/read/)
})
test('malformed saved objects are not overwritten automatically',()=>{
 const st=store();st.raw='{"version":1,"services":[{"id":"broken"}]}';const m=load(st),r=m.readServices()
 assert.equal(r.recoverable,false);assert.match(r.error,/invalid/);assert.match(st.raw,/broken/)
})
test('storage exceptions do not report successful persistence',()=>{
 const m=load({getItem(){return null},setItem(){throw Error('quota')}})
 assert.equal(m.writeServices(m.sampleDirectory).ok,false)
})
test('invalid saved records are rejected without touching storage',()=>{
 const st=store(),m=load(st);const d=m.copyDirectory(m.sampleDirectory);d.services[0].unit='unknown'
 assert.equal(m.writeServices(d).ok,false);assert.equal(st.calls,0)
})
test('all service data uses separate storage namespace from Rooms and Tables',()=>{
 const m=s();assert.equal(m.STORAGE_KEY,'resortos.service-catalog.v1')
 assert.equal(m.STORAGE_KEY.includes('rooms-manager'),false);assert.equal(m.STORAGE_KEY.includes('tables-manager'),false)
})
test('source preserves Concept B list and exact Rooms Manager toolbar without unrelated actions',()=>{
 const jsx=fs.readFileSync('src/features/service-catalog/ServiceCatalog.tsx','utf8')
 for(const word of ['sc-service-row','sc-row-extra','sc-inline-add','rm-toolbar','rm-b-tabs','rm-select','rm-btn-primary','Receipt','sc-preview'])assert.ok(jsx.includes(word),word)
 assert.doesNotMatch(jsx, /Delete Service|Room balance|Post charge|Acknowledged/)
})
test('pricing preview does not render redundant formulas or explanation text',()=>{
 const jsx=fs.readFileSync('src/features/service-catalog/ServiceCatalog.tsx','utf8')
 assert.doesNotMatch(jsx,/Example only|No room charge is posted|One posting|Fixed amount per service posting|×.*=/)
})
test('nested Service Catalog routing and 3 authorized tool links exist',()=>{
 const nav=fs.readFileSync('src/shell/navigation.ts','utf8'),sys=fs.readFileSync('src/features/system-management/SystemManagement.tsx','utf8'),app=fs.readFileSync('src/App.tsx','utf8')
 assert.match(nav,/systems\/services/);assert.match(app,/case 'services':/)
 assert.match(sys, /tool\.id === 'services'/)
 assert.match(sys, /#systems\/rooms/);assert.match(sys, /#systems\/tables/);assert.match(sys, /#systems\/services/)
})
test('new service approvals protect only scoped feature and authorized shared routes',()=>{
 const approvals=JSON.parse(fs.readFileSync('SERVICE_CATALOG_APPROVED.json','utf8'))
 const {typescriptSemanticHash}=require('../scripts/typescript-semantic.cjs')
 const {cssSemanticHash}=require('../scripts/css-semantic.cjs')
 for(const [key,file] of [['serviceModelHash','src/features/service-catalog/model.ts'],['serviceComponentHash','src/features/service-catalog/ServiceCatalog.tsx']]) {
  if (file.endsWith('ServiceCatalog.tsx')) {
    const hotfix = JSON.parse(fs.readFileSync('GLOBAL_UI_HOTFIX_APPROVED.json', 'utf8')).approved_source[file]
    assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex'), hotfix.after)
  } else assert.equal(approvals[key],typescriptSemanticHash(file))
 }
 assert.equal(approvals.serviceStylesHash,cssSemanticHash('src/features/service-catalog/service-catalog.css'))
})
