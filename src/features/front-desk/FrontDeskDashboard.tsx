import { useEffect, useRef, useState } from 'react'
import { BedDouble, ClipboardList, CreditCard, LogOut, ReceiptText, Settings2, Wallet } from 'lucide-react'
import { loadOperations } from '../restaurant-tables/storage'
import type { Operations } from '../restaurant-tables/model'
import { checkoutDashboardMetrics } from './dashboardMetrics'
import { formatPrice } from '../menu-management/model'
import type { AppRoute } from '../../shell/navigation'
import { checkoutCollectionsByDay, openChargeAmountsBySource } from '../dashboard/chartSelectors'
import { DashboardHero, DashboardGreeting, DashboardKpi, DashboardChart, DashboardMiniMetric, DashboardActivity } from '../dashboard/DashboardVisuals'

/** Compact approximate tick for narrow columns; accessible title retains the exact PHP amount. */
function shortPeso(cents: number): string {
  if (cents < 100000) return formatPrice(cents)
  const pesos = cents / 100
  return `₱${(pesos / 1000).toFixed(pesos < 10000 ? 1 : 0)}k`
}

export const frontDeskDashboardSources = {
  outstandingCharges: 'operational-demo', checkoutCollections: 'checkout-records-demo',
  pendingCheckouts: 'active-guest-stays', outstandingBalances: 'operational-demo',
  activity: 'checkout-records-demo', rooms: 'admin-rooms-configuration-only'
} as const

const frontDeskShortcuts = [
  { icon: BedDouble, label: 'Rooms', route: 'front-desk-rooms' as AppRoute },
  { icon: ReceiptText, label: 'Charges', route: 'front-desk-charges' as AppRoute },
  { icon: LogOut, label: 'Checkout', route: 'front-desk-checkout' as AppRoute }
] as const
function FrontDeskShortcuts({ go }: { go: (route: AppRoute) => void }) {
  const [pressed, setPressed] = useState<AppRoute | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timeout.current !== null) clearTimeout(timeout.current) }, [])
  const navigate = (route: AppRoute) => {
    if (pressed !== null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {go(route); return}
    setPressed(route)
    timeout.current = setTimeout(() => go(route), 125)
  }
  return <article className="systems-panel motion-reveal motion-order-8">
    <div className="systems-head"><span className="systems-icon"><Settings2 size={18} /></span><h2>Front Desk Shortcuts</h2></div>
    <div className="system-actions navigation-shortcuts">
      {frontDeskShortcuts.map(({ icon: Icon, label, route }) => <button key={label} type="button"
        disabled={!route || (pressed !== null && pressed !== route)}
        className={pressed === route && route ? 'shortcut-pressed' : ''}
        aria-label={route ? label : `${label} — not yet available`}
        title={route ? label : 'Not yet available'} onClick={route ? () => navigate(route) : undefined}>
        <Icon size={21} /><span>{label}</span>
      </button>)}
    </div>
    <div className="systems-footer-space" aria-hidden="true" />
  </article>
}

/** Shared dashboard family; money is display-only and derived from immutable demo records. */
export function FrontDeskDashboard({ go }: { go: (route: AppRoute) => void }) {
  const [operations, setOperations] = useState<Operations | null>(null)
  const metrics = operations ? checkoutDashboardMetrics(operations) : null
  useEffect(() => {
    let live = true, generation = 0
    const refresh = () => {
      const ticket = ++generation
      void loadOperations().then(value=>{if(live && ticket===generation)setOperations(value)})
        .catch(()=>{if(live && ticket===generation)setOperations(null)})
    }
    refresh()
    window.addEventListener('focus',refresh)
    window.addEventListener('restaurant-operations-changed',refresh)
    return ()=>{live=false;window.removeEventListener('focus',refresh);window.removeEventListener('restaurant-operations-changed',refresh)}
  },[])
  const dailyCollections = operations ? checkoutCollectionsByDay(operations) : null
  const chargeSources = operations ? openChargeAmountsBySource(operations) : null
  return <div className="restaurant-dashboard front-desk-dashboard ros-dashboard-v2" data-department="front-desk">
    <div className="overview-top">
      <div className="overview-left">
        <DashboardGreeting employee="Employee" />
        <div className="top-stats">
          <DashboardKpi icon={ReceiptText} title="Outstanding room charges" value={metrics?.openChargeCount ?? '—'}
            note={metrics ? `${formatPrice(metrics.outstandingCentavos)} outstanding (Demo)` : 'Charge records unavailable'} order={2}
            open={{label:'Open Front Desk Charges',action:()=>go('front-desk-charges')}} />
          <DashboardKpi icon={CreditCard} title="Today's checkout collections (Demo)"
            value={metrics ? formatPrice(metrics.todayCheckoutCollectionsCentavos) : '—'}
            note="Checkout settlements only" tone="blue" order={3} />
        </div>
      </div>
      <DashboardHero />
    </div>
    <section className="ros-analytics" aria-label="Front Desk operational charts">
      <DashboardChart title="Checkout collections (Demo)" context="Last 7 days, Manila time" series={dailyCollections} kind="columns" order={4}
        formatValue={formatPrice} formatTick={shortPeso} footer="Settled at checkout only; cash change and previous payments excluded" />
      <DashboardChart title="Outstanding charges by source (Demo)" context="Open current-stay balances" series={chargeSources} kind="bars" order={5}
        formatValue={formatPrice} />
    </section>
    <div className="cards-row ros-metric-strip motion-reveal motion-order-6">
      <DashboardMiniMetric icon={BedDouble} label="Occupied rooms" value={metrics?.occupiedRoomCount ?? '—'} note="Current guest stays" />
      <DashboardMiniMetric icon={ClipboardList} label="Pending checkouts" value={metrics?.pendingCheckoutCount ?? '—'} note="Expected today or earlier" />
      <DashboardMiniMetric icon={Wallet} label="Rooms with outstanding balances" value={metrics?.roomBalanceCount ?? '—'} note="Current stay balances (Demo)" />
    </div>
    <div className="bottom-row">
      <DashboardActivity title="Recent Front Desk activity">
        {metrics?.recentActivity.length ? metrics.recentActivity.map(event=><div key={event.id} className="ros-activity-line"><span>{event.label}</span><time>{new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(event.recordedAt))}</time></div>)
          : <div className="dashboard-empty-message">{metrics ? 'No Front Desk activity recorded' : 'Front Desk activity unavailable'}</div>}
      </DashboardActivity>
      <FrontDeskShortcuts go={go} />
    </div>
  </div>
}
