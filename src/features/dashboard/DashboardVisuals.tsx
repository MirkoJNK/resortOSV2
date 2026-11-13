import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CalendarDays, Sun } from 'lucide-react'
import { StatIcon } from '../../components/Ui'
import type { DashboardDataPoint } from './chartSelectors'

/** Shared resortOS dashboard identity; never modifies the approved illustration assets. */
export function DashboardHero() {
  return <section className="resort-art motion-reveal motion-order-1" aria-label="Resort illustration">
    <div className="art-shore" /><div className="art-arch" />
    <div className="art-copy">Operations<br />power<br />unforgettable<br />stays<span className="art-underline" /></div>
    <div className="weather" title="Illustrative weather — not a live forecast" aria-label="Illustrative weather, not a live forecast">
      <Sun size={29} strokeWidth={1.8} /><div><strong>28°C</strong><small>Oceanview Resort</small></div>
    </div>
  </section>
}
export function DashboardGreeting({ employee }: { employee: 'Admin' | 'Employee' }) {
  return <div className="welcome motion-reveal motion-order-0">
    <h1>Good morning, {employee}</h1>
    <div className="day-meta">
      <span><CalendarDays size={15} />{new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
      <span className="meta-divider" />
      <span title="Illustrative weather — not a live forecast"><Sun size={17} className="sun-icon" />28°C</span>
      <span>Oceanview Resort</span>
    </div>
  </div>
}
export function DashboardKpi({ icon, title, value, note, tone = 'lime', open, order }: {
  icon: LucideIcon; title: string; value: string | number; note: string; tone?: 'lime' | 'blue'; open?: { label: string; action: () => void }; order: number
}) {
  return <article className={`panel ros-kpi-card ${tone === 'lime' ? 'ticket-panel' : 'payments-panel'} motion-reveal motion-order-${order}`}>
    <div className="panel-head"><StatIcon icon={icon} tone={tone === 'blue' ? 'blue' : undefined} /><h2>{title}</h2>
      {open && <button type="button" className="ros-kpi-open" onClick={open.action} aria-label={open.label}>View</button>}
    </div>
    <div className="ros-kpi-value" aria-label={`${title}: ${value}`}>{value}</div>
    <div className="ros-kpi-note">{note}</div>
  </article>
}
export function DashboardMiniMetric({ icon, label, value, note }: { icon: LucideIcon; label: string; value: string | number; note: string }) {
  return <article className="panel ros-mini-metric">
    <span className="ros-mini-icon"><StatIcon icon={icon} /></span>
    <div><h3>{label}</h3><strong>{value}</strong><p>{note}</p></div>
  </article>
}

type ChartProps = {
  title: string; context: string; series: DashboardDataPoint[] | null; kind: 'columns' | 'bars'
  formatValue?: (value: number) => string; formatTick?: (value: number) => string; empty?: string; footer?: ReactNode; order?: number
}
/** Accessible, dependency-free chart. Values are always rendered as text, not inferred from bar width. */
export function DashboardChart({ title, context, series, kind, formatValue = n => String(n), formatTick, empty = 'No activity recorded', footer, order = 4 }: ChartProps) {
  const max = Math.max(1, ...(series ?? []).map(point => point.value))
  const positive = !!series?.some(point => point.value > 0)
  return <article className={`panel ros-chart-panel motion-reveal motion-order-${order}`}>
    <header className="ros-chart-head"><h2>{title}</h2><span>{context}</span></header>
    {!series ? <div className="ros-chart-empty" role="status">Records unavailable</div>
      : !positive ? <div className="ros-chart-empty" role="status">{empty}</div>
      : <ul className={`ros-chart-series ros-chart-${kind}`} aria-label={`${title}. ${series.map(p => `${p.label}: ${formatValue(p.value)}`).join('; ')}`}>
        {series.map((point, i) => <li key={`${point.label}:${i}`} tabIndex={0} aria-label={`${point.label}: ${formatValue(point.value)}`} title={`${point.label}: ${formatValue(point.value)}`}>
          <span className="ros-chart-mark-track"><span className="ros-chart-mark" style={kind === 'columns' ? { height: `${point.value / max * 100}%` } : { width: `${point.value / max * 100}%` }} /></span>
          <span className="ros-chart-label">{kind === 'columns' ? point.label.slice(5) : point.label}</span>
          <span className="ros-chart-number">{(formatTick ?? formatValue)(point.value)}</span>
        </li>)}
      </ul>}
    {footer && <div className="ros-chart-footer">{footer}</div>}
  </article>
}
export function DashboardActivity({ title, children, order = 7 }: { title: string; children: ReactNode; order?: number }) {
  return <article className={`panel audit-panel ros-activity-panel motion-reveal motion-order-${order}`}><h2>{title}</h2><div className="audit-lines ros-activity-list">{children}</div></article>
}
