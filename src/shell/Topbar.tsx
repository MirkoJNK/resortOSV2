import { Bell, CircleHelp, Menu, Search } from 'lucide-react'
import type { Department } from './navigation'

/** Display-only identity: demo routing is controlled separately by WorkspaceSwitcher. */
export function Topbar({ onSearch, onMenu, menuOpen, department = 'admin' }: {
  onSearch: () => void
  onMenu: () => void
  menuOpen: boolean
  department?: Department
}) {
  const name = department === 'admin' ? 'Demo Administrator' : 'Demo Restaurant'
  const initials = department === 'admin' ? 'DA' : 'DR'
  return <header className="topbar">
    <button
      className="mobile-toggle"
      onClick={onMenu}
      aria-label="Open navigation"
      aria-controls="resortos-nav"
      aria-expanded={menuOpen}>
      <Menu size={22} />
    </button>
    <div className="topbar-spacer" />
    <button className="global-search" onClick={onSearch}>
      <Search size={17} />
      <span>Search pages</span>
      <kbd>Ctrl K</kbd>
    </button>
    <button type="button" className="header-circle notification"
      title="Notifications are not available yet" aria-label="Notifications unavailable" disabled>
      <Bell size={17} />
    </button>
    <button type="button" className="header-circle"
      title="Help is not available yet" aria-label="Help unavailable" disabled>
      <CircleHelp size={18} />
    </button>
    <div className="ros-profile-identity" aria-label={`Current demo identity: ${name}`}>
      <span className="ros-profile-avatar" aria-hidden="true">{initials}</span>
      <span className="ros-profile-name">{name}</span>
    </div>
  </header>
}
