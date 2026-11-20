/* Successor-only integrity: historical release manifests stay frozen. */
const fs=require('node:fs')
const path=require('node:path')
const crypto=require('node:crypto')
const root=path.resolve(__dirname,'..')
const pin=JSON.parse(fs.readFileSync(path.join(root,'WORKSPACE_TRANSITION_HOTFIX_INTEGRITY.json'),'utf8'))
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')
function verify(){
 const errors=[]
 for(const [name,expected] of Object.entries(pin.unchanged)){
  if(!fs.existsSync(path.join(root,name))||hash(name)!==expected)errors.push(name+': predecessor file not preserved')
 }
 for(const [name,change] of Object.entries(pin.changed)){
  if(!fs.existsSync(path.join(root,name))||hash(name)!==change.after||change.before===change.after)errors.push(name+': hotfix source mismatch')
 }
 for(const [name,expected] of Object.entries(pin.added)){
  if(!fs.existsSync(path.join(root,name))||hash(name)!==expected)errors.push(name+': new hotfix source mismatch')
 }
 for(const name of pin.removed){if(fs.existsSync(path.join(root,name)))errors.push(name+': removed file restored')}
 const included=new Set([...Object.keys(pin.unchanged),...Object.keys(pin.changed),...Object.keys(pin.added)])
 for(const folder of ['src','tests','scripts','public']){
  const walk=relative=>{
   for(const ent of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){
    const name=path.posix.join(relative,ent.name)
    if(ent.isDirectory())walk(name)
    else if(ent.isFile()&&!included.has(name))errors.push(name+': untracked source/asset')
   }
  }
  walk(folder)
 }
 if(errors.length)throw Error('Workspace hotfix integrity mismatch:\n'+errors.join('\n'))
 return included.size+pin.removed.length
}
if(require.main===module){try{console.log(`Workspace transition source integrity: ${verify()} pinned files verified`)}catch(err){console.error(err.message);process.exitCode=1}}
module.exports={verify}
