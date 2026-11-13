import { BedDouble, ClipboardList, CreditCard, LogOut, UtensilsCrossed } from 'lucide-react'
import type { AppRoute, DepartmentNavItem } from './navigation'
import { primaryNav } from './navigation'

function Logo() {
  return <div className="brand ros-light-brand">
    <img
      className="ros-full-brandmark"
      src={`${import.meta.env.BASE_URL}assets/resortos-brand-balanced.svg`}
      alt="resortOS" />
  </div>
}

export function Sidebar({ area, onNavigate, menuOpen, onClose, items }: {
  area: AppRoute
  onNavigate: (a: AppRoute) => void
  menuOpen: boolean
  onClose: () => void
  items?: DepartmentNavItem[]
}) {
  // Admin's original navigation list and markup remain the default.
  const nav = items ?? primaryNav.map(item => ({ ...item, enabled: true }))
  const navItem = (item: DepartmentNavItem) => {
    const icon = item.iconAsset ? <img
      className="ros-sidebar-nav-icon"
      src={item.iconAsset}
      alt=""
      aria-hidden="true" /> : item.icon === 'tables' ? <UtensilsCrossed className="ros-sidebar-nav-icon" size={28} strokeWidth={1.8} aria-hidden="true" /> : item.icon === 'rooms' ? <BedDouble className="ros-sidebar-nav-icon" size={28} strokeWidth={1.8} aria-hidden="true" /> : item.icon === 'charges' ? <CreditCard className="ros-sidebar-nav-icon" size={28} strokeWidth={1.8} aria-hidden="true" /> : item.icon === 'checkout' ? <LogOut className="ros-sidebar-nav-icon" size={28} strokeWidth={1.8} aria-hidden="true" /> : <ClipboardList className="ros-sidebar-nav-icon" size={28} strokeWidth={1.8} aria-hidden="true" />
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
          <nav
        className="nav-stack"
        aria-label="Main navigation">
        {nav.map(navItem)}
      </nav>
      <div
        className="side-bottom ros-coastal-bottom"
        aria-hidden="true">
        <img
          src={`${import.meta.env.BASE_URL}assets/sidebar-coastal-approved-v058.png`}
          alt="" />
      </div>
    </aside>
  </>
}
