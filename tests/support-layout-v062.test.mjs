import { cssForLegacyAssertions } from './helpers/css-for-legacy-checks.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from './helpers/source-for-legacy-checks.mjs'
const read = name => readFileSync(name,'utf8')
const app = cssForLegacyAssertions('src/styles/layout-integration-v062.css')
const side = cssForLegacyAssertions('src/styles/light-sidebar-v058.css')
const support = cssForLegacyAssertions('src/styles/support.css')
const normalizeCode = s => s.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1|\s+/gs, m => /^\s+$/.test(m) ? '' : m)
const reactRaw = read('src/components/SupportWorkspace.tsx')
const react=reactRaw+"\n"+normalizeCode(reactRaw)

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
test('Support uses approved standard header and adaptive Variant B workspace without overview cards',()=>{
 assert.doesNotMatch(support,/support-coastal-panorama-v0661.png|\.support-hero/)
 assert.match(support,/height:\s*clamp\(610px,\s*calc\(100dvh - 270px\),\s*740px\)/)
 assert.match(react,/className="section-header support-standard-header"/)
 assert.match(react,/support-filter-tabs/)
 assert.doesNotMatch(react,/function SupportOverview\(/)
})
test('In progress queue remains after removed overview metric icon',()=>{
 assert.match(react,/supportTicketStatuses/)
 assert.match(react,/support-filter-tabs/)
 assert.doesNotMatch(react,/function SupportOverview/)
})
test('the approved ticket interaction markup and data remain present',()=>{
 for(const className of ['support-ticket-list','support-detail-tabs','support-conversation','support-activity']) assert.ok(react.includes(className))
 assert.match(react,/supportOriginDepartments\s*=\s*\['Front Desk',\s*'Restaurant'\]/)
})

test('shared layout override loads after approved sidebar and existing responsive layers',()=>{
 const imports = read('src/main.tsx')
 assert.ok(imports.indexOf('styles/layout-integration-v062.css') > imports.indexOf('styles/light-sidebar-v058.css'))
})
