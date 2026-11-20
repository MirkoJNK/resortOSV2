import { Menu, Search } from 'lucide-react'
import type { Department } from './navigation'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import type { Employee } from '../features/employees/model'
import type { PermissionState } from '../features/roles-permissions/model'
import {hasPermission} from '../features/roles-permissions/model'
import { DemoAccountMenu } from './DemoAccountMenu'
import { HelpMenu } from './HelpMenu'
import {NotificationMenu} from './NotificationMenu'
import type {Notification} from '../features/notifications/model'

/** Display-only identity: demo routing is controlled separately by WorkspaceSwitcher. */
export function Topbar({ onSearch, onMenu, menuOpen, department = 'admin', onWorkspaceChange,
  account, accounts, permissions, onAccountSwitch, allowedWorkspaces, accountBusy,
  onBrowseHelp, onSupport,onOpenNotification }: {
  onSearch: () => void
  onMenu: () => void
  menuOpen: boolean
  department?: Department
  onWorkspaceChange: (next: Department) => void
  account: Employee; accounts: Employee[]; permissions: PermissionState;
  onAccountSwitch: (id: string) => void; allowedWorkspaces: Department[]; accountBusy: boolean
  onBrowseHelp:()=>void;onSupport:()=>void
  onOpenNotification:(notice:Notification)=>void
}) {
  return <header className="topbar">
    <button
      className="mobile-toggle"
      onClick={onMenu}
      aria-label="Open navigation"
      aria-controls="resortos-nav"
      aria-expanded={menuOpen}>
      <Menu size={22} />
    </button>
    <WorkspaceSwitcher department={department} onSwitch={onWorkspaceChange} allowed={allowedWorkspaces}/>
    <div className="topbar-spacer" />
    <button className="global-search" onClick={onSearch}>
      <Search size={17} />
      <span>Search pages</span>
      <kbd>Ctrl K</kbd>
    </button>
    <NotificationMenu accountId={account.id} onOpen={onOpenNotification} busy={accountBusy}
      adminWorkspace={hasAdminNotifications(permissions,account)}/>
    <HelpMenu accountId={account.id} onBrowseHelp={onBrowseHelp}
      onSupport={onSupport} busy={accountBusy}/>
    <DemoAccountMenu account={account} accounts={accounts} permissions={permissions} onSwitch={onAccountSwitch} busy={accountBusy}/>
  </header>
}
function hasAdminNotifications(permissions:PermissionState,account:Employee):boolean{
  return (account.role==='admin'||account.role==='super-admin')&&
    hasPermission(permissions,account,'administration.audit.view')
}
