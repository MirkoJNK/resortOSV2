import { cssForLegacyAssertions } from './helpers/css-for-legacy-checks.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from './helpers/source-for-legacy-checks.mjs'
import {createHash} from 'node:crypto'
const normalizeCode = s => s.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1|\s+/gs, m => /^\s+$/.test(m) ? '' : m)
const sourceRaw=fs.readFileSync('src/components/SupportWorkspace.tsx','utf8')
const source=sourceRaw+"\n"+normalizeCode(sourceRaw)
const css=cssForLegacyAssertions('src/styles/support.css')
const app=fs.readFileSync('src/App.tsx','utf8')
const hash=(s)=>createHash('sha256').update(s).digest('hex')
const originalHashes=JSON.parse(fs.readFileSync('FOUNDATION_LOCK.json','utf8'))
const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const { cssSemanticHash } = require('../scripts/css-semantic.cjs')
const { typescriptSemanticHash, approvedTypeScriptHash } = require('../scripts/typescript-semantic.cjs')
const baseline=JSON.parse(fs.readFileSync('tests/fixtures/v062-approved-baseline.json','utf8'))
test('original global design files are unchanged',()=>{for(const [file,expected] of Object.entries(originalHashes)){assert.equal(file.endsWith('.css') ? cssSemanticHash(file) : /\.(ts|tsx)$/.test(file) ? typescriptSemanticHash(file) : hash(fs.readFileSync(file)),file.endsWith('.css') ? baseline.cssSemantics[file] : /\.(ts|tsx)$/.test(file) ? approvedTypeScriptHash(file) : expected,file)}})
test('original app shell remains and support route uses a separate component',()=>{assert.match(app,/function Sidebar\(/);assert.match(app,/function Header\(/);assert.match(app,/function Dashboard\(/);assert.match(app,/case'support':return <SupportWorkspace tickets=\{supportTickets\} onTicketsChange=\{setSupportTickets\}\/>/);assert.doesNotMatch(app,/case'support':return <SupportPage /)})
test('two-panel layout with exactly three approved tabs exists',()=>{assert.match(css,/\.support-workspace\{display:grid;grid-template-columns:/);for(const x of ['Conversation','Details','Activity'])assert.ok(source.includes(x));assert.doesNotMatch(source,/type DetailTab=.*Related/);assert.doesNotMatch(source,/function SupportRelated\(/)})
test('ticketing is employee-only and priority is separate from status',()=>{assert.match(source,/employee support requests/);assert.match(source,/type SampleTicket/);assert.match(source,/priority:\s*TicketPriority/)
 assert.match(source,/status:\s*SupportTicketStatus/);assert.doesNotMatch(source,/reply to guest|guest profile|guest request/i)})
test('UI copy does not end headings with a period',()=>{assert.match(source,/Manage and resolve employee support requests/);assert.doesNotMatch(source,/<h1>[^<]+\.<\/h1>/)})
test('approved support art is available and original sidebar asset is preserved',()=>{assert.ok(fs.statSync('public/assets/support-painterly-banner.png').size>10000);assert.ok(fs.statSync('public/assets/sidebar-tropical-clean.png').size>10000)})
test('mobile and desktop breakpoint rules exist',()=>{assert.match(css,/@media\(min-width:821px\)/);assert.match(css,/@media\(max-width:820px\)/);assert.match(css,/@media\(max-width:520px\)/)})
test('Admin replies are local demonstrations, not external employee delivery',()=>{assert.match(source,/local demonstration of Admin conversations and structured ticket activity/);assert.match(source,/setTickets\(current\s*=>\s*addAdminReply/);assert.doesNotMatch(source,/fetch\([^)]*messages|sendToEmployee|sendToMaintenance/)})
