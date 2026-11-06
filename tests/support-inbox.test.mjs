import { cssForLegacyAssertions } from './helpers/css-for-legacy-checks.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from './helpers/source-for-legacy-checks.mjs'
const normalizeCode = s => s.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1|\s+/gs, m => /^\s+$/.test(m) ? '' : m)
const jsxRaw=fs.readFileSync('src/components/SupportWorkspace.tsx','utf8')
const jsx=jsxRaw+"\n"+normalizeCode(jsxRaw)
const css=cssForLegacyAssertions('src/styles/support.css')
test('Support uses the approved standard Administration header without its previous illustrative weather',()=>{
 assert.match(jsx,/function SupportHeader\(\)/)
 assert.match(jsx,/className="section-header support-standard-header"/)
 assert.match(jsx,/<h1>Support &amp; Issues<\/h1>/)
 assert.match(jsx,/Manage and resolve employee support requests/)
 assert.doesNotMatch(jsx,/SupportBanner|support-hero|support-weather/)
 assert.doesNotMatch(css,/\.support-hero|\.support-weather|support-coastal-panorama-v0661\.png/)
 assert.match(fs.readFileSync('src/features/dashboard/Dashboard.tsx','utf8'),/className="weather"/)
})
test('filters are real accessible controls with reset state',()=>{
 assert.match(jsx,/aria-expanded=\{showFilters\}/)
 assert.match(jsx,/aria-label="Filter by priority"/)
 assert.match(jsx,/aria-label="Filter by department"/)
 assert.match(jsx,/Clear filters/)
 assert.match(jsx,/aria-pressed=\{status===s\}/)
})
test('ticket rows identify update time, status and urgency accessibly',()=>{
 assert.match(jsx,/aria-label=\{`\$\{t.subject\}, \$\{t.priority\} priority, \$\{t.status\}, updated \$\{t.age\}`\}/)
 assert.match(jsx,/title=\{`Updated \$\{t.age\}`\}/)
 assert.match(css,/\.support-ticket-row\.selected/)
})
test('Support header remains employee only and global design protected',()=>{
 assert.match(jsx,/Manage and resolve employee support requests/)
 assert.doesNotMatch(jsx,/reply to guest|guest request/i)
})
