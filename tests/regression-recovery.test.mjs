import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const src = name => fs.readFileSync(name,'utf8')
test('no audio, vibration or global feedback menu remains wired into the Topbar',()=>{
 const top=src('src/shell/Topbar.tsx')
 assert.doesNotMatch(top,/FeedbackPreferences|ros-feedback-settings|ros-profile-name/)
 assert.match(top,/DemoAccountMenu/)
 assert.match(src('src/shell/DemoAccountMenu.tsx'),/ros-profile-avatar/)
 assert.match(src('src/shell/WorkspaceSwitcher.tsx'),/Workspace:/)
 assert.equal(fs.existsSync('src/components/FeedbackPreferences.tsx'),false)
 const css=src('src/styles/premium-interactions.css')
 assert.doesNotMatch(css,/ros-feedback-popover|ros-local-reduced-motion|ros-premium-dialog/)
})
test('shared dialogs have no transformed page ancestor or global dialog-transform animation',()=>{
 const css=src('src/styles/premium-interactions.css')
 assert.doesNotMatch(css,/animation:\s*ros-enter|animation:\s*ros-premium-dialog|\.rm-modal,\s*\.app-shell \.rt-dialog/)
 assert.match(src('src/features/restaurant-tables/restaurant-tables.css'),/\.rt-dialog-backdrop\{position:fixed/)
 assert.match(src('src/features/front-desk/front-desk-checkout.css'),/\.fd-checkout-dialog\{width:min\(760px,100%\)/)
})
test('composite search shows wrapper focus without second inner outline',()=>{
 const css=src('src/styles/premium-interactions.css')
 assert.match(css,/:focus-within/)
 assert.match(css,/input:focus-visible/)
 assert.match(css,/outline:\s*0/)
 assert.doesNotMatch(css,/\.app-shell :is\(button, input, textarea, select/)
 assert.match(css,/button,\[role=button\]/)
})
test('Support heading has no redundant description but Support workflow remains',()=>{
 const support=src('src/components/SupportWorkspace.tsx')
 assert.doesNotMatch(support,/Manage and resolve employee support requests/)
 assert.match(support,/Support &amp; Issues/)
})
test('route reveal is a nonblocking branded overlay with no fake progress',()=>{
 const app=src('src/App.tsx')
 const css=src('src/styles/motion.css')
 assert.match(app,/ros-route-brand-reveal/)
 assert.match(app,/key=\{area\}/)
 assert.match(app,/aria-hidden="true"/)
 assert.match(css,/ros-route-brand-fill/)
 assert.match(css,/pointer-events:\s*none/)
 assert.match(css,/prefers-reduced-motion:\s*reduce/)
 assert.doesNotMatch(css,/loading percentage|loading\.\.\./i)
})
test('logo uses existing image with stable cache revision and coast stays untouched',()=>{
 const side=src('src/shell/Sidebar.tsx')
 assert.match(side,/sidebar-brand-approved-v058\.png\?v=single-trunk-20261112/)
 assert.ok(fs.statSync('public/assets/sidebar-brand-approved-v058.png').size > 1000)
 assert.match(side,/resortOS/)
})
test('operational and financial modules retain their separate source files',()=>{
 for(const file of ['src/features/restaurant-tables/model.ts','src/features/restaurant-tables/storage.ts',
 'src/features/front-desk/checkout.ts','src/features/front-desk/charges.ts',
 'src/features/payment-methods/model.ts']) assert.ok(fs.existsSync(file))
})
