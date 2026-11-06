const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const root = path.resolve(__dirname, '..')
const approval = JSON.parse(fs.readFileSync(path.join(root, 'GLOBAL_UI_HOTFIX_APPROVED.json'), 'utf8'))
const digest = rel => {
  const file = path.join(root, rel)
  return fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null
}
let passed = 0
const failures = []
for (const [file, entry] of Object.entries(approval.approved_source)) {
  if (digest(file) !== entry.after) failures.push(`Unauthorized change to hotfix source: ${file}`)
  else passed++
}
for (const [file, expected] of Object.entries(approval.protected_source)) {
  if (digest(file) !== expected) failures.push(`Frozen source or asset changed: ${file}`)
  else passed++
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1 }
else console.log(`Global UI hotfix source verified: ${passed} pinned files, including ${Object.keys(approval.protected_source).length} frozen assets/modules.`)
module.exports = { verify: () => !failures.length }
