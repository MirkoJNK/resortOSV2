import { useEffect, useMemo, useState } from 'react'
import type { Area, Store } from './domain/types'
import { routeFromHash, departmentForRoute, hashForRoute, restaurantNav, frontDeskNav } from './shell/navigation'
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
import { PaymentMethods } from './features/payment-methods/PaymentMethods'
import { DiscountManagement } from './features/discount-management/DiscountManagement'
import { ServiceCatalog } from './features/service-catalog/ServiceCatalog'
import { MenuCategories } from './features/menu-categories/MenuCategories'
import { MenuManagement } from './features/menu-management/MenuManagement'
import { RestaurantDashboard } from './features/restaurant/RestaurantDashboard'
import { FrontDeskDashboard } from './features/front-desk/FrontDeskDashboard'
import { FrontDeskRooms } from './features/front-desk/FrontDeskRooms'
import { FrontDeskCharges } from './features/front-desk/FrontDeskCharges'
import { FrontDeskCheckout } from './features/front-desk/FrontDeskCheckout'
import { RestaurantTables } from './features/restaurant-tables/RestaurantTables'
import { RestaurantOrders } from './features/restaurant-orders/RestaurantOrders'
import { WorkspaceTransitionOverlay } from './shell/WorkspaceTransitionOverlay'
import { nextWorkspaceTransition, prefersReducedWorkspaceMotion, scheduleWorkspaceTransitionEnd } from './shell/workspaceTransition'

function SectionHeader({ title, action }: {
  title: string
  action?: React.ReactNode
}) {
  return <div className="section-header">
    <div>
      <h1>
        {title}
      </h1>
    </div>
    {action}
  </div>
}
function AuditPage({ store }: { store: Store }) {
  return <>
    <SectionHeader title="Audit Log" />
    <div className="panel data-panel">
      <div className="data-panel-head">
        <h2>Recent demo events</h2>
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
  const [workspaceTransition, setWorkspaceTransition] = useState(() =>
    nextWorkspaceTransition(null, null, departmentForRoute(routeFromHash()), prefersReducedWorkspaceMotion())
  )
  const [ordersNavigationActivation, setOrdersNavigationActivation] = useState(0)
  const [chargesNavigationActivation, setChargesNavigationActivation] = useState(0)
  const [checkoutNavigationActivation, setCheckoutNavigationActivation] = useState(0)
  const [store] = useState<Store>(loadStore)
  // Shared in-session tickets keep Dashboard metrics synchronized with Support.
  // Real multi-user persistence and authorization belong to the future backend.
  const [supportTickets, setSupportTickets] = useState<SampleTicket[]>(createSupportTickets)
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tablesDirty, setTablesDirty] = useState(false)
  const [roomsDirty, setRoomsDirty] = useState(false)
  const [servicesDirty, setServicesDirty] = useState(false)
  const [paymentMethodsDirty, setPaymentMethodsDirty] = useState(false)
  const [discountsDirty, setDiscountsDirty] = useState(false)
  const [categoriesDirty, setCategoriesDirty] = useState(false)
  const [itemsDirty, setItemsDirty] = useState(false)
  const [restaurantTablesDirty, setRestaurantTablesDirty] = useState(false)
  const [frontDeskRoomsDirty, setFrontDeskRoomsDirty] = useState(false)
  const [frontDeskChargesDirty, setFrontDeskChargesDirty] = useState(false)
  const [frontDeskCheckoutDirty, setFrontDeskCheckoutDirty] = useState(false)
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
      if (area === 'payment-methods' && next !== 'payment-methods' && paymentMethodsDirty && !window.confirm('Discard unsaved payment method changes?')) {
        history.replaceState(null, '', '#systems/payment-methods')
        return
      }
      if (area === 'discounts' && next !== 'discounts' && discountsDirty && !window.confirm('Discard unsaved discount settings?')) {
        history.replaceState(null, '', '#systems/discounts')
        return
      }
      if (area === 'menu-categories' && next !== 'menu-categories' && categoriesDirty && !window.confirm('Discard unsaved category changes?')) {
        history.replaceState(null, '', '#systems/menu-categories')
        return
      }
      if (area === 'menu' && next !== 'menu' && itemsDirty && !window.confirm('Discard unsaved item changes?')) {
        history.replaceState(null, '', '#systems/menu')
        return
      }
      if (area === 'front-desk-rooms' && next !== 'front-desk-rooms' && frontDeskRoomsDirty && !window.confirm('Discard unsaved check-in details?')) {
        history.replaceState(null, '', '#/front-desk/rooms')
        return
      }
      if (area === 'front-desk-checkout' && next !== 'front-desk-checkout' && frontDeskCheckoutDirty && !window.confirm('Discard unsaved checkout details?')) {
        history.replaceState(null, '', '#/front-desk/checkout')
        return
      }
      if (area === 'front-desk-charges' && next !== 'front-desk-charges' && frontDeskChargesDirty && !window.confirm('Discard unsaved charge details?')) {
        history.replaceState(null, '', '#/front-desk/charges')
        return
      }
      if (area === 'restaurant-tables' && next !== 'restaurant-tables' && restaurantTablesDirty && !window.confirm('Discard unsaved Restaurant Tables changes?')) {
        history.replaceState(null, '', '#/restaurant/tables')
        return
      }
      // Unknown Front Desk paths resolve within Front Desk, never to an Admin page.
      if (next === 'front-desk-dashboard' && location.hash !== '#/front-desk/dashboard') {
        history.replaceState(null, '', '#/front-desk/dashboard')
      }
      // Unimplemented Restaurant paths must not become a misleading URL or an Admin page.
      if (next === 'restaurant-dashboard' && location.hash !== '#/restaurant/dashboard') {
        history.replaceState(null, '', '#/restaurant/dashboard')
      }
      setWorkspaceTransition(current =>
        nextWorkspaceTransition(current, departmentForRoute(area), departmentForRoute(next), prefersReducedWorkspaceMotion())
      )
      setArea(next)
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    if (area === 'front-desk-dashboard' && location.hash !== '#/front-desk/dashboard') {
      history.replaceState(null, '', '#/front-desk/dashboard')
    }
    if (area === 'restaurant-dashboard' && location.hash !== '#/restaurant/dashboard') {
      history.replaceState(null, '', '#/restaurant/dashboard')
    }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [area, tablesDirty, roomsDirty, servicesDirty, paymentMethodsDirty, discountsDirty, categoriesDirty, itemsDirty, restaurantTablesDirty, frontDeskRoomsDirty, frontDeskChargesDirty, frontDeskCheckoutDirty])
  // A single timer owns each accepted workspace transition; interrupted transitions clean up.
  useEffect(() => {
    if (!workspaceTransition) return
    const transitionId = workspaceTransition.id
    return scheduleWorkspaceTransitionEnd(() => {
      setWorkspaceTransition(current => current?.id === transitionId ? null : current)
    })
  }, [workspaceTransition])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => {
      if (preference.matches) setWorkspaceTransition(null)
    }
    preference.addEventListener('change', onChange)
    return () => preference.removeEventListener('change', onChange)
  }, [])

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
    else {
      if (a === 'restaurant-orders') setOrdersNavigationActivation(n => n + 1)
      if (a === 'front-desk-charges') setChargesNavigationActivation(n => n + 1)
      if (a === 'front-desk-checkout') setCheckoutNavigationActivation(n => n + 1)
      setArea(a)
    }
  }
  const switchDepartment = (next: Department) => go(next === 'front-desk' ? 'front-desk-dashboard' : next === 'restaurant' ? 'restaurant-dashboard' : 'dashboard')
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
      case 'payment-methods':
        return <PaymentMethods onDirtyChange={setPaymentMethodsDirty} />
      case 'discounts':
        return <DiscountManagement onDirtyChange={setDiscountsDirty} />
      case 'services':
        return <ServiceCatalog onDirtyChange={setServicesDirty} />
      case 'menu-categories':
        return <MenuCategories onDirtyChange={setCategoriesDirty} />
      case 'menu':
        return <MenuManagement onDirtyChange={setItemsDirty} />
      case 'front-desk-dashboard':
        return <FrontDeskDashboard go={go} />
      case 'front-desk-rooms':
        return <FrontDeskRooms onDirtyChange={setFrontDeskRoomsDirty} />
      case 'front-desk-charges':
        return <FrontDeskCharges onDirtyChange={setFrontDeskChargesDirty} navigationActivation={chargesNavigationActivation} />
      case 'front-desk-checkout':
        return <FrontDeskCheckout onDirtyChange={setFrontDeskCheckoutDirty} navigationActivation={checkoutNavigationActivation} />
      case 'restaurant-dashboard':
        return <RestaurantDashboard go={go} />
      case 'restaurant-tables':
        return <RestaurantTables onDirtyChange={setRestaurantTablesDirty} />
      case 'restaurant-orders':
        return <RestaurantOrders go={go} navigationActivation={ordersNavigationActivation} />
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
    supportTickets,
    ordersNavigationActivation,
    chargesNavigationActivation,
    checkoutNavigationActivation
  ])
  return <div className="app-shell">
    <Sidebar
      area={area === 'tables' || area === 'rooms' || area === 'services' || area === 'menu-categories' || area === 'menu' || area === 'payment-methods' || area === 'discounts' ? 'systems' : area}
      items={department === 'restaurant' ? restaurantNav : department === 'front-desk' ? frontDeskNav : undefined}
      onNavigate={go}
      menuOpen={menuOpen}
      onClose={() => setMenuOpen(false)} />
    <main className="main-shell">
      <Topbar
        onSearch={() => setSearchOpen(true)}
        onMenu={() => setMenuOpen(true)}
        menuOpen={menuOpen}
        department={department}
        onWorkspaceChange={switchDepartment} />
      <div tabIndex={-1} className={`main-content ${area === 'dashboard' || area === 'restaurant-dashboard' || area === 'front-desk-dashboard' ? 'dashboard-motion' : ''}`}>
        {page}
      </div>
    </main>
    <GlobalSearch
      go={go}
      items={department === 'restaurant' ? restaurantNav.filter(item => item.enabled).map(item => ({ area: item.area as AppRoute, label: item.label })) : department === 'front-desk' ? frontDeskNav.filter(item => item.enabled).map(item => ({ area: item.area as AppRoute, label: item.label })) : undefined}
      isOpen={searchOpen}
      onClose={() => setSearchOpen(false)} />
    {workspaceTransition && <WorkspaceTransitionOverlay key={workspaceTransition.id} destination={workspaceTransition.destination} />}
  </div>
}
