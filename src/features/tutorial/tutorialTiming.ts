import type { TutorialCue, TutorialStep } from './tutorialManifest'

/** Cue state belongs to an audio step; a preceding clip's final cue must never
 * index the next clip before React's playback effect resets its position. */
export function cueForStep(step:TutorialStep,stepIndex:number,position:{stepIndex:number;index:number}):TutorialCue {
  return step.cues[position.stepIndex===stepIndex?position.index:0]??step.cues[0]
}

/** Playback position, never wall-clock time, is the source of truth for visual cues. */
export function cueIndexAt(cues:readonly TutorialCue[],currentTime:number):number {
  if(!Number.isFinite(currentTime)||currentTime<0)return 0
  for(let index=cues.length-1;index>=0;index--)
    if(currentTime>=cues[index].at)return index
  return 0
}

export const stepAfterEnded=(steps:readonly TutorialStep[],index:number):number|null =>
  index+1<steps.length?index+1:null

/** No step changes here unless a real media-ended event has been processed. */
export function acceptsEndedEvent(ended:boolean,alreadyAdvanced:boolean,stale:boolean):boolean {
  return ended&&!alreadyAdvanced&&!stale
}

/** Prevents duplicate media-ended events or callbacks from a canceled clip. */
export class TutorialClipGate {
  private advanced=false
  private canceled=false

  ended():boolean {
    if(!acceptsEndedEvent(true,this.advanced,this.canceled))return false
    this.advanced=true
    return true
  }

  cancel():void {this.canceled=true}
}
