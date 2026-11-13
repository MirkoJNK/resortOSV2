import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Department } from './navigation'

type Props = { destination: Department }

const names: Record<Department, string> = {
  admin: 'Administration',
  restaurant: 'Restaurant',
  'front-desk': 'Front Desk'
}

/** Portal isolation prevents transformed main-content ancestors from moving fixed dialogs. */
export function WorkspaceTransitionOverlay({ destination }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell')
    const previousInert = shell?.inert ?? false
    const previousAriaHidden = shell?.getAttribute('aria-hidden') ?? null
    const previousOverflow = document.body.style.overflow
    if (shell) {
      shell.inert = true
      shell.setAttribute('aria-hidden', 'true')
    }
    document.body.style.overflow = 'hidden'
    overlayRef.current?.focus({ preventScroll: true })

    return () => {
      if (shell) {
        shell.inert = previousInert
        if (previousAriaHidden === null) shell.removeAttribute('aria-hidden')
        else shell.setAttribute('aria-hidden', previousAriaHidden)
      }
      document.body.style.overflow = previousOverflow
      const destinationContent = document.querySelector<HTMLElement>('.main-content')
      destinationContent?.focus({ preventScroll: true })
    }
  }, [])

  // Static/SSR renderers have no browser document; the visual overlay is client-only.
  return typeof document === 'undefined' ? null : createPortal(
    <div
      ref={overlayRef}
      className="ros-workspace-loader"
      role="status"
      aria-live="polite"
      aria-label={`Opening ${names[destination]}`}
      tabIndex={-1}
    >
      <div className="ros-workspace-loader-logo" aria-hidden="true">
        <img className="ros-workspace-loader-faint" src={`${import.meta.env.BASE_URL}assets/resortos-brand-balanced.svg`} alt="" />
        <img className="ros-workspace-loader-color" src={`${import.meta.env.BASE_URL}assets/resortos-brand-balanced.svg`} alt="" />
      </div>
      <span className="ros-workspace-loader-sr">Opening {names[destination]}</span>
    </div>,
    document.body
  )
}
