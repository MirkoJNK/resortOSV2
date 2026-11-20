'use strict'
const fs=require('node:fs')
const crypto=require('node:crypto')
const path=require('node:path')
const root=path.resolve(__dirname,'..')
const manifest=require('../LOGO_QUALITY_BUILD_FIX_INTEGRITY.json')
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')
function verify(){
 const failures=[]
 const names=Object.keys(manifest.unchanged)
 for(const rel of names){
  if(!fs.existsSync(path.join(root,rel)) || hash(rel)!==manifest.unchanged[rel]) failures.push('Unchanged predecessor: '+rel)
 }
 for(const [rel,data] of Object.entries(manifest.approvedModified)){
  if(data.before===data.after || !fs.existsSync(path.join(root,rel)) || hash(rel)!==data.after) failures.push('Authorized change: '+rel)
 }
 for(const [rel,expected] of Object.entries(manifest.approvedAdded)){
  if(!fs.existsSync(path.join(root,rel)) || hash(rel)!==expected) failures.push('Authorized addition: '+rel)
 }
 if(failures.length)throw Error('Logo hotfix integrity failure:\n'+failures.join('\n'))
 return names.length+Object.keys(manifest.approvedModified).length+Object.keys(manifest.approvedAdded).length
}
if(require.main===module){try{console.log('Logo hotfix integrity verified:',verify(),'pinned files')}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={verify}
