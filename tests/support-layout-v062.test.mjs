import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = name => readFileSync(name,'utf8')
const app = read('src/styles/layout-integration-v062.css')
const side = read('src/styles/light-sidebar-v058.css')
const support = read('src/styles/support.css')
const react = read('src/components/SupportWorkspace.tsx')

test('Option A shares a 24px desktop gutter, 20px compact-desktop gutter',()=>{
 assert.match(app, /@media \(min-width:1241px\) \{[\s\S]*?\.topbar,\.main-content \{ padding-left:24px; padding-right:24px; \}/)
 assert.match(app, /@media \(min-width:901px\) and \(max-width:1240px\) \{[\s\S]*?padding-left:20px; padding-right:20px;/)
})
test('Option A sidebar has a subtle, distinct edge and retains the full original artwork',()=>{
 assert.match(side, /border-right:1px solid #c7d5cc/)
 assert.match(side, /box-shadow:3px 0 12px rgba\(38,55,43,\.045\)/)
 assert.match(side, /object-fit:fill/)
 assert.match(side, /overflow:hidden/)
})
test('Option A uses compact hero and consistent three-card overview on desktop',()=>{
 assert.match(support, /\.support-page \.support-hero \{ min-height:114px; padding:5px 0 8px; \}/)
 assert.match(support, /\.support-page \.support-overview-card \{ min-height:93px; padding:12px 18px; gap:16px; \}/)
 assert.match(support, /\.support-page \.support-overview-icon \{ width:49px; height:49px; \}/)
 assert.match(support, /\.support-page \.support-overview \{ margin-bottom:12px; \}/)
 assert.match(support, /@media \(min-width:761px\)/)
})
test('the original In progress clock icon is kept in actual React output',()=>{
 assert.match(react,/\{title:'In progress',count:inProgress,kind:'progress' as const,icon:Clock3\}/)
 assert.match(react,/<Icon size=\{27\} strokeWidth=\{1\.85\}\/>/)
})
test('the approved ticket interaction markup and data remain present',()=>{
 for(const className of ['support-ticket-list','support-detail-tabs','support-conversation','support-activity']) assert.ok(react.includes(className))
 assert.match(react,/supportOriginDepartments=\['Front Desk','Restaurant'\]/)
})

test('shared layout override loads after approved sidebar and existing responsive layers',()=>{
 const imports = read('src/main.tsx')
 assert.ok(imports.indexOf('styles/layout-integration-v062.css') > imports.indexOf('styles/light-sidebar-v058.css'))
})
