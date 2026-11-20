import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile,readFileSync,readdirSync} from 'node:fs'
import {join,resolve,sep} from 'node:path'

/** Verify the existing ResortOS Pages repository path with real HTTP requests. */
const root=resolve('dist')
const base='/resortOSV2/'
const html=readFileSync(join(root,'index.html'),'utf8')
const js=readdirSync(join(root,'assets')).filter(item=>item.endsWith('.js'))
  .map(item=>readFileSync(join(root,'assets',item),'utf8')).join('\n')
assert.match(html,/src="\/resortOSV2\/assets\/[^" ]+\.js"/)
assert.match(html,/href="\/resortOSV2\/assets\/[^" ]+\.css"/)
assert.ok(js.includes('/resortOSV2/assets/') && js.includes('tutorial-audio/'))
assert.ok(!html.includes('localhost')&&!html.includes('127.0.0.1'))
const files=[]
for(const workspace of ['admin','restaurant','front-desk']){
  const folder=join(root,'assets','tutorial-audio',workspace)
  const recordings=readdirSync(folder).filter(item=>item.endsWith('.mp3'))
  assert.equal(recordings.length,7,workspace)
  files.push(...recordings.map(file=>`assets/tutorial-audio/${workspace}/${file}`))
}
const entrypoints=[...html.matchAll(/(?:src|href)="(\/resortOSV2\/assets\/[^" ]+)"/g)].map(result=>result[1])
const server=createServer((request,response)=>{
  const pathname=new URL(request.url??'/', 'http://local.test').pathname
  if(!pathname.startsWith(base)){response.writeHead(404).end();return}
  const relative=decodeURIComponent(pathname.slice(base.length)) || 'index.html'
  const file=resolve(root,relative)
  if(file!==root&&!file.startsWith(root+sep)){response.writeHead(403).end();return}
  readFile(file,(error,data)=>{
    if(error){response.writeHead(404).end();return}
    response.writeHead(200,{'Content-Type':file.endsWith('.mp3')?'audio/mpeg':'application/octet-stream'})
    response.end(data)
  })
})
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const address=server.address()
  assert.ok(address&&typeof address!=='string')
  const origin=`http://127.0.0.1:${address.port}${base}`
  for(const file of ['index.html',...entrypoints,...files]){
    const url=new URL(file.startsWith('/')?file:`./${file}`,origin)
    const result=await fetch(url)
    assert.equal(result.status,200,`Missing Pages asset ${url.pathname}`)
    await result.arrayBuffer()
  }
  console.log(`GitHub Pages /resortOSV2/ smoke test: ${1+entrypoints.length} application assets and ${files.length} MP3s returned HTTP 200`)
  console.log(`Example resolved narration URL: ${new URL('./'+files[0],origin).pathname}`)
}finally{
  await new Promise(resolve=>server.close(resolve))
}
