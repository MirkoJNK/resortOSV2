import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { BedDouble, ClipboardList, CreditCard, FileText, Headphones, ReceiptText, Settings2 } from 'lucide-react'
import type { Area, Store } from '../../domain/types'
import { getSupportCounts } from '../../components/SupportWorkspace'
import type { SampleTicket } from '../../components/SupportWorkspace'
import type { Operations } from '../restaurant-tables/model'
import { loadOperations } from '../restaurant-tables/storage'
import { checkoutDashboardMetrics } from '../front-desk/dashboardMetrics'
import { formatPrice } from '../menu-management/model'
import { readServices, STORAGE_KEY as SERVICES_STORAGE_KEY } from '../service-catalog/model'
import { DashboardHero, DashboardGreeting, DashboardKpi, DashboardChart, DashboardMiniMetric, DashboardActivity } from './DashboardVisuals'
import { supportStatusBreakdown, supportPriorityBreakdown } from './chartSelectors'

/** No saved configuration is unavailable, never an invented active-service count. */
function configuredActiveServices(): number | null {
  try {
    if (localStorage.getItem(SERVICES_STORAGE_KEY) === null) return null
    const source = readServices()
    if (source.error || !source.recoverable) return null
    return source.data.services.filter(service => service.status === 'active').length
  } catch { return null }
}

const administrationShortcuts: { icon: LucideIcon; label: string; area: Area }[] = [
  { icon: Settings2, label: 'System Management', area: 'systems' },
  { icon: FileText, label: 'Audit Log', area: 'audit' },
  { icon: Headphones, label: 'Support & Issues', area: 'support' }
]
function AdministrationShortcuts({ go }: { go: (area: Area) => void }) {
  const [pressed, setPressed] = useState<Area | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timeout.current !== null) clearTimeout(timeout.current) }, [])
  const navigate = (area: Area) => {
    if (pressed !== null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { go(area); return }
    setPressed(area)
    timeout.current = setTimeout(() => go(area), 125)
  }
  return <article className="systems-panel motion-reveal motion-order-8">
    <div className="systems-head">
      <span className="systems-icon"><Settings2 size={18} /></span>
      <h2>Administration shortcuts</h2>
    </div>
    <div className="system-actions navigation-shortcuts">
      {administrationShortcuts.map(({ icon: Icon, label, area }) => <button
        key={area}
        type="button"
        className={pressed === area ? 'is-pressed' : ''}
        onClick={() => navigate(area)}>
        <Icon size={21} />
        <span>
          {label}
        </span>
      </button>)}
    </div>
    <div className="systems-footer-space" aria-hidden="true" />
  </article>
}

/** Shared dashboard layout; administrative metrics are current demo snapshots, not invented time series. */
export function Dashboard({ tickets, go }: { store: Store; tickets: SampleTicket[]; go: (a: Area) => void }) {
  const { unresolved: open, urgentOpen: urgent } = getSupportCounts(tickets)
  const [operations, setOperations] = useState<Operations | null>(null)
  const [activeServices, setActiveServices] = useState<number | null>(configuredActiveServices)
  useEffect(() => {
    let live = true, generation = 0
    const refresh = () => {
      const ticket = ++generation
      setActiveServices(configuredActiveServices())
      void loadOperations().then(next => {if (live && ticket===generation) setOperations(next)})
        .catch(() => {if (live && ticket===generation) setOperations(null)})
    }
    const storage = (event: StorageEvent) => {if (event.key === SERVICES_STORAGE_KEY) refresh()}
    refresh()
    window.addEventListener('focus',refresh)
    window.addEventListener('storage',storage)
    window.addEventListener('restaurant-operations-changed',refresh)
    return () => {live=false; window.removeEventListener('focus',refresh);window.removeEventListener('storage',storage);window.removeEventListener('restaurant-operations-changed',refresh)}
  }, [])
  const metrics = operations ? checkoutDashboardMetrics(operations) : null
  const statuses = supportStatusBreakdown(tickets)
  const priorities = supportPriorityBreakdown(tickets)
  return <div className="ros-dashboard-v2" data-department="admin">
    <div className="overview-top">
      <div className="overview-left">
        <DashboardGreeting employee="Admin" />
        <div className="top-stats">
          <DashboardKpi icon={Headphones} title="Unresolved support tickets (Demo)" value={open}
            note={urgent > 0 ? `${urgent} urgent tickets` : 'Current employee tickets'} order={2}
            open={{label:'Open Support & Issues',action:()=>go('support')}} />
          <DashboardKpi icon={CreditCard} title="Outstanding room balance (Demo)"
            value={metrics ? formatPrice(metrics.outstandingCentavos) : '—'}
            note={metrics ? `${metrics.openChargeCount} open charges` : 'Charge records unavailable'} tone="blue" order={3} />
        </div>
      </div>
      <DashboardHero />
    </div>
    <section className="ros-analytics" aria-label="Administration operational charts">
      <DashboardChart title="Support ticket status" context="Current snapshot (Demo)" series={statuses} kind="bars" order={4} />
      <DashboardChart title="Open tickets by priority" context="Excludes closed tickets (Demo)" series={priorities} kind="bars" order={5} />
    </section>
    <div className="cards-row ros-metric-strip motion-reveal motion-order-6">
      <DashboardMiniMetric icon={BedDouble} label="Occupied rooms" value={metrics?.occupiedRoomCount ?? '—'} note="Active guest stays" />
      <DashboardMiniMetric icon={ClipboardList} label="Checkouts requiring attention" value={metrics?.pendingCheckoutCount ?? '—'} note="Expected today or earlier" />
      <DashboardMiniMetric icon={ReceiptText} label="Active services" value={activeServices ?? '—'} note={activeServices === null ? 'Saved catalog unavailable' : 'Saved Service Catalog'} />
    </div>
    <div className="bottom-row">
      <DashboardActivity title="Recent operational activity (Demo)">
        {metrics?.recentActivity.length ? metrics.recentActivity.map(event=><div key={event.id} className="ros-activity-line"><span>{event.label}</span><time>{new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(event.recordedAt))}</time></div>)
          : <div className="dashboard-empty-message">{metrics ? 'No recorded operational activity' : 'Operational records unavailable'}</div>}
      </DashboardActivity>
      <AdministrationShortcuts go={go} />
    </div>
  </div>
}
