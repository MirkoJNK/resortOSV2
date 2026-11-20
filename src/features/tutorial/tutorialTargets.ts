/** Every selector is generated from our own static manifest; never from user content. */
export const tourSelector=(name:string):string=>`[data-tour-target="${name}"]`

export function visibleTourTarget(name:string):HTMLElement|null {
  const element=document.querySelector<HTMLElement>(tourSelector(name))
  if(!element)return null
  const rect=element.getBoundingClientRect()
  return rect.width>0&&rect.height>0?element:null
}

export function selectPreparedTarget<T>(primary:T|null,fallback:T|null,requirePrimary:boolean):T|null {
  return primary??(requirePrimary?null:fallback)
}

export function waitForTourTarget(target:string,fallback:string,routeReady:()=>boolean,signal:AbortSignal,
  timeout=8500,requirePrimary=false):Promise<HTMLElement|null> {
  return new Promise(resolve=>{
    if(signal.aborted){resolve(null);return}
    let completed=false
    const finish=(result:HTMLElement|null)=>{
      if(completed)return
      completed=true
      observer.disconnect()
      clearTimeout(timer)
      signal.removeEventListener('abort',onAbort)
      resolve(result)
    }
    const find=()=>{
      if(!routeReady())return
      const element=visibleTourTarget(target)
      if(element)finish(element)
    }
    const onAbort=()=>finish(null)
    const observer=new MutationObserver(find)
    const timer=window.setTimeout(()=>finish(routeReady()?selectPreparedTarget(
      visibleTourTarget(target),visibleTourTarget(fallback),requirePrimary):null),timeout)
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,
      attributeFilter:['style','class','data-tour-target','aria-hidden']})
    signal.addEventListener('abort',onAbort,{once:true})
    find()
  })
}

export const afterPaint=():Promise<void>=>new Promise(resolve=>{
  requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))
})
