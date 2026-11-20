const fs=require('node:fs')
const path=require('node:path')
const crypto=require('node:crypto')
const root=path.resolve(__dirname,'..')
const manifest=JSON.parse(fs.readFileSync(path.join(root,'UNIFIED_DASHBOARD_INTEGRITY.json'),'utf8'))
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')
let failures=0
for(const [file,expected] of Object.entries(manifest.pinned)) {
  try {if(digest(file)!==expected.current){console.error('Source mismatch: '+file);failures++}}
  catch(e){console.error('Missing source: '+file);failures++}
}
if(digest('FOCUS_BORDER_LOGO_HOTFIX_INTEGRITY.json')!==manifest.protected_baseline_integrity_sha256){console.error('Historical manifest changed');failures++}
if(failures)process.exitCode=1
else console.log(`Unified Dashboard successor integrity: ${Object.keys(manifest.pinned).length} files verified, historical manifest protected`)
