import { defineConfig } from 'vite'
import type {Plugin,ViteDevServer,PreviewServer} from 'vite'
import react from '@vitejs/plugin-react'
import {createWeatherEndpoint} from './server/weather-api.mjs'

// The browser-only tsconfig intentionally omits Node globals; config runs in Node.
const buildEnvironment=(globalThis as typeof globalThis & {process?:{env:Record<string,string|undefined>}}).process?.env??{}

/** GitHub Actions supplies the existing owner/repository name; no repository URL is hard-coded. */
function deploymentBase():string {
  const explicit=buildEnvironment.RESORTOS_PAGES_BASE
  if(explicit!==undefined){
    if(explicit==='./')return './' // Portable Pages output for any existing repository/subpath.
    if(!/^\/[a-zA-Z0-9_.\-/]*\/$/.test(explicit)&&explicit!=='/')
      throw Error('RESORTOS_PAGES_BASE must be ./ or an absolute path such as /existing-repo/')
    return explicit
  }
  if(buildEnvironment.GITHUB_ACTIONS==='true'){
    const repository=buildEnvironment.GITHUB_REPOSITORY?.split('/')
    if(repository?.length===2 && repository[0] && repository[1])
      return repository[1].toLowerCase().endsWith('.github.io')?'/':`/${repository[1]}/`
  }
  return '/'
}

/** Same-origin weather endpoint works in Vite dev/preview, with secrets read only in Node. */
function weatherEndpointPlugin():Plugin {
  const endpoint=createWeatherEndpoint()
  const mount=(server:ViteDevServer|PreviewServer)=>{
    server.middlewares.use('/api/weather',(req,res)=>{void endpoint(req,res)})
  }
  return {name:'resortos-weather-endpoint',configureServer:mount,configurePreviewServer:mount}
}

export default defineConfig({ base:deploymentBase(),plugins: [react(),weatherEndpointPlugin()] })
