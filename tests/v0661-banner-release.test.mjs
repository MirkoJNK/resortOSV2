import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const read = file => fs.readFileSync(file, 'utf8')
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const current = read('src/components/SupportWorkspace.tsx')
const historical = read('resortOS_v066/src/components/SupportWorkspace.tsx')
const css = read('src/styles/support.css')

test('original resortOS logo, sidebar, shared Dashboard weather and historic source remain preserved', async () => {
  for (const name of ['public/assets/sidebar-brand-approved-v058.png','src/styles/light-sidebar-v058.css']) {
    assert.equal(sha(name), sha(path.join('resortOS_v066',name)), name)
  }
  const { createRequire } = await import('node:module')
  const { typescriptSemanticHash } = createRequire(import.meta.url)('../scripts/typescript-semantic.cjs')
  const approved = JSON.parse(read('RESTAURANT_STAGE1_APPROVED.json'))
  const hotfix=JSON.parse(read('GLOBAL_UI_HOTFIX_APPROVED.json')).approved_source['src/shell/Sidebar.tsx']
  const { successorHash } = createRequire(import.meta.url)('../scripts/front-desk-successor.cjs')
  const orders=JSON.parse(read('RESTAURANT_ORDERS_INTEGRATION_INTEGRITY.json'))
  const predecessor=orders.changes['src/shell/Sidebar.tsx']?.after ?? hotfix.after
  assert.equal(sha('src/features/dashboard/Dashboard.tsx'), successorHash('src/features/dashboard/Dashboard.tsx',sha('resortOS_v066/src/features/dashboard/Dashboard.tsx')), 'Dashboard greeting-only successor pinned')
  assert.equal(sha('src/shell/Sidebar.tsx'),successorHash('src/shell/Sidebar.tsx', predecessor),'Authorized Front Desk workspace selector is exactly pinned')
  assert.match(historical, /className="weather support-weather"/, 'historical Support weather markup remains in archived source')
  assert.match(read('src/features/dashboard/Dashboard.tsx'), /className="weather"/)
})

test('current Support retains its standard heading without an Administration eyebrow and retires only its illustrative hero and weather', () => {
  assert.match(current, /function SupportHeader\(\)/)
  assert.doesNotMatch(current, /<p>Administration<\/p>/)
  assert.match(current, /<h1>Support &amp; Issues<\/h1>/)
  assert.match(current, /Manage and resolve employee support requests/)
  assert.match(current, /<SupportHeader \/>/)
  assert.doesNotMatch(current, /<SupportBanner|support-hero|support-weather/)
  assert.doesNotMatch(css, /\.support-hero|\.support-weather/)
})

test('shared Support ticket counts, inbox and selected ticket functionality remain intact', () => {
  assert.doesNotMatch(current, /function SupportOverview\(|<SupportOverview/)
  assert.match(current, /export function getSupportCounts\(/)
  assert.match(current, /<SupportInbox/)
  assert.match(current, /<SupportSelectedTicket/)
  assert.match(current, /setTickets\(current => updateSupportTicket/)
  assert.match(current, /setTickets\(current => addAdminReply/)
})

test('historic high-resolution artwork is retained as an unmodified asset but no longer referenced', () => {
  const art = fs.readFileSync('public/assets/support-coastal-panorama-v0661.png')
  assert.equal(art.subarray(0,8).toString('hex'), '89504e470d0a1a0a')
  assert.ok(art.readUInt32BE(16) >= 2400)
  assert.ok(art.readUInt32BE(20) >= 350)
  assert.equal(sha('public/assets/support-coastal-panorama-v0661.png'), JSON.parse(read('V06611_APPROVED_CHANGES.json')).files['public/assets/support-coastal-panorama-v0661.png'])
  assert.doesNotMatch(css, /support-coastal-panorama-v0661.png/)
})
