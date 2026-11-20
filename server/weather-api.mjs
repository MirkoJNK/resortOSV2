/** Server-only WeatherAPI.com adapter. No employee data, coordinates, or caller query are forwarded. */
const CEBU_CITY='Cebu City, Philippines'
const CACHE_MS=15*60*1000
const FAILURE_BACKOFF_MS=60*1000
const RATE_WINDOW_MS=60*1000
const RATE_MAX=60
const TIMEOUT_MS=6000

export function parseCurrentWeather(payload){
  const current=payload?.current
  if(!current||typeof current!=='object'||
    typeof current.temp_c!=='number'||!Number.isFinite(current.temp_c)||current.temp_c < -80||current.temp_c>65||
    !Number.isInteger(current.condition?.code)||current.condition.code<1000||current.condition.code>1300||
    typeof current.condition?.text!=='string'||!current.condition.text.trim()||current.condition.text.length>80||
    !/^[^<>\p{C}]+$/u.test(current.condition.text)||
    !(current.is_day===0||current.is_day===1)||
    !Number.isSafeInteger(current.last_updated_epoch)||current.last_updated_epoch<1)
    throw Error('Invalid weather provider response')
  const providerUpdatedAt=new Date(current.last_updated_epoch*1000)
  if(!Number.isFinite(providerUpdatedAt.getTime()))throw Error('Invalid weather timestamp')
  return {tempC:current.temp_c,condition:current.condition.text.trim(),
    conditionCode:current.condition.code,isDay:current.is_day===1,
    providerUpdatedAt:providerUpdatedAt.toISOString(),location:'Cebu City'}
}

function reply(res,code,data){
  res.statusCode=code
  res.setHeader('Content-Type','application/json; charset=utf-8')
  res.setHeader('Cache-Control','no-store')
  res.setHeader('X-Content-Type-Options','nosniff')
  res.setHeader('Referrer-Policy','no-referrer')
  res.end(JSON.stringify(data))
}

/** Minimal fixed-location, bounded and deduplicated endpoint for Vite dev and Node production. */
export function createWeatherEndpoint({apiKey=process.env.WEATHER_API_KEY,fetchImpl=globalThis.fetch,
  now=Date.now,timeoutMs=TIMEOUT_MS}={}){
  let cached=null,inFlight=null,lastFailure=-Infinity
  const rate=new Map()
  const requestWeather=async()=>{
    if(!apiKey||!apiKey.trim())throw Error('Weather service not configured')
    const url=new URL('https://api.weatherapi.com/v1/current.json')
    url.searchParams.set('key',apiKey)
    url.searchParams.set('q',CEBU_CITY)
    url.searchParams.set('aqi','no')
    const controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(),timeoutMs)
    try{
      const response=await fetchImpl(url,{signal:controller.signal,headers:{Accept:'application/json'}})
      if(!response.ok)throw Error('Weather provider unavailable')
      const value=parseCurrentWeather(await response.json())
      return {...value,fetchedAt:new Date(now()).toISOString()}
    }finally{clearTimeout(timeout)}
  }
  const current=async()=>{
    const time=now()
    if(cached&&time-cached.storedAt<CACHE_MS)return cached.value
    if(time-lastFailure<FAILURE_BACKOFF_MS)throw Error('Weather temporarily unavailable')
    if(!inFlight)inFlight=requestWeather().then(value=>{
      cached={value,storedAt:now()};return value
    }).catch(error=>{lastFailure=now();throw error}).finally(()=>{inFlight=null})
    return inFlight
  }
  return async function weatherEndpoint(req,res){
    if(req.method!=='GET'){reply(res,405,{status:'unavailable'});return}
    const time=now(),ip=req.socket?.remoteAddress??'unknown'
    if(rate.size>4096)rate.clear()
    const entry=rate.get(ip)
    const hit=entry&&time-entry.since<RATE_WINDOW_MS?{since:entry.since,count:entry.count+1}:{since:time,count:1}
    rate.set(ip,hit)
    if(hit.count>RATE_MAX){reply(res,429,{status:'unavailable'});return}
    if(!apiKey||!apiKey.trim()){reply(res,503,{status:'unavailable'});return}
    try{reply(res,200,{status:'ok',weather:await current()})}
    catch{reply(res,503,{status:'unavailable'})}
  }
}
