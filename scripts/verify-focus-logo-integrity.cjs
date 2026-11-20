const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const root = path.resolve(__dirname,'..')
const manifest = JSON.parse(fs.readFileSync(path.join(root,'FOCUS_BORDER_LOGO_HOTFIX_INTEGRITY.json'),'utf8'))
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const problems=[]
for(const [rel,record] of Object.entries(manifest.tracked)) {
  const file=path.join(root,rel)
  if(!fs.existsSync(file) || hash(file)!==record.current) problems.push(rel)
}
if(problems.length) {
  console.error('Focus-border/logo source-integrity mismatch:', problems.join(', '))
  process.exitCode=1
} else console.log(`Focus-border/logo integrity verified: ${Object.keys(manifest.tracked).length} predecessor and updated paths; prior manifests unchanged`)
