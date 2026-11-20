/* Current successor integrity. Earlier release manifests and tests remain unchanged. */
const fs=require('node:fs')
const path=require('node:path')
const crypto=require('node:crypto')
const root=path.resolve(__dirname,'..')
const pinned=JSON.parse(fs.readFileSync(path.join(root,'REGRESSION_RECOVERY_INTEGRITY.json'),'utf8'))
const sha=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex')
function verify(){
 const errors=[];let checked=0
 for(const [rel,expected] of Object.entries(pinned.unchanged)){
  if(!fs.existsSync(path.join(root,rel))||sha(rel)!==expected)errors.push(rel+': unchanged predecessor source modified')
  checked++
 }
 for(const [rel,h] of Object.entries(pinned.changed)){
  if(!fs.existsSync(path.join(root,rel))||sha(rel)!==h.after||h.before===h.after)errors.push(rel+': changed source mismatch')
  checked++
 }
 for(const [rel,expected] of Object.entries(pinned.added)){
  if(!fs.existsSync(path.join(root,rel))||sha(rel)!==expected)errors.push(rel+': new source mismatch')
  checked++
 }
 for(const rel of pinned.removed){
  if(fs.existsSync(path.join(root,rel)))errors.push(rel+': deleted feature unexpectedly restored')
  checked++
 }
 const included=new Set([...Object.keys(pinned.unchanged),...Object.keys(pinned.changed),...Object.keys(pinned.added)])
 function walk(rel){
  for(const e of fs.readdirSync(path.join(root,rel),{withFileTypes:true})){
   const p=path.posix.join(rel,e.name)
   if(e.isDirectory())walk(p)
   else if(e.isFile()&&!included.has(p)) errors.push(p+': untracked source/test')
  }
 }
 for(const folder of ['src','tests','scripts'])walk(folder)
 if(errors.length)throw Error('Recovery integrity mismatch:\n'+errors.join('\n'))
 return checked
}
if(require.main===module){try{console.log('Recovery successor integrity passed: '+verify()+' pinned paths')}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={verify}
