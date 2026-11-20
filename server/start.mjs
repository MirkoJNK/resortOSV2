import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {extname,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createWeatherEndpoint} from './weather-api.mjs'

const root=resolve(fileURLToPath(new URL('../dist/',import.meta.url)))
const weather=createWeatherEndpoint()
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon',
  '.woff2':'font/woff2','.woff':'font/woff','.json':'application/json; charset=utf-8'}

const server=createServer(async(req,res)=>{
  let pathname
  try{pathname=decodeURIComponent(new URL(req.url??'/', 'http://local').pathname)}
  catch{res.writeHead(400).end();return}
  if(pathname==='/api/weather'){await weather(req,res);return}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return}
  if(pathname.includes('\\')||pathname.includes('\0')){res.writeHead(400).end();return}
  const target=resolve(root,`.${pathname}`)
  if(target!==root&&!target.startsWith(root+sep)){res.writeHead(403).end();return}
  const file=target===root?resolve(root,'index.html'):target
  try{
    const bytes=await readFile(file)
    res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream',
      'X-Content-Type-Options':'nosniff','Cache-Control':file.endsWith('index.html')?'no-cache':'public, max-age=3600'})
    res.end(req.method==='HEAD'?undefined:bytes)
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Not found')}
})
const port=Number(process.env.PORT??4173)
const host=process.env.HOST??'127.0.0.1'
server.listen(port,host,()=>{process.stdout.write(`resortOS server listening on ${host}:${port}\n`)})
