import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const jsx=fs.readFileSync('src/components/SupportWorkspace.tsx','utf8')
const css=fs.readFileSync('src/styles/support.css','utf8')
test('Support weather is sharp markup that shares the Administration weather component style',()=>{
 assert.match(jsx, /className="weather support-weather"/)
 assert.match(jsx, /<Sun size=\{29\} strokeWidth=\{1\.8\}\/>/)
 assert.match(css, /\.support-hero \.support-weather/)
 assert.match(css, /background-size:128% 100%;background-position:left top/)
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
