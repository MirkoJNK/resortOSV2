import { useEffect, useRef, useState } from 'react'
import type { AppRoute, Department } from '../../shell/navigation'
import type { TutorialStep, TutorialView } from './tutorialManifest'
import { TutorialClipGate, cueForStep, cueIndexAt, stepAfterEnded } from './tutorialTiming'
import { afterPaint, waitForTourTarget } from './tutorialTargets'
import { TutorialOverlay } from './TutorialOverlay'

type TutorialControllerProps = {
  sessionId: number
  workspace: Department
  steps: readonly TutorialStep[]
  route: AppRoute
  onNavigate: (route:AppRoute,view?:TutorialView)=>boolean
  onPresent: (route:AppRoute,view?:TutorialView)=>void
  onSkip: ()=>void
  onComplete: ()=>void
  onAbort: ()=>void
}

const viewForCue=(step:TutorialStep,index:number):TutorialView|undefined => {
  for(let at=index;at>=0;at--)if(step.cues[at].view)return step.cues[at].view
  return undefined
}

/** One HTMLAudioElement controls all seven narrated scenes; no timer advances audio. */
export function TutorialController({sessionId,workspace,steps,route,onNavigate,onPresent,onSkip,onComplete,onAbort}:TutorialControllerProps) {
  const [stepIndex,setStepIndex]=useState(0)
  const [cuePosition,setCuePosition]=useState({stepIndex:0,index:0})
  const [status,setStatus]=useState<'preparing'|'playing'|'waiting'|'blocked'|'error'>('preparing')
  const [error,setError]=useState('')
  const audioRef=useRef<HTMLAudioElement|null>(null)
  const generation=useRef(0)
  const arrived=useRef(false)
  const routeRef=useRef(route)
  const handlers=useRef({onNavigate,onPresent,onSkip,onComplete,onAbort})
  const resumeRef=useRef<()=>void>(()=>{})
  routeRef.current=route
  handlers.current={onNavigate,onPresent,onSkip,onComplete,onAbort}
  const step=steps[stepIndex]

  useEffect(()=>{
    const audio=new Audio()
    audio.preload='auto'
    audio.playbackRate=1
    audioRef.current=audio
    return ()=>{
      generation.current++
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current=null
    }
  },[sessionId])

  useEffect(()=>{
    if(!step || !audioRef.current)return
    const audio=audioRef.current
    const currentGeneration=++generation.current
    const aborter=new AbortController()
    const clipGate=new TutorialClipGate()
    let prepared=false
    let mediaFailed=false
    let endingTimer:number|undefined
    let currentCue=0
    let pausedForVisibility=false
    const stale=()=>aborter.signal.aborted||currentGeneration!==generation.current
    arrived.current=false
    setCuePosition({stepIndex,index:0})
    setError('')
    setStatus('preparing')
    audio.pause()
    audio.currentTime=0
    audio.src=step.audio
    audio.load()

    const beginPlayback=async()=>{
      if(stale()||!prepared||mediaFailed)return
      if(document.hidden){pausedForVisibility=true;setStatus('waiting');return}
      try{
        await audio.play()
        if(stale()){audio.pause();return}
        pausedForVisibility=false
        setStatus('playing')
      }catch(cause){
        if(stale())return
        const blocked=cause instanceof DOMException && cause.name==='NotAllowedError'
        setStatus(blocked?'blocked':'error')
        setError(blocked?'Your browser needs one click to enable narration':
          'Narration could not play. You can safely skip and try again')
      }
    }
    resumeRef.current=()=>{void beginPlayback()}

    const onTimeUpdate=()=>{
      if(stale())return
      const next=cueIndexAt(step.cues,audio.currentTime)
      if(next===currentCue)return
      currentCue=next
      setCuePosition({stepIndex,index:next})
      handlers.current.onPresent(step.route,viewForCue(step,next))
    }
    const onEnded=()=>{
      if(stale()||mediaFailed||!clipGate.ended())return
      setStatus('preparing')
      endingTimer=window.setTimeout(()=>{
        if(stale())return
        const next=stepAfterEnded(steps,stepIndex)
        if(next===null)handlers.current.onComplete()
        else setStepIndex(next)
      },480)
    }
    const onAudioError=()=>{
      if(stale())return
      mediaFailed=true
      setError('This narration recording is unavailable. The tutorial has not advanced')
      setStatus('error')
    }
    const onMetadata=()=>{
      if(stale()||mediaFailed)return
      if(!Number.isFinite(audio.duration)||audio.duration<=0){
        mediaFailed=true
        setError('This recording has an invalid audio duration. The tutorial is paused safely')
        setStatus('error')
      }
    }
    const onVisibility=()=>{
      if(stale())return
      if(document.hidden){
        if(!audio.paused){audio.pause();pausedForVisibility=true;setStatus('waiting')}
      }else if(pausedForVisibility&&prepared){void beginPlayback()}
    }
    audio.addEventListener('timeupdate',onTimeUpdate)
    audio.addEventListener('ended',onEnded)
    audio.addEventListener('error',onAudioError)
    audio.addEventListener('loadedmetadata',onMetadata)
    document.addEventListener('visibilitychange',onVisibility)

    const prepare=async()=>{
      const first=step.cues[0]
      if(!handlers.current.onNavigate(step.route,first.view)){
        if(!stale())handlers.current.onAbort()
        return
      }
      // The final narrated scene must show the real dashboard target, never a
      // generic page fallback or a still-rendering destination.
      const isCompletionStep=stepIndex===steps.length-1
      const target=await waitForTourTarget(first.target,first.fallback,
        ()=>routeRef.current===step.route,aborter.signal,8500,isCompletionStep)
      if(stale())return
      if(!target){
        setStatus('error')
        setError('This page could not be prepared for narration. No records were changed')
        return
      }
      arrived.current=true
      target.scrollIntoView({block:'center',inline:'nearest',behavior:
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})
      await afterPaint()
      if(stale())return
      prepared=true
      void beginPlayback()
    }
    void prepare()
    return ()=>{
      clipGate.cancel()
      aborter.abort()
      if(endingTimer!==undefined)window.clearTimeout(endingTimer)
      audio.removeEventListener('timeupdate',onTimeUpdate)
      audio.removeEventListener('ended',onEnded)
      audio.removeEventListener('error',onAudioError)
      audio.removeEventListener('loadedmetadata',onMetadata)
      document.removeEventListener('visibilitychange',onVisibility)
      audio.pause()
    }
  },[sessionId,stepIndex,step,steps])

  useEffect(()=>{
    if(step && arrived.current && route!==step.route)handlers.current.onAbort()
  },[route,status,step])

  const skip=()=>{
    generation.current++
    audioRef.current?.pause()
    handlers.current.onSkip()
  }
  if(!step)return null
  return <TutorialOverlay workspace={workspace} step={step} stepNumber={stepIndex+1} total={steps.length}
    cue={cueForStep(step,stepIndex,cuePosition)} status={status} error={error} onSkip={skip}
    onEnableAudio={()=>resumeRef.current()}/>
}
