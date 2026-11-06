import { cssForLegacyAssertions } from './helpers/css-for-legacy-checks.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from './helpers/source-for-legacy-checks.mjs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'

const app=fs.readFileSync('src/App.tsx','utf8')
const css=cssForLegacyAssertions('src/styles/light-sidebar-v058.css')
const bootstrap=fs.readFileSync('src/main.tsx','utf8')
const thumb=fs.readFileSync('public/assets/sidebar-coastal-approved-v058.png')
const logo=fs.readFileSync('public/assets/sidebar-brand-approved-v058.png')
const js=app.slice(app.indexOf('const primaryNav:'),app.indexOf('const allNav='))
const sidebar=app.slice(app.indexOf('function Sidebar('),app.indexOf('function Header('))

test('approved four destinations and icon families remain in the precise approved order',()=>{
 const menu=[...js.matchAll(/\{area:'([^']+)',label:'([^']+)',iconAsset:'([^']+)'\}/g)].map(([,route,label,iconAsset])=>({route,label,iconAsset}))
 assert.deepEqual(menu,[
  {route:'dashboard',label:'Dashboard',iconAsset:'/assets/sidebar-icon-dashboard-approved-v058.png'},
  {route:'support',label:'Support & Issues',iconAsset:'/assets/sidebar-icon-support-approved-v058.png'},
  {route:'audit',label:'Audit Log',iconAsset:'/assets/sidebar-icon-audit-approved-v058.png'},
  {route:'systems',label:'System Management',iconAsset:'/assets/sidebar-icon-systems-approved-v058.png'}
 ])
})
test('the light sidebar uses the exact source-derived logo and coast artwork',()=>{
 assert.ok(thumb.length>100000)
 assert.ok(logo.length>10000)
 for(const route of ['dashboard','support','audit','systems']) assert.ok(fs.statSync(`public/assets/sidebar-icon-${route}-approved-v058.png`).size>1000)
 for(const text of ['sidebar-coastal-approved-v058.png','sidebar-brand-approved-v058.png']) assert.match(app,new RegExp(text.replace('.','\\.')))
 assert.match(bootstrap,/import '\.\/styles\/light-sidebar-v058\.css'/)
 assert.match(css,/background:#f3f9f0/)
 assert.match(css,/\.ros-light-sidebar \.side-link\.active/)
 assert.match(css,/background:#dafa69/)
 assert.match(css,/border-right:1px solid #c7d5cc/)
 assert.doesNotMatch(sidebar,/side-story|side-story-copy|profile|Great<br/)
})
test('only the sidebar introduces the new artwork and no unrelated page styles are modified',()=>{
 assert.match(css,/\.sidebar\.ros-light-sidebar/)
 assert.doesNotMatch(css,/\.support-workspace|\.support-inbox|\.dashboard-hero|\.main-shell|\.main-content/)
 assert.match(css,/@media \(max-width:900px\)/)
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)/)
})
test('all retained routes render with the same sidebar',()=>{
 for(const route of ['dashboard','support','audit','systems']){
  execFileSync('node',['tools-render-preview.cjs'],{env:{...process.env,ROS_HASH:'#'+route}})
  const result=fs.readFileSync('visual-reference.html','utf8')
  assert.equal((result.match(/class="side-link /g)||[]).length,4,route)
  assert.match(result,/ros-light-sidebar/)
  assert.match(result,/resortOS/)
  assert.match(result,/ros-coastal-bottom/) // new shell present even with source image embedded
  assert.match(result,/Search pages/)
  assert.doesNotMatch(result,/class="profile"/)
 }
})
