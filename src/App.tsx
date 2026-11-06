import { useEffect, useMemo, useState } from 'react'
import type { Area, Store } from './domain/types'
import { routeFromHash, departmentForRoute, hashForRoute, restaurantNav } from './shell/navigation'
import type { AppRoute, Department } from './shell/navigation'
import { Sidebar } from './shell/Sidebar'
import { Topbar } from './shell/Topbar'
import { GlobalSearch } from './shell/GlobalSearch'
import { loadStore } from './domain/store'
import { qualityScenario, qualityStore, qualitySupportTickets } from './data/qualityFixtures'
import { SupportWorkspace, createSupportTickets } from './components/SupportWorkspace'
import type { SampleTicket } from './components/SupportWorkspace'
import { Dashboard } from './features/dashboard/Dashboard'
import { SystemManagement } from './features/system-management/SystemManagement'
import { TablesManager } from './features/tables-manager/TablesManager'
import { RoomsManager } from './features/rooms-manager/RoomsManager'
import { ServiceCatalog } from './features/service-catalog/ServiceCatalog'
import { RestaurantDashboard } from './features/restaurant/RestaurantDashboard'

function SectionHeader({ title, subtitle, action }: {
  title: string
  subtitle: string
  action?: React.ReactNode
}) {
  return <div className="section-header">
    <div>
      <h1>
        {title}
      </h1>
      <span>
        {subtitle}
      </span>
    </div>
    {action}
  </div>
}
function AuditPage({ store }: { store: Store }) {
  return <>
    <SectionHeader
      title="Audit Log"
      subtitle="A record of demo workspace activity" />
    <div className="panel data-panel">
      <div className="data-panel-head">
        <h2>Recent events</h2>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Person</th>
              <th>Action</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {store.events.map(e => <tr key={e.id}>
              <td>
                {new Date(e.created).toLocaleString()}
              </td>
              <td>
                <strong>
                  {e.author}
                </strong>
              </td>
              <td>
                {e.action}
              </td>
              <td>
                <em className={`category-pill ${e.tone}`}>
                  {e.category}
                </em>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  </>
}
export function App() {
  const [area, setArea] = useState<AppRoute>(routeFromHash)
  const [store] = useState<Store>(loadStore)
  // Shared in-session tickets keep Dashboard metrics synchronized with Support.
  // Real multi-user persistence and authorization belong to the future backend.
  const [supportTickets, setSupportTickets] = useState<SampleTicket[]>(createSupportTickets)
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tablesDirty, setTablesDirty] = useState(false)
  const [roomsDirty, setRoomsDirty] = useState(false)
  const [servicesDirty, setServicesDirty] = useState(false)
  useEffect(() => {
    const h = () => {
      const next = routeFromHash()
      if (area === 'tables' && next !== 'tables' && tablesDirty && !window.confirm('Discard unsaved table changes?')) {
        history.replaceState(null, '', '#systems/tables')
        return
      }
      if (area === 'rooms' && next !== 'rooms' && roomsDirty && !window.confirm('Discard unsaved room changes?')) {
        history.replaceState(null, '', '#systems/rooms')
        return
      }
      if (area === 'services' && next !== 'services' && servicesDirty && !window.confirm('Discard unsaved service changes?')) {
        history.replaceState(null, '', '#systems/services')
        return
      }
      // Unimplemented Restaurant paths must not become a misleading URL or an Admin page.
      if (next === 'restaurant-dashboard' && location.hash !== '#/restaurant/dashboard') {
        history.replaceState(null, '', '#/restaurant/dashboard')
      }
      setArea(next)
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    if (area === 'restaurant-dashboard' && location.hash !== '#/restaurant/dashboard') {
      history.replaceState(null, '', '#/restaurant/dashboard')
    }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [area, tablesDirty, roomsDirty, servicesDirty])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = old
    }
  }, [menuOpen])
  // The URL is authoritative. All departmental switches pass through the existing dirty-form guards.
  const go = (a: AppRoute) => {
    const nextHash = hashForRoute(a)
    if (location.hash !== nextHash) location.hash = nextHash
    else setArea(a)
  }
  const switchDepartment = (next: Department) => go(next === 'restaurant' ? 'restaurant-dashboard' : 'dashboard')
  const department = departmentForRoute(area)
  const reviewScenario = qualityScenario(location.search)
  const dashboardData = useMemo(() => qualityStore(store, reviewScenario), [store, reviewScenario])
  const dashboardTickets = useMemo(() => qualitySupportTickets(supportTickets, reviewScenario), [supportTickets, reviewScenario])
  const page = useMemo(() => {
    switch (area) {
      case 'dashboard':
        return <Dashboard
          store={dashboardData}
          tickets={dashboardTickets}
          go={go} />
      case 'support':
        return <SupportWorkspace
          tickets={supportTickets}
          onTicketsChange={setSupportTickets} />
      case 'audit':
        return <AuditPage store={store} />
      case 'systems':
        return <SystemManagement />
      case 'tables':
        return <TablesManager onDirtyChange={setTablesDirty} />
      case 'rooms':
        return <RoomsManager onDirtyChange={setRoomsDirty} />
      case 'services':
        return <ServiceCatalog onDirtyChange={setServicesDirty} />
      case 'restaurant-dashboard':
        return <RestaurantDashboard />
      default:
        return <Dashboard
          store={dashboardData}
          tickets={dashboardTickets}
          go={go} />
    }
  }, [
    area,
    store,
    dashboardData,
    dashboardTickets,
    supportTickets
  ])
  return <div className="app-shell">
    <Sidebar
      area={area === 'tables' || area === 'rooms' || area === 'services' ? 'systems' : area}
      items={department === 'restaurant' ? restaurantNav : undefined}
      onNavigate={go}
      menuOpen={menuOpen}
      department={department}
      onWorkspaceChange={switchDepartment}
      onClose={() => setMenuOpen(false)} />
    <main className="main-shell">
      <Topbar
        onSearch={() => setSearchOpen(true)}
        onMenu={() => setMenuOpen(true)}
        menuOpen={menuOpen}
        department={department} />
      <div className={`main-content ${area === 'dashboard' || area === 'restaurant-dashboard' ? 'dashboard-motion' : ''}`}>
        {page}
      </div>
    </main>
    <GlobalSearch
      go={go}
      items={department === 'restaurant' ? restaurantNav.filter(item => item.enabled).map(item => ({ area: item.area as AppRoute, label: item.label })) : undefined}
      isOpen={searchOpen}
      onClose={() => setSearchOpen(false)} />
  </div>
}
