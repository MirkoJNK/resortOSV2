import { useEffect, useRef, useState } from 'react'
import type { AppRoute } from '../../shell/navigation'
import { ClipboardList, CreditCard, FileClock, Settings2, UtensilsCrossed } from 'lucide-react'
import { loadOperations } from '../restaurant-tables/storage'
import type { Operations } from '../restaurant-tables/model'
import { readTables, STORAGE_KEY as TABLES_STORAGE_KEY } from '../tables-manager/model'
import { formatPrice } from '../menu-management/model'
import { restaurantDashboardMetrics } from './dashboardMetrics'
import type { FinanceConfig } from '../discount-management/model'
import { loadFinanceConfig, FINANCE_CHANGED_EVENT } from '../discount-management/storage'
import { recordedOrdersByDay, currentRestaurantOrderBreakdown } from '../dashboard/chartSelectors'
import { DashboardHero, DashboardGreeting, DashboardKpi, DashboardChart, DashboardMiniMetric, DashboardActivity } from '../dashboard/DashboardVisuals'

/** Actual Restaurant operations in the browser-local demonstration. */
export const restaurantDashboardSources = {
  orders: 'operational-demo', roomPostings: 'operational-demo', liveTables: 'operational-demo',
  exceptions: 'reservations', activity: 'operational-demo'
} as const

const shortcuts = [
  { icon: UtensilsCrossed, label: 'Tables', route: 'restaurant-tables' as AppRoute },
  { icon: ClipboardList, label: 'Orders', route: 'restaurant-orders' as AppRoute }
]
function RestaurantShortcuts({ go }: { go: (area: AppRoute) => void }) {
  const [pressed, setPressed] = useState<AppRoute | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timeout.current !== null) clearTimeout(timeout.current) }, [])
  const navigate = (route: AppRoute) => {
    if (pressed !== null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { go(route); return }
    setPressed(route)
    timeout.current = setTimeout(() => go(route), 125)
  }
  return <article className="systems-panel motion-reveal motion-order-8">
    <div className="systems-head"><span className="systems-icon"><Settings2 size={18} /></span><h2>Restaurant Shortcuts</h2></div>
    <div className="system-actions navigation-shortcuts ros-restaurant-shortcuts">
      {shortcuts.map(({icon: Icon,label,route}) => <button
        key={label}
        type="button"
        className={pressed === route && route ? 'is-pressed' : ''}
        onClick={route ? () => navigate(route) : undefined}
        disabled={!route}
        aria-label={route ? label : `${label} — not yet available`}
        title={route ? undefined : 'Not yet available'}>
        <Icon size={21} /><span>{label}</span>
      </button>)}
    </div>
    <div className="systems-footer-space" aria-hidden="true" />
  </article>
}

export function RestaurantDashboard({ go }: { go: (area: AppRoute) => void }) {
  const [ops, setOps] = useState<Operations | null>(null)
  const [finance,setFinance] = useState<FinanceConfig|null>(null)
  const [tables, setTables] = useState<ReturnType<typeof readTables> | null>(null)
  useEffect(() => {
    let live = true, generation = 0
    const refresh = () => {
      const ticket = ++generation
      setTables(readTables())
      void Promise.all([loadOperations(),loadFinanceConfig()]).then(([next,policy]) => {if(live && ticket===generation){setOps(next);setFinance(policy)}})
        .catch(()=>{if(live && ticket===generation)setOps(null)})
    }
    const storage = (event:StorageEvent) => {if(event.key===TABLES_STORAGE_KEY)refresh()}
    refresh()
    window.addEventListener('focus',refresh)
    window.addEventListener('restaurant-operations-changed',refresh)
    window.addEventListener(FINANCE_CHANGED_EVENT,refresh)
    window.addEventListener('storage',storage)
    return ()=>{live=false;window.removeEventListener('focus',refresh);window.removeEventListener('restaurant-operations-changed',refresh);window.removeEventListener(FINANCE_CHANGED_EVENT,refresh);window.removeEventListener('storage',storage)}
  },[])
  const metrics = ops && tables && !tables.error && finance ? restaurantDashboardMetrics(ops,tables.data.tables,new Date(),finance) : null
  const dailyOrders = ops ? recordedOrdersByDay(ops) : null
  const orderStatus = metrics ? currentRestaurantOrderBreakdown(metrics.ordersRequiringAction,metrics.readyToPay) : null
  return <div className="restaurant-dashboard ros-dashboard-v2" data-department="restaurant">
    <div className="overview-top">
      <div className="overview-left">
        <DashboardGreeting employee="Employee" />
        <div className="top-stats">
          <DashboardKpi icon={ClipboardList} title="Orders requiring action" value={metrics?.ordersRequiringAction ?? '—'}
            note={metrics ? `${metrics.readyToPay} ready to pay` : 'Order data unavailable'} order={2}
            open={{label:'Open Restaurant Orders',action:()=>go('restaurant-orders')}} />
          <DashboardKpi icon={CreditCard} title="Room charges posted today (Demo)"
            value={metrics ? formatPrice(metrics.postedCentavos) : '—'}
            note={metrics ? `${metrics.roomPostingsToday} room postings today` : 'Room postings unavailable'} tone="blue" order={3} />
        </div>
      </div>
      <DashboardHero />
    </div>
    <section className="ros-analytics" aria-label="Restaurant operational charts">
      <DashboardChart title="Recorded orders" context="Last 7 days, Manila time" series={dailyOrders} kind="columns" order={4}
        footer="Recorded orders count once, including those later canceled" />
      <DashboardChart title="Current order status" context="Active dining sessions" series={orderStatus} kind="bars" order={5} />
    </section>
    <div className="cards-row ros-metric-strip motion-reveal motion-order-6">
      <DashboardMiniMetric icon={UtensilsCrossed} label="Tables in service" value={metrics?.tablesInService ?? '—'} note="Active dining sessions" />
      <DashboardMiniMetric icon={FileClock} label="Upcoming reservations" value={metrics?.upcomingReservations ?? '—'} note="Next 24 hours" />
      <DashboardMiniMetric icon={ClipboardList} label="Ready to Pay" value={metrics?.readyToPay ?? '—'} note="Awaiting staff action" />
    </div>
    <div className="bottom-row">
      <DashboardActivity title="Recent restaurant activity">
        {metrics?.recentActivity.length ? metrics.recentActivity.map(event=><div key={event.id} className="ros-activity-line"><span>{event.label}</span><time>{new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(event.date))}</time></div>)
          : <div className="dashboard-empty-message">{metrics ? 'No recorded restaurant activity' : 'Restaurant activity unavailable'}</div>}
      </DashboardActivity>
      <RestaurantShortcuts go={go} />
    </div>
  </div>
}
