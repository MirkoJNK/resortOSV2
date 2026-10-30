import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8')
const charts = read('../src/components/Charts.tsx')
const app = read('../src/App.tsx')
const css = read('../src/styles/app.css')
const tokens = read('../src/styles/tokens.css')

test('approved Dashboard bars stay intact while live ticket counts use shared state', () => {
  assert.match(charts, /labels\.map\(\(label,day\)=>/)
  assert.match(charts, /daily=values\.slice\(day\*perDay,day\*perDay\+perDay\)/)
  assert.match(app, /<Bars values=\{\[[^\]]{30,}\]\} labels=\{\['Oct 22'/)
  assert.match(app, /getSupportCounts\(tickets\)/)
  assert.match(css, /\.bars-plot\{[^}]*grid-template-columns:repeat\(6/)
})
test('payments line is derived from data, with nonneon chart tokens', () => {
  assert.match(charts, /function smoothPath\(samples:number\[\]/)
  assert.match(charts, /<path className="payment-stroke" d=\{line\}/)
  assert.match(tokens, /--ros-chart-stroke: #8ac300;/)
  assert.doesNotMatch(charts, /<linearGradient/)
})
test('employee bars normalize to displayed departments not an arbitrary divisor', () => {
  assert.match(app, /const largestDepartment=Math\.max\(1,/)
  assert.match(app, /<ProgressBar label=\{`\$\{dep\} staffing comparison`\}/)
  assert.doesNotMatch(app, /count\/14/)
  assert.match(charts, /aria-valuenow=\{value\}/)
})
test('roles distribution is derived from role counts and uses squared swatches', () => {
  assert.match(charts, /items\.reduce\(\(sum,item\)=>sum\+Math\.max\(0,item\.value\),0\)/)
  assert.match(charts, /flexGrow:Math\.max\(0,item\.value\)/)
  assert.match(css, /\.access-types i\{[^}]*border-radius:2px/)
  assert.match(app, /<RoleDistribution items=\{roles\}\/>/)
})
test('approved tropical art and typography remain while motion is deferred', () => {
  assert.match(css, /\.art-copy\{[^}]*Georgia/)
  assert.match(read('../src/styles/typography.css'), /\.welcome h1/)
  assert.match(app,/Your resort is running smoothly'/)
  assert.doesNotMatch(css, /@keyframes (?:bar|chart|line)/)
})
