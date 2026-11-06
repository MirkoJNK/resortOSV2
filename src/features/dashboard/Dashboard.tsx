import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  CalendarDays,
  Check,
  CreditCard,
  FileText,
  Headphones,
  Settings2,
  ShieldCheck,
  Sun,
  Users,
} from 'lucide-react'
import type { Area, Store } from '../../domain/types'
import { php, todayPayments } from '../../domain/store'
import { PanelHeader, StatIcon } from '../../components/Ui'
import { Bars, PaymentLine, ProgressBar, RoleDistribution } from '../../components/Charts'
import { getSupportCounts } from '../../components/SupportWorkspace'
import type { SampleTicket } from '../../components/SupportWorkspace'

const niceTime = (iso: string) => {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  return min < 60 ? `${min}m ago` : min < 1440 ? `${Math.floor(min / 60)}h ago` : `${Math.floor(min / 1440)}d ago`
}
const initial = (name: string) => name.trim().split(/\s+/).filter(Boolean).map(x => x[0]).join('').slice(0, 2).toUpperCase() || '?'

function ResortArt() {
  return <section
    className="resort-art motion-reveal motion-order-1"
    aria-label="Resort illustration">
    <div className="art-shore" />
    <div className="art-arch" />
    <div className="art-copy">Operations<br />power<br />unforgettable<br />stays<span className="art-underline" /></div>
    <div
      className="weather"
      title="Illustrative weather — not a live forecast"
      aria-label="Illustrative weather, not a live forecast">
      <Sun
        size={29}
        strokeWidth={1.8} />
      <div>
        <strong>28°C</strong>
        <small>Oceanview Resort</small>
      </div>
    </div>
  </section>
}
function DayMeta() {
  return <div className="day-meta">
    <span>
      <CalendarDays size={15} />
      {new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })}
    </span>
    <span className="meta-divider" />
    <span title="Illustrative weather — not a live forecast"><Sun
      size={17}
      className="sun-icon" />28°C</span>
    <span>Oceanview Resort</span>
  </div>
}

/** The dashboard shortcuts are navigation, not a selection control
 *  They stay neutral until hover, keyboard focus, or a brief click confirmation
 */
const administrationShortcuts: { icon: LucideIcon; label: string; area: Area }[] = [
  { icon: Headphones, label: 'Support & Issues', area: 'support' },
  { icon: FileText, label: 'Audit Log', area: 'audit' },
  { icon: Settings2, label: 'System Management', area: 'systems' }
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

function InformationalPanelHeader({ icon, title, tone }: {
  icon: LucideIcon
  title: string
  tone?: 'lime' | 'blue' | 'mint' | 'rose'
}) {
  return <div className="panel-head"><StatIcon icon={icon} tone={tone} /><h2>{title}</h2></div>
}

export function Dashboard({ store, tickets, go }: { store: Store; tickets: SampleTicket[]; go: (a: Area) => void }) {
  const { unresolved: open, urgentOpen: urgent } = getSupportCounts(tickets)
  const employees = store.employees.filter(x => x.enabled)
  const total = todayPayments(store)
  const groups = [
    ['Front Office', '#a5db1a'],
    ['Housekeeping', '#b3df36'],
    ['Food & Beverage', '#bee65b'],
    ['Maintenance', '#cbec7e'],
    ['Management', '#d6ed9b']
  ] as const
  const largestDepartment = Math.max(1, ...groups.map(([name]) => employees.filter(e => e.department === name).length))
  const roles = [
    { label: 'Administrators', value: employees.filter(e => /admin/i.test(e.role)).length, color: '#355c43' },
    { label: 'Managers', value: employees.filter(e => /^manager$/i.test(e.role)).length, color: '#a4dc1d' },
    { label: 'Supervisors', value: employees.filter(e => /supervisor/i.test(e.role)).length, color: '#c9efc6' },
    { label: 'Staff', value: employees.filter(e => !/admin|manager|supervisor/i.test(e.role)).length, color: '#d7d9db' }
  ]
  const approvedHeading = urgent > 0 ? 'Your resort needs your attention' : open > 0 || store.approvals.length > 0 ? 'Your resort at a glance' : 'Your resort is running smoothly'
  return <>
    <div className="overview-top">
      <div className="overview-left">
        <div className="welcome motion-reveal motion-order-0">
          <p>Good morning,</p>
          <h1>
            {approvedHeading}
          </h1>
          <DayMeta />
        </div>
        <div className="top-stats">
          <article className="panel ticket-panel motion-reveal motion-order-2">
            <PanelHeader
              icon={Headphones}
              title="Unresolved support tickets"
              onOpen={() => go('support')}
              actionLabel="Open Support & Issues" />
            <div className="stat-main">
              <b>
                {open}
              </b>
              {urgent > 0 ? <span className="delta red">{urgent} urgent</span> : <span className="delta green">
                {open === 0 ? 'All caught up' : 'No urgent issues'}
              </span>}
            </div>
            {open > 0 ? <Bars
              values={[
                72,
                53,
                48,
                31,
                40,
                54,
                36,
                27,
                63,
                77,
                92,
                81
              ]}
              labels={[
                'Oct 22',
                'Oct 23',
                'Oct 24',
                'Oct 25',
                'Oct 26',
                'Today'
              ]} /> : <div className="chart-empty-state">
              <Check size={20} />
              <span>No unresolved tickets</span>
            </div>}
          </article>
          <article className="panel payments-panel motion-reveal motion-order-3">
            <InformationalPanelHeader
              icon={CreditCard}
              title="Today's payments"
              tone="blue" />
            <div className="stat-main payments-total">
              <b>
                {php(total)}
              </b>
            </div>
            {total > 0 ? <PaymentLine /> : <div className="chart-empty-state">
              <CreditCard size={20} />
              <span>No payments recorded today</span>
            </div>}
          </article>
        </div>
      </div>
      <ResortArt />
    </div>
    <div className="cards-row">
      <article className="panel employees-panel motion-reveal motion-order-4">
        <InformationalPanelHeader
          icon={Users}
          title="Active employees" />
        <div className="stat-main">
          <b>
            {employees.length}
          </b>
        </div>
        {employees.length > 0 ? <div className="avatar-stack">
          {employees.slice(0, 4).map(x => <span
            key={x.id}
            className="mini-avatar"
            style={{ background: x.color }}
            title={x.name}
            aria-label={x.name}>
            {initial(x.name)}
          </span>)}
          {employees.length > 4 && <span className="mini-avatar more">+{employees.length - 4}</span>}
        </div> : <p className="dashboard-empty-message">No active employees yet</p>}
        <div className="dept-bars">
          {groups.map(([dep, color]) => {
            const count = employees.filter(x => x.department === dep).length
            return <div
              className="dept-row"
              key={dep}>
              <span>
                {dep}
              </span>
              <b>
                {count}
              </b>
              <ProgressBar
                label={`${dep} staffing comparison`}
                value={count}
                max={largestDepartment}
                color={color} />
            </div>
          })}
        </div>
      </article>
      <article className="panel approvals-panel motion-reveal motion-order-5">
        <InformationalPanelHeader
          icon={FileText}
          title="Pending approvals"
          tone="blue" />
        <div className="stat-main">
          <b>
            {store.approvals.length}
          </b>
        </div>
        <div className="approvals-list">
          {store.approvals.length === 0 ? <div className="dashboard-empty-message">No pending approvals</div> : store.approvals.slice(0, 5).map((a, i) => <div
            className="approval-row"
            key={a.id}>
            <span className={`mini-activity ${a.tone}`}>
              {[
                <Users size={16} />,
                <FileText size={16} />,
                <Settings2 size={16} />,
                <CreditCard size={16} />,
                <Building2 size={16} />
              ][i]}
            </span>
            <div title={`${a.title} — ${a.detail}`}>
              <strong>
                {a.title}
              </strong>
              <small>
                {a.detail}
              </small>
            </div>
            <time>
              {a.ago}
            </time>
          </div>)}
        </div>
      </article>
      <article className="panel access-panel motion-reveal motion-order-6">
        <InformationalPanelHeader
          icon={ShieldCheck}
          title="Roles & access" />
        <div className="access-metric">
          <b>
            {roles.reduce((sum, role) => sum + role.value, 0)}
          </b>
        </div>
        {employees.length > 0 ? <RoleDistribution items={roles} /> : <div className="dashboard-empty-message">No active role assignments</div>}
        <div className="access-types">
          {roles.map(({ label, value, color }) => <div key={label}>
            <i style={{ background: color }} />
            {label}
            <strong>
              {value}
            </strong>
          </div>)}
        </div>
        <div
          className="access-leaves"
          aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </article>
    </div>
    <div className="bottom-row">
      <article className="panel audit-panel motion-reveal motion-order-7">
        <PanelHeader
          icon={FileText}
          title="Recent audit events"
          onOpen={() => go('audit')}
          actionLabel="Open Audit Log" />
        <div className="audit-lines">
          {store.events.length === 0 ? <div className="dashboard-empty-message">No recent audit activity</div> : store.events.slice(0, 5).map((e, i) => <div
            key={e.id}
            className="audit-line">
            <span
              className="audit-avatar"
              style={{
background: [
                  '#f7c9b4',
                  '#c1def0',
                  '#e4defa',
                  '#dfedd2',
                  '#f6e7a7'
                ][i % 5]
}}>
              {initial(e.author)}
            </span>
            <strong title={e.author}>
              {e.author}
            </strong>
            <span
              className="audit-action"
              title={e.action}>
              {e.action}
            </span>
            <em className={`category-pill ${e.tone}`}>
              {e.category}
            </em>
            <time>
              {niceTime(e.created)}
            </time>
          </div>)}
        </div>
      </article>
      <AdministrationShortcuts go={go} />
    </div>
  </>
}
