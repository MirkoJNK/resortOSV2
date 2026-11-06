import { useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CircleHelp,
  CreditCard,
  Download,
  FileClock,
  FileText,
  Headphones,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Users,
  X
} from 'lucide-react'
import type { Area, Store } from './domain/types'
import { loadStore, php, resetStore, todayPayments } from './domain/store'
import { PanelHeader, StatIcon } from './components/Ui'
import { Bars, PaymentLine, ProgressBar, RoleDistribution } from './components/Charts'
import { qualityScenario, qualityStore, qualitySupportTickets } from './data/qualityFixtures'
import { SupportWorkspace, createSupportTickets, getSupportCounts } from './components/SupportWorkspace'
import type { SampleTicket } from './components/SupportWorkspace'

/** One navigation list powers both the sidebar and global pages-only search. */
const primaryNav: { area: Area; label: string; iconAsset: string }[] = [
  { area: 'dashboard', label: 'Dashboard', iconAsset: '/assets/sidebar-icon-dashboard-approved-v058.png' },
  { area: 'support', label: 'Support & Issues', iconAsset: '/assets/sidebar-icon-support-approved-v058.png' },
  { area: 'audit', label: 'Audit Log', iconAsset: '/assets/sidebar-icon-audit-approved-v058.png' },
  { area: 'systems', label: 'System Management', iconAsset: '/assets/sidebar-icon-systems-approved-v058.png' }
]
const allNav = primaryNav
const isArea = (v: string): v is Area => allNav.some(x => x.area === v)
const routeFromHash = (): Area => {
  const h = location.hash.replace(/^#\/?/, '')
  return isArea(h) ? h : 'dashboard'
}
const niceTime = (iso: string) => {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  return min < 60 ? `${min}m ago` : min < 1440 ? `${Math.floor(min / 60)}h ago` : `${Math.floor(min / 1440)}d ago`
}
const initial = (name: string) => name.trim().split(/\s+/).filter(Boolean).map(x => x[0]).join('').slice(0, 2).toUpperCase() || '?'

function Logo() {
  return <div className="brand ros-light-brand">
    <img
      className="ros-full-brandmark"
      src="/assets/sidebar-brand-approved-v058.png"
      alt="resortOS" />
  </div>
}
function Sidebar({ area, onNavigate, menuOpen, onClose }: {
  area: Area
  onNavigate: (a: Area) => void
  menuOpen: boolean
  onClose: () => void
}) {
  const navItem = (item: typeof primaryNav[number]) => <button
    key={item.area}
    className={`side-link ${area === item.area ? 'active' : ''}`}
    aria-current={area === item.area ? 'page' : undefined}
    type="button"
    onClick={() => {
      onNavigate(item.area)
      onClose()
    }}>
    <img
      className="ros-sidebar-nav-icon"
      src={item.iconAsset}
      alt=""
      aria-hidden="true" />
    <span>
      {item.label}
    </span>
  </button>
  return <>
    <div className={`mobile-shade ${menuOpen ? 'visible' : ''}`} onClick={onClose} />
    <aside
      className={`sidebar ros-light-sidebar ${menuOpen ? 'open' : ''}`}
      id="resortos-nav">
      <Logo />
      <nav
        className="nav-stack"
        aria-label="Main navigation">
        {primaryNav.map(navItem)}
      </nav>
      <div
        className="side-bottom ros-coastal-bottom"
        aria-hidden="true">
        <img
          src="/assets/sidebar-coastal-approved-v058.png"
          alt="" />
      </div>
    </aside>
  </>
}
function Header({ onSearch, onMenu, menuOpen }: { onSearch: () => void; onMenu: () => void; menuOpen: boolean }) {
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
    <button
      className="global-search"
      onClick={onSearch}>
      <Search size={17} />
      <span>Search pages</span>
      <kbd>Ctrl K</kbd>
    </button>
    <button
      type="button"
      className="header-circle notification"
      title="Notifications are not available yet"
      aria-label="Notifications unavailable"
      disabled>
      <Bell size={17} />
    </button>
    <button
      type="button"
      className="header-circle"
      title="Help is not available yet"
      aria-label="Help unavailable"
      disabled>
      <CircleHelp size={18} />
    </button>
    <div
      className="user-select"
      aria-label="Current account: Demo Administrator">Demo Administrator</div>
  </header>
}
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

function Dashboard({ store, tickets, go }: { store: Store; tickets: SampleTicket[]; go: (a: Area) => void }) {
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
function SectionHeader({ title, subtitle, action }: {
  title: string
  subtitle: string
  action?: React.ReactNode
}) {
  return <div className="section-header">
    <div>
      <p>Administration</p>
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
function SystemsPage({ store, reset }: { store: Store; reset: () => void }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'resortOS2-demo-export.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 500)
  }
  return <>
    <SectionHeader title="System Management" subtitle="Workspace tools and migration status" />
    <div className="panel system-info">
      <StatIcon icon={Settings2} />
      <div>
        <h2>New architecture in progress</h2>
        <p>React and TypeScript interface with isolated browser demonstration data</p>
        <p>Payments processing, receipt builders, Front Desk and Restaurant workflows are not yet migrated from the legacy application</p>
      </div>
    </div>
    <div className="system-options">
      <button onClick={download}>
        <Download size={19} />
        <strong>Export demo data</strong>
        <span>Save the current demonstration dataset as JSON</span>
      </button>
      <button onClick={() => {
        if (confirm('Reset the new demonstration workspace?')) reset()
      }}>
        <FileClock size={19} />
        <strong>Reset demo workspace</strong>
        <span>Restore sample records for this prototype only</span>
      </button>
    </div>
  </>
}
function SearchDialog({ go, onClose, isOpen }: { go: (a: Area) => void; onClose: () => void; isOpen: boolean }) {
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (isOpen) {
      restoreFocus.current = document.activeElement as HTMLElement
      setQ('')
      inputRef.current?.focus()
    } else if (restoreFocus.current) {
      restoreFocus.current.focus()
      restoreFocus.current = null
    }
  }, [isOpen])
  const candidates = allNav.map(x => ({ name: x.label, detail: 'Navigation', area: x.area })).filter(x => `${x.name} ${x.detail}`.toLowerCase().includes(q.toLowerCase()))
  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const dialog = event.currentTarget
    const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')]
    if (!focusable.length) return
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
  return <div
    className={`dialog-shade ${isOpen ? 'is-open' : ''}`}
    aria-hidden={!isOpen}
    inert={!isOpen}
    onClick={onClose}>
    <div
      className="search-dialog"
      role="dialog"
      aria-modal={isOpen}
      aria-label="Search resortOS"
      onKeyDown={trapFocus}
      onClick={e => e.stopPropagation()}>
      <div className="dialog-input">
        <Search size={20} />
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search pages" />
        <button
          onClick={onClose}
          aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="search-results">
        {candidates.length === 0 ? <p>No matching results</p> : candidates.map((x, i) => <button
          key={`${x.detail}-${i}`}
          onClick={() => {
            go(x.area)
            onClose()
          }}>
          <span>
            {x.name}
            <small>
              {x.detail}
            </small>
          </span>
          <ArrowUpRight size={16} />
        </button>)}
      </div>
    </div>
  </div>
}
export function App() {
  const [area, setArea] = useState<Area>(routeFromHash)
  const [store, setStore] = useState<Store>(loadStore)
  // Shared in-session tickets keep Dashboard metrics synchronized with Support.
  // Real multi-user persistence and authorization belong to the future backend.
  const [supportTickets, setSupportTickets] = useState<SampleTicket[]>(createSupportTickets)
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const h = () => setArea(routeFromHash())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
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
  const go = (a: Area) => { location.hash = a; setArea(a); window.scrollTo({ top: 0, behavior: 'instant' }) }
  const reset = () => { setStore(resetStore()); setSupportTickets(createSupportTickets()) }
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
        return <SystemsPage
          store={store}
          reset={reset} />
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
      area={area}
      onNavigate={go}
      menuOpen={menuOpen}
      onClose={() => setMenuOpen(false)} />
    <main className="main-shell">
      <Header
        onSearch={() => setSearchOpen(true)}
        onMenu={() => setMenuOpen(true)}
        menuOpen={menuOpen} />
      <div className={`main-content ${area === 'dashboard' ? 'dashboard-motion' : ''}`}>
        {page}
      </div>
    </main>
    <SearchDialog
      go={go}
      isOpen={searchOpen}
      onClose={() => setSearchOpen(false)} />
  </div>
}
