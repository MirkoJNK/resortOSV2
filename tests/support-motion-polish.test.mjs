import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const motion=fs.readFileSync('src/styles/support-motion.css','utf8')
const base=fs.readFileSync('src/styles/motion.css','utf8')
const main=fs.readFileSync('src/main.tsx','utf8')
const source=fs.readFileSync('src/components/SupportWorkspace.tsx','utf8')

test('Support motion is isolated in a new layer after shared tokens and the scoped Support styles',()=>{
 assert.ok(main.indexOf("import './styles/support-motion.css'")>main.indexOf("import './styles/support.css'"))
 assert.match(motion,/@media \(prefers-reduced-motion: no-preference\)/)
 assert.match(base,/--ros-motion-reveal: 360ms/)
 assert.match(base,/--ros-motion-stagger: 55ms/)
 assert.match(base,/--ros-motion-fast: 170ms/)
})
test('page entrance uses one-time short reveals with stagger and does not animate artwork',()=>{
 assert.match(motion,/\.support-page \.support-hero-title/)
 assert.match(motion,/\.support-page \.support-overview-card:nth-child\(3\)\{animation-delay:165ms\}/)
 assert.match(motion,/\.support-page \.support-ticket-detail\{animation-delay:275ms\}/)
 assert.doesNotMatch(motion,/\.support-hero-art[\s,{]/)
 assert.doesNotMatch(motion,/(?:infinite|pulse|bounce|swing)/)
})
test('ticket, tabs, editor controls and popover use existing fast timing without scaling cards',()=>{
 for(const fragment of ['.support-ticket-row','.support-detail-tabs button','.support-picker-trigger','.support-picker-chevron','.support-picker-menu'])assert.ok(motion.includes(fragment))
 assert.match(motion,/ros-support-menu-enter var\(--ros-motion-fast,170ms\)/)
 assert.doesNotMatch(motion,/scale\(/)
})
test('only real new messages and activity events get animation markers, no blanket message entrance',()=>{
 assert.match(source,/support-message-new/)
 assert.match(source,/support-activity-new/)
 assert.match(source,/m\.id&&m\.id===animateMessageId/)
 assert.match(source,/event\.source==='session-action'&&event\.id===animateEventId/)
 assert.match(motion,/\.support-page \.support-message-new/)
 assert.match(motion,/\.support-page \.support-activity-new/)
 assert.doesNotMatch(motion,/\.support-page \.support-message\s*\{/)
 assert.doesNotMatch(motion,/\.support-page \.support-activity-event\s*\{/)
})
test('reduced-motion preferences fully disable Support animations and transitions',()=>{
 assert.match(motion,/@media \(prefers-reduced-motion: reduce\)/)
 assert.match(motion,/\.support-page \*::before/)
 assert.match(motion,/\.support-page \*::after/)
 assert.match(motion,/animation:none!important/)
 assert.match(motion,/transition:none!important/)
})
