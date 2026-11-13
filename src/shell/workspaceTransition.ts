import type { Department } from './navigation'

/** Full-screen branding is reserved for accepted department changes and initial entry. */
export const WORKSPACE_TRANSITION_MS = 1500

export type WorkspaceTransition = Readonly<{
  id: number
  destination: Department
}>

export function prefersReducedWorkspaceMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Returning the existing object for within-department routes avoids restarting the timer. */
export function nextWorkspaceTransition(
  current: WorkspaceTransition | null,
  previous: Department | null,
  next: Department,
  reducedMotion: boolean
): WorkspaceTransition | null {
  if (reducedMotion) return null
  if (previous === next) return current
  return { id: (current?.id ?? 0) + 1, destination: next }
}

/** Small injectable timer makes the exact 1500 ms lifecycle testable without browser sleeps. */
export function scheduleWorkspaceTransitionEnd(
  onComplete: () => void,
  clock: { schedule: (callback: () => void, delayMs: number) => number; cancel: (id: number) => void } = {
    schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
    cancel: id => window.clearTimeout(id)
  }
): () => void {
  const id = clock.schedule(onComplete, WORKSPACE_TRANSITION_MS)
  return () => clock.cancel(id)
}
