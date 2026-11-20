import {useEffect,useState} from 'react'
import type {Employee} from '../employees/model'
import {firstEmployeeName} from '../employees/model'

const TIMEZONE='Asia/Manila'
const hourFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:TIMEZONE,hour:'2-digit',hourCycle:'h23'})
const dateFormatter=new Intl.DateTimeFormat('en-US',{timeZone:TIMEZONE,
  weekday:'short',month:'short',day:'numeric',year:'numeric'})

export function greetingForPhilippineTime(date:Date,employee:Pick<Employee,'id'|'fullName'>):string {
  const hour=Number(hourFormatter.formatToParts(date).find(part=>part.type==='hour')?.value)
  const period=hour<12?'morning':hour<18?'afternoon':'evening'
  return `Good ${period}, ${firstEmployeeName(employee)}`
}
export const philippineDashboardDate=(date:Date)=>dateFormatter.format(date)

/** Align with clock minute changes, and catch up immediately after background tab suspension. */
export function useDashboardClock():Date {
  const [now,setNow]=useState(()=>new Date())
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|null=null
    const tick=()=>{
      setNow(new Date())
      if(timer!==null)clearTimeout(timer)
      timer=setTimeout(tick,60_000-Date.now()%60_000+25)
    }
    const resume=()=>{if(document.visibilityState==='visible')tick()}
    tick()
    window.addEventListener('focus',tick)
    document.addEventListener('visibilitychange',resume)
    return ()=>{
      if(timer!==null)clearTimeout(timer)
      window.removeEventListener('focus',tick)
      document.removeEventListener('visibilitychange',resume)
    }
  },[])
  return now
}
