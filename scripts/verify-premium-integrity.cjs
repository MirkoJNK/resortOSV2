/* A successor release, not a replacement for the original historical approval manifests. */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const root = path.resolve(__dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'PREMIUM_EXPERIENCE_INTEGRITY.json'),'utf8'))
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')
function verify() {
  const failures = []
  let checked = 0
  for (const [rel, hash] of Object.entries(manifest.unchanged)) {
    if (!fs.existsSync(path.join(root,rel)) || digest(rel) !== hash) failures.push(`${rel}: frozen predecessor mismatch`)
    checked++
  }
  for (const [rel,record] of Object.entries(manifest.modified)) {
    if (record.before === record.after || !fs.existsSync(path.join(root,rel)) || digest(rel) !== record.after)
      failures.push(`${rel}: approved modification mismatch`)
    checked++
  }
  for (const [rel,hash] of Object.entries(manifest.added)) {
    if (!fs.existsSync(path.join(root,rel)) || digest(rel) !== hash) failures.push(`${rel}: new source mismatch`)
    checked++
  }
  const prefixes = ['src/','scripts/','tests/']
  const all = new Set([...Object.keys(manifest.unchanged),...Object.keys(manifest.modified),...Object.keys(manifest.added)])
  const walk = dir => {
    for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {
      const rel = path.posix.join(dir,entry.name)
      if (entry.isDirectory()) walk(rel)
      else if(entry.isFile() && !all.has(rel)) failures.push(`${rel}: untracked source or test`)
    }
  }
  for(const dir of prefixes) walk(dir.slice(0,-1))
  if(failures.length) throw Error('Premium successor integrity failure:\n'+failures.join('\n'))
  return checked
}
if (require.main === module) {
  try {console.log(`Premium successor integrity passed: ${verify()} exact file hashes (predecessor + authorized changes)`)}
  catch(error){console.error(error.message);process.exitCode=1}
}
module.exports = {verify}
