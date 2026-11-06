import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const postcss = require('postcss')
const sm = fs.readFileSync('src/features/system-management/SystemManagement.tsx', 'utf8')
const smCss = postcss.parse(fs.readFileSync('src/styles/system-management.css', 'utf8'))
const support = fs.readFileSync('src/components/SupportWorkspace.tsx', 'utf8')
const css = postcss.parse(fs.readFileSync('src/styles/support.css', 'utf8'))
const motion = postcss.parse(fs.readFileSync('src/styles/support-motion.css', 'utf8'))
const appMotion = fs.readFileSync('src/styles/motion.css', 'utf8')
const dashboard = fs.readFileSync('src/features/dashboard/Dashboard.tsx', 'utf8')
const rule = (root, selector) => {
  const found = []
  root.walkRules(r => { if (r.selector === selector) found.push(r) })
  return found
}
const get = (node, property) => node.nodes.find(x => x.type === 'decl' && x.prop === property)?.value

test('System Management reuses the approved 360ms/7px resortOS reveal rather than a new animation', () => {
  assert.match(appMotion, /--ros-motion-reveal:\s*360ms/)
  assert.match(appMotion, /--ros-motion-stagger:\s*55ms/)
  assert.match(appMotion, /--ros-motion-ease:\s*cubic-bezier\(\.22,1,\.36,1\)/)
  assert.match(appMotion, /translateY\(7px\)/)
  const group = rule(smCss, '.sm-page .sm-heading, .sm-page .sm-toolbar, .sm-page .sm-results-stage')
  assert.ok(group.some(r => get(r, 'animation')?.includes('ros-enter')))
  for (const [selector, delay] of [['.sm-page .sm-heading','0ms'],['.sm-page .sm-toolbar','55ms'],['.sm-page .sm-results-stage','110ms']]) {
    assert.ok(rule(smCss, selector).some(r => get(r,'animation-delay') === delay), `${selector} needs ${delay}`)
  }
  assert.doesNotMatch(sm, /setTimeout|requestAnimationFrame/)
})

test('System Management result group remains a stable unkeyed wrapper during React search updates', () => {
  assert.match(sm, /className="sm-results-stage"/)
  assert.match(sm, /\{filtered\.length\s*\?\s*<div className="sm-grid">/)
  assert.doesNotMatch(sm, /<div className="sm-results-stage"\s+key=/)
  assert.doesNotMatch(fs.readFileSync('src/styles/system-management.css','utf8'), /\.sm-category:nth-child\([^)]*\)[^\n]*animation/)
})

test('System Management entrance disables motion for accessibility while preserving hover and tools', () => {
  const reduced = []
  smCss.walkAtRules('media', m => { if (m.params.includes('prefers-reduced-motion: reduce')) reduced.push(m) })
  assert.ok(reduced.some(m => rule(m,'.sm-page .sm-heading, .sm-page .sm-toolbar, .sm-page .sm-results-stage').some(r => get(r,'animation') === 'none' && r.nodes.some(x => x.important))))
  assert.match(fs.readFileSync('src/styles/system-management.css','utf8'), /#f4f9e7/)
  assert.match(sm, /tool.id === 'tables' \|\| tool.id === 'rooms'/)
  assert.match(sm, /sm-tool sm-tool-link/)
  assert.match(sm, /<div className="sm-tool"/)
  assert.match(sm, /role="status" aria-live="polite"/)
})

test('Support now uses approved section heading without banner or Support weather', () => {
  assert.match(support, /<div className="section-header support-standard-header">/)
  for (const text of ['Administration', 'Support &amp; Issues', 'Manage and resolve employee support requests']) assert.ok(support.includes(text))
  assert.doesNotMatch(support, /SupportBanner|support-hero|support-weather|supportLayout|support-review-fixed|support-review-adaptive/)
  assert.match(dashboard, /className="weather"/)
  const unused = []
  css.walkRules(r => { if (/\.support-hero|\.support-weather/.test(r.selector)) unused.push(r.selector) })
  assert.deepEqual(unused, [])
})

test('Support desktop Variant B uses the approved adaptive limits and existing column proportions', () => {
  const desktop = []
  css.walkAtRules('media', m => { if (/min-width:\s*821px/.test(m.params)) desktop.push(m) })
  assert.ok(desktop.some(m => rule(m,'.support-workspace').some(r => get(r,'height') === 'clamp(610px, calc(100dvh - 270px), 740px)' && get(r,'min-height') === '610px')))
  assert.ok(rule(css,'.support-workspace').some(r => get(r,'grid-template-columns') === 'minmax(350px, .97fr) minmax(0,1.82fr)'))
  assert.ok(rule(css,'.support-ticket-list').some(r => get(r,'overflow-y') === 'auto'))
  assert.ok(rule(css,'.support-tab-content').some(r => get(r,'overflow-y') === 'auto'))
  assert.ok(rule(css,'.support-inbox,.support-ticket-detail').length)
  assert.doesNotMatch(support, /URLSearchParams\(location\.search\).*supportLayout/)
})

test('Support header reuses the existing entrance motion without adding animation to ticket updates', () => {
  assert.ok(rule(motion,'.support-page .support-standard-header').some(r => get(r,'animation-delay') === '0ms'))
  assert.ok(rule(motion,'.support-page .support-inbox').some(r => get(r,'animation-delay') === '55ms'))
  assert.ok(rule(motion,'.support-page .support-ticket-detail').some(r => get(r,'animation-delay') === '110ms'))
  assert.ok(rule(motion,'.support-page .support-message-new').length)
  assert.ok(rule(motion,'.support-page .support-activity-new').length)
  assert.ok(fs.readFileSync('src/styles/support-motion.css','utf8').includes('prefers-reduced-motion: reduce'))
})

test('Ticket state handlers, independent scroll targets, and composer remain in Support React', () => {
  for (const text of ['filterSupportTickets(tickets, filters)', 'getSupportCounts(', 'updateSupportTicket(current', 'addAdminReply(current', 'setRetainedTicketId', 'support-tab-content', 'support-ticket-list', 'support-composer', 'onSendMessage']) {
    assert.ok(support.includes(text), `Lost required ticket behavior: ${text}`)
  }
})
