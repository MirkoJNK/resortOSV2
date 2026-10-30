import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app=fs.readFileSync('src/App.tsx','utf8')
const workspace=fs.readFileSync('src/components/SupportWorkspace.tsx','utf8')
const search=app.slice(app.indexOf('function SearchDialog('),app.indexOf('export function App('))
const nav=app.slice(app.indexOf('const primaryNav:'),app.indexOf('const allNav='))
const header=app.slice(app.indexOf('function Header('),app.indexOf('function ResortArt('))

const dest=[...nav.matchAll(/\{area:'([^']+)',label:'([^']+)'/g)].map(([,area,label])=>({area,label}))
const navSearch=query=>dest.filter(({label})=>`${label} Navigation`.toLowerCase().includes(query.toLowerCase()))

test('global search indexes exactly the four approved navigation pages, and nothing else',()=>{
 assert.deepEqual(dest,[
  {area:'dashboard',label:'Dashboard'},
  {area:'support',label:'Support & Issues'},
  {area:'audit',label:'Audit Log'},
  {area:'systems',label:'System Management'}
 ])
 assert.match(search,/const candidates=allNav\.map\(x=>\(\{name:x\.label,detail:'Navigation',area:x\.area\}\)\)\.filter\(/)
 assert.doesNotMatch(search,/tickets|slice\(0,12\)|subject|requester|#\$\{t\.id\}/i)
 assert.match(app,/<SearchDialog go=\{go\} isOpen=\{searchOpen\}/)
})

test('global search labels and results are page-only and still searchable',()=>{
 assert.match(header,/>Search pages<\/span>/)
 assert.match(search,/placeholder="Search pages"/)
 assert.deepEqual(navSearch(''),dest)
 assert.deepEqual(navSearch('support').map(x=>x.label),['Support & Issues'])
 assert.deepEqual(navSearch('audit').map(x=>x.label),['Audit Log'])
 assert.deepEqual(navSearch('2481'),[])
 assert.deepEqual(navSearch('room key not working'),[])
 assert.deepEqual(navSearch('zzzz'),[])
})

test('search dialog keeps the same focus, keyboard, close, and navigation interactions',()=>{
 assert.match(search,/inputRef\.current\?\.focus\(\)/)
 assert.match(search,/restoreFocus\.current\.focus\(\)/)
 assert.match(search,/const trapFocus=/)
 assert.match(search,/event\.key!=='Tab'/)
 assert.match(search,/role="dialog"/)
 assert.match(search,/onClick=\{\(\)=>\{go\(x\.area\);onClose\(\)\}\}/)
 assert.match(app,/e\.key\.toLowerCase\(\)==='k'/)
 assert.match(app,/if\(e\.key==='Escape'\)/)
})

test('local Support & Issues ticket search and filters remain available',()=>{
 assert.match(workspace,/placeholder="Search tickets"/)
 assert.match(workspace,/aria-label="Search tickets"/)
 assert.match(workspace,/filterSupportTickets\(tickets,filters\)/)
})
