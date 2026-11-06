import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileClock,
  Headphones,
  ListChecks,
  Settings2,
  Sun,
  UtensilsCrossed,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { StatIcon } from '../../components/Ui'

/** Read-only departmental view: no operational store exists yet. */
export const restaurantDashboardSources = {
  orders: 'not-implemented',
  roomPostings: 'not-implemented',
  liveTables: 'not-implemented',
  exceptions: 'not-implemented',
  activity: 'not-implemented',
} as const

function DayMeta() {
  return <div className="day-meta">
    <span>
      <CalendarDays size={15} />
      {new Date().toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
      })}
    </span>
    <span className="meta-divider" />
    <span title="Illustrative weather — not a live forecast"><Sun size={17} className="sun-icon" />28°C</span>
    <span>Oceanview Resort</span>
  </div>
}

/** Identical markup, artwork paths, and classes as Admin's approved hero. */
function ResortArt() {
  return <section className="resort-art motion-reveal motion-order-1" aria-label="Resort illustration">
    <div className="art-shore" />
    <div className="art-arch" />
    <div className="art-copy">Operations<br />power<br />unforgettable<br />stays<span className="art-underline" /></div>
    <div className="weather" title="Illustrative weather — not a live forecast" aria-label="Illustrative weather, not a live forecast">
      <Sun size={29} strokeWidth={1.8} />
      <div><strong>28°C</strong><small>Oceanview Resort</small></div>
    </div>
  </section>
}

function InformationalPanelHeader({ icon, title, tone }: { icon: LucideIcon; title: string; tone?: 'lime' | 'blue' }) {
  return <div className="panel-head"><StatIcon icon={icon} tone={tone} /><h2>{title}</h2></div>
}
function Unavailable({ children }: { children: string }) {
  return <div className="restaurant-data-unavailable" role="status"><FileClock size={18} aria-hidden="true" /><span>{children}</span></div>
}

/** One inaccessible-in-production destination is never represented as a working link. */
const shortcuts = [
  { icon: UtensilsCrossed, label: 'Tables' },
  { icon: ClipboardList, label: 'Orders' },
  { icon: Headphones, label: 'Support & Issues' },
]
function RestaurantShortcuts() {
  return <article className="systems-panel motion-reveal motion-order-8">
    <div className="systems-head"><span className="systems-icon"><Settings2 size={18} /></span><h2>Restaurant Shortcuts</h2></div>
    <div className="system-actions navigation-shortcuts">
      {shortcuts.map(({icon: Icon,label}) => <button
        key={label}
        type="button"
        disabled
        aria-label={`${label} — not yet available`}
        title="Not yet available">
        <Icon size={21} /><span>{label}</span>
      </button>)}
    </div>
    <div className="systems-footer-space" aria-hidden="true" />
  </article>
}

export function RestaurantDashboard() {
  return <div className="restaurant-dashboard" data-department="restaurant">
    <div className="overview-top">
      <div className="overview-left">
        <div className="welcome motion-reveal motion-order-0">
          <p>Good morning,</p>
          <h1>Your restaurant at a glance</h1>
          <DayMeta />
        </div>
        <div className="top-stats">
          <article className="panel ticket-panel motion-reveal motion-order-2">
            <div className="panel-head">
              <StatIcon icon={ClipboardList} />
              <h2>Orders requiring action</h2>
              <button type="button" className="circle-action" disabled aria-label="Orders not yet available" title="Orders not yet available"><ArrowRight size={16} /></button>
            </div>
            <div className="stat-main"><b aria-label="Orders data unavailable">—</b></div>
            <div className="restaurant-chart-placeholder"><Unavailable>Order data not available yet</Unavailable></div>
          </article>
          <article className="panel payments-panel motion-reveal motion-order-3">
            <InformationalPanelHeader icon={CreditCard} title="Room charges posted today" tone="blue" />
            <div className="stat-main payments-total"><b aria-label="Room-charge data unavailable">—</b></div>
            <div className="restaurant-chart-placeholder"><Unavailable>Room postings not available yet</Unavailable></div>
          </article>
        </div>
      </div>
      <ResortArt />
    </div>
    <div className="cards-row">
      <article className="panel employees-panel motion-reveal motion-order-4">
        <InformationalPanelHeader icon={ListChecks} title="Order status overview" />
        <div className="stat-main"><b aria-label="Order-status data unavailable">—</b></div>
        <div className="restaurant-middle-empty"><Unavailable>Order stages not available yet</Unavailable></div>
      </article>
      <article className="panel approvals-panel motion-reveal motion-order-5">
        <InformationalPanelHeader icon={FileClock} title="Needs attention" tone="blue" />
        <div className="stat-main"><b aria-label="Operational exceptions unavailable">—</b></div>
        <div className="approvals-list restaurant-middle-empty"><Unavailable>Restaurant alerts not available yet</Unavailable></div>
      </article>
      <article className="panel access-panel motion-reveal motion-order-6">
        <InformationalPanelHeader icon={UtensilsCrossed} title="Tables in service" />
        <div className="access-metric"><b aria-label="Table activity unavailable">—</b></div>
        <div className="restaurant-middle-empty"><Unavailable>Live table activity not available yet</Unavailable></div>
        <div className="access-leaves" aria-hidden="true"><span /><span /><span /><span /></div>
      </article>
    </div>
    <div className="bottom-row">
      <article className="panel audit-panel motion-reveal motion-order-7">
        <div className="panel-head">
          <StatIcon icon={FileClock} />
          <h2>Recent restaurant activity</h2>
          <button type="button" className="circle-action" disabled aria-label="Restaurant activity not yet available" title="Restaurant activity not yet available"><ArrowRight size={16} /></button>
        </div>
        <div className="audit-lines restaurant-activity-empty"><Unavailable>Restaurant activity not available yet</Unavailable></div>
      </article>
      <RestaurantShortcuts />
    </div>
  </div>
}
