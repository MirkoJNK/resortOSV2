import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = f=>readFileSync(new URL(f, import.meta.url), 'utf8')
const app=read('../src/App.tsx'), charts=read('../src/components/Charts.tsx'), css=read('../src/styles/motion.css'), main=read('../src/main.tsx')
test('the isolated motion layer loads after the approved responsive rules',()=>{
 assert.ok(main.indexOf("import './styles/motion.css'")>main.indexOf("import './styles/responsive.css'"))
 assert.match(css,/--ros-motion-reveal: 360ms/)
 assert.match(css,/--ros-motion-stagger: 55ms/)
})
test('dashboard entrance is scoped, staggered and does not animate the art independently',()=>{
 assert.match(app,/dashboard-motion/)
 for(let i=0;i<=8;i++)assert.match(css,new RegExp(`\\.motion-order-${i} \\{ --motion-order:${i}; \\}`))
 assert.match(css,/@keyframes ros-enter/)
 assert.match(css,/translateY\(7px\)/)
 assert.doesNotMatch(css, /art-arch\s*\{/)
 assert.doesNotMatch(css, /infinite/)
})
test('support bars grow and payment line draws without inventing data',()=>{
 assert.match(css,/@keyframes ros-bar-grow/)
 assert.match(css,/\.dashboard-motion \.chart-bar/)
 assert.match(css,/@keyframes ros-line-draw/)
 assert.match(charts,/className="payment-stroke" d=\{line\} pathLength=\{1\}/)
 assert.match(charts,/function smoothPath\(samples:number\[\]/)
})
test('arrow hover is at most two pixels and no card hover bounce is added',()=>{
 assert.match(css,/\.circle-action:hover svg, \.small-button:hover svg \{ transform:translateX\(2px\); \}/)
 assert.doesNotMatch(css,/\.panel:hover\s*\{/)
})
test('search remains mounted and inert while closed, supporting both transition directions and focus restoration',()=>{
 assert.match(app,/isOpen=\{searchOpen\}/)
 assert.match(app,/inert=\{!isOpen\}/)
 assert.match(app,/restoreFocus\.current\.focus\(\)/)
 assert.match(css,/\.dialog-shade\.is-open/)
 assert.match(css,/\.dialog-shade\.is-open \.search-dialog/)
})
test('reduced-motion mode disables all entrance and chart effects',()=>{
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/)
 for(const token of ['.chart-bar','.payment-stroke','.payment-end','.dept-fill','.access-track>span','.motion-reveal'])assert.ok(css.includes(token))
 assert.match(css,/animation:none!important/)
 assert.match(css,/transition:none!important/)
})
