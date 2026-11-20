import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Department } from '../../shell/navigation'
import type { TutorialCue, TutorialStep } from './tutorialManifest'
import { visibleTourTarget } from './tutorialTargets'
import './tutorial.css'

type HighlightRect={top:number;left:number;width:number;height:number}
type Props={
  workspace:Department;step:TutorialStep;stepNumber:number;total:number;cue:TutorialCue
  status:'preparing'|'playing'|'waiting'|'blocked'|'error';error:string
  onSkip:()=>void;onEnableAudio:()=>void
}

export function TutorialOverlay({workspace,step,stepNumber,total,cue,status,error,onSkip,onEnableAudio}:Props) {
  const [rect,setRect]=useState<HighlightRect|null>(null)
  const skipRef=useRef<HTMLButtonElement>(null)
  const enableRef=useRef<HTMLButtonElement>(null)
  const actionRef=useRef(onSkip)
  actionRef.current=onSkip
  useEffect(()=>{skipRef.current?.focus()},[])
  useEffect(()=>{
    let frame=0
    let observed:Element|null=null
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false
    const resizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>schedule()):null
    const update=()=>{
      frame=0
      const element=visibleTourTarget(cue.target)??visibleTourTarget(cue.fallback)
      if(element!==observed){
        resizeObserver?.disconnect()
        observed=element
        if(element)resizeObserver?.observe(element)
      }
      if(!element){setRect(null);return}
      const bounds=element.getBoundingClientRect()
      const padding=7
      const left=Math.max(5,bounds.left-padding),top=Math.max(5,bounds.top-padding)
      const right=Math.min(window.innerWidth-5,bounds.right+padding)
      const bottom=Math.min(window.innerHeight-5,bounds.bottom+padding)
      const next=right>left&&bottom>top?{left,top,width:right-left,height:bottom-top}:null
      setRect(current=>current&&next&&current.left===next.left&&current.top===next.top&&
        current.width===next.width&&current.height===next.height?current:next)
    }
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)}
    const mutation=new MutationObserver(schedule)
    mutation.observe(document.querySelector('.main-shell')??document.body,{subtree:true,childList:true,attributes:true,
      attributeFilter:['style','class','data-tour-target','aria-hidden']})
    window.addEventListener('resize',schedule)
    window.addEventListener('scroll',schedule,true)
    const initial=visibleTourTarget(cue.target)
    if(initial){
      const box=initial.getBoundingClientRect()
      if(box.bottom<80||box.top>window.innerHeight-100)
        initial.scrollIntoView({block:'center',behavior:reduce?'instant':'smooth'})
    }
    schedule()
    return ()=>{
      mutation.disconnect();resizeObserver?.disconnect()
      window.removeEventListener('resize',schedule)
      window.removeEventListener('scroll',schedule,true)
      if(frame)cancelAnimationFrame(frame)
    }
  },[cue.target,cue.fallback])

  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();actionRef.current();return}
      if(event.key!=='Tab')return
      const controls=[skipRef.current,...(status==='blocked'?[enableRef.current]:[])].filter(
        (element):element is HTMLButtonElement=>Boolean(element))
      if(!controls.length)return
      const current=document.activeElement
      const position=controls.findIndex(element=>element===current)
      event.preventDefault()
      controls[(position+(event.shiftKey?controls.length-1:1))%controls.length].focus()
    }
    window.addEventListener('keydown',key,true)
    return ()=>window.removeEventListener('keydown',key,true)
  },[status])

  const workspaceName=workspace==='admin'?'Administration':workspace==='restaurant'?'Restaurant':'Front Desk'
  const content=<div className="tour-overlay" role="dialog" aria-modal="true" aria-label={`${workspaceName} guided tutorial`}>
    <div className="tour-interaction-shield" aria-hidden="true"/>
    {rect?<div className="tour-spotlight" aria-hidden="true" style={{top:rect.top,left:rect.left,width:rect.width,height:rect.height}}/>:
      <div className="tour-full-scrim" aria-hidden="true"/>}
    <button ref={skipRef} type="button" className="tour-skip" onClick={onSkip}>Skip tutorial</button>
    <div className="tour-caption" aria-live="polite" aria-atomic="true">
      <span className="tour-step-count">{workspaceName} · {stepNumber} of {total}</span>
      <h2>{step.title}</h2>
      <p>{cue.text}</p>
      {status==='preparing'&&<small>Preparing the next screen…</small>}
      {status==='waiting'&&<small>Narration will resume when you return to this tab</small>}
      {status==='blocked'&&<div className="tour-audio-recovery"><p role="status">{error}</p>
        <button ref={enableRef} type="button" onClick={onEnableAudio}>Enable narration</button></div>}
      {status==='error'&&<p className="tour-error" role="alert">{error}</p>}
    </div>
  </div>
  // The workspace-transition loader may set .app-shell inert. Keeping controls
  // in a body portal guarantees Skip is not a descendant of that inert region.
  return typeof document==='undefined'?content:createPortal(content,document.body)
}
