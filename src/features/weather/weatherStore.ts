import {useSyncExternalStore} from 'react'

export type WeatherReading={tempC:number;condition:string;conditionCode:number;isDay:boolean;
  providerUpdatedAt:string;fetchedAt:string;location:'Cebu City'}
export type WeatherSnapshot={status:'loading'|'ready'|'unavailable';reading:WeatherReading|null}
const CACHE_MS=15*60*1000
const RETRY_MS=60*1000
const REQUEST_TIMEOUT_MS=6000
const listeners=new Set<()=>void>()
const initial:WeatherSnapshot={status:'loading',reading:null}
let snapshot=initial
let freshUntil=0,retryAfter=0
let inFlight:Promise<void>|null=null
let interval:ReturnType<typeof setInterval>|null=null

const emit=(next:WeatherSnapshot)=>{
  snapshot=next
  listeners.forEach(listener=>listener())
}
const validReading=(value:unknown):value is WeatherReading=>{
  if(!value||typeof value!=='object')return false
  const reading=value as Partial<WeatherReading>
  return typeof reading.tempC==='number'&&Number.isFinite(reading.tempC)&&reading.tempC>=-80&&reading.tempC<=65&&
    typeof reading.condition==='string'&&reading.condition.length>0&&reading.condition.length<=80&&
    typeof reading.conditionCode==='number'&&Number.isInteger(reading.conditionCode)&&reading.conditionCode>=1000&&reading.conditionCode<=1300&&
    typeof reading.isDay==='boolean'&&reading.location==='Cebu City'&&
    typeof reading.providerUpdatedAt==='string'&&Number.isFinite(Date.parse(reading.providerUpdatedAt))&&
    typeof reading.fetchedAt==='string'&&Number.isFinite(Date.parse(reading.fetchedAt))
}

/** One shared cache and one in-flight request for all three department dashboards. */
export function refreshWeather(now=Date.now()):Promise<void>{
  if(now<freshUntil&&snapshot.status==='ready')return Promise.resolve()
  if(inFlight)return inFlight
  if(now<retryAfter)return Promise.resolve()
  emit({status:'loading',reading:null})
  inFlight=(async()=>{
    const controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS)
    try{
      const response=await fetch('/api/weather',{signal:controller.signal,credentials:'same-origin',cache:'no-store'})
      if(!response.ok)throw Error('Weather request unavailable')
      const data:unknown=await response.json()
      if(!data||typeof data!=='object'||(data as {status?:unknown}).status!=='ok'||
        !validReading((data as {weather?:unknown}).weather))throw Error('Invalid weather response')
      const reading=(data as {weather:WeatherReading}).weather
      const age=Date.now()-Date.parse(reading.fetchedAt)
      if(age< -60_000||age>CACHE_MS+60_000)throw Error('Expired weather response')
      freshUntil=Date.now()+CACHE_MS
      retryAfter=0
      emit({status:'ready',reading})
    }catch{
      freshUntil=0
      retryAfter=Date.now()+RETRY_MS
      emit({status:'unavailable',reading:null})
    }finally{clearTimeout(timeout)}
  })().finally(()=>{inFlight=null})
  return inFlight
}
const refreshIfActive=()=>{if(typeof document==='undefined'||document.visibilityState==='visible')void refreshWeather()}
const subscribe=(listener:()=>void)=>{
  listeners.add(listener)
  if(listeners.size===1){
    window.addEventListener('focus',refreshIfActive)
    document.addEventListener('visibilitychange',refreshIfActive)
    interval=setInterval(refreshIfActive,60_000)
    void refreshWeather()
  }
  return ()=>{
    listeners.delete(listener)
    if(!listeners.size){
      window.removeEventListener('focus',refreshIfActive)
      document.removeEventListener('visibilitychange',refreshIfActive)
      if(interval!==null){clearInterval(interval);interval=null}
    }
  }
}
export const getCurrentWeatherSnapshot=()=>snapshot
const getSnapshot=getCurrentWeatherSnapshot
export const useCebuWeather=()=>useSyncExternalStore(subscribe,getSnapshot,getSnapshot)
