import { ClipboardList, UtensilsCrossed } from 'lucide-react'
import type { AppRoute, DepartmentNavItem } from './navigation'
import { primaryNav } from './navigation'
import type { Department } from './navigation'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

/** Public assets are copied verbatim; use Vite's configured project-site base. */
const publicAssetUrl = (url: string): string => `${import.meta.env.BASE_URL}${url.replace(/^\/+/, '')}`

function Logo() {
  return <div className="brand ros-light-brand">
    <img
      className="ros-full-brandmark"
      src={publicAssetUrl("/assets/sidebar-brand-approved-v058.png")}
      alt="resortOS" />
  </div>
}

export function Sidebar({ area, onNavigate, menuOpen, onClose, items, department = 'admin', onWorkspaceChange }: {
  area: AppRoute
  onNavigate: (a: AppRoute) => void
  menuOpen: boolean
  onClose: () => void
  items?: DepartmentNavItem[]
  department?: Department
  onWorkspaceChange?: (department: Department) => void
}) {
  // Admin's original navigation list and markup remain the default.
  const nav = items ?? primaryNav.map(item => ({ ...item, enabled: true }))
  const navItem = (item: DepartmentNavItem) => {
    const icon = item.iconAsset ? <img
      className="ros-sidebar-nav-icon"
      src={publicAssetUrl(item.iconAsset)}
      alt=""
      aria-hidden="true" /> : item.icon === 'tables' ? <UtensilsCrossed className="ros-sidebar-nav-icon" size={28} strokeWidth={1.8} aria-hidden="true" /> : <ClipboardList className="ros-sidebar-nav-icon" size={28} strokeWidth={1.8} aria-hidden="true" />
    return <button
      key={item.area}
      className={`side-link ${area === item.area ? 'active' : ''} ${!item.enabled ? 'restaurant-nav-unavailable' : ''}`}
      aria-current={area === item.area ? 'page' : undefined}
      aria-label={!item.enabled ? `${item.label} — not yet available` : undefined}
      title={!item.enabled ? 'Not yet available' : undefined}
      disabled={!item.enabled}
      type="button"
      onClick={() => {
        if (item.enabled) onNavigate(item.area as AppRoute)
        onClose()
      }}>
      {icon}
      <span>{item.label}</span>
    </button>
  }
  return <>
    <div className={`mobile-shade ${menuOpen ? 'visible' : ''}`} onClick={onClose} />
    <aside
      className={`sidebar ros-light-sidebar ${menuOpen ? 'open' : ''}`}
      id="resortos-nav">
      <Logo />
      <WorkspaceSwitcher department={department} onSwitch={next => { onClose(); onWorkspaceChange?.(next) }} />
      <nav
        className="nav-stack"
        aria-label="Main navigation">
        {nav.map(navItem)}
      </nav>
      <div
        className="side-bottom ros-coastal-bottom"
        aria-hidden="true">
        <img
          src={publicAssetUrl("/assets/sidebar-coastal-approved-v058.png")}
          alt="" />
      </div>
    </aside>
  </>
}
