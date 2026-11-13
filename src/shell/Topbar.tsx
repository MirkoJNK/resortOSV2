import { Bell, CircleHelp, Menu, Search } from 'lucide-react'
import type { Department } from './navigation'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

/** Display-only identity: demo routing is controlled separately by WorkspaceSwitcher. */
export function Topbar({ onSearch, onMenu, menuOpen, department = 'admin', onWorkspaceChange }: {
  onSearch: () => void
  onMenu: () => void
  menuOpen: boolean
  department?: Department
  onWorkspaceChange: (next: Department) => void
}) {
  const name = department === 'admin' ? 'Demo Administrator' : department === 'restaurant' ? 'Demo Restaurant' : 'Demo Front Desk'
  const initials = department === 'admin' ? 'DA' : department === 'restaurant' ? 'DR' : 'DF'
  return <header className="topbar">
    <button
      className="mobile-toggle"
      onClick={onMenu}
      aria-label="Open navigation"
      aria-controls="resortos-nav"
      aria-expanded={menuOpen}>
      <Menu size={22} />
    </button>
    <WorkspaceSwitcher department={department} onSwitch={onWorkspaceChange}/>
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
    </div>
  </header>
}
