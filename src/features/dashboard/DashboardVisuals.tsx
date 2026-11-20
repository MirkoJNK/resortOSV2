import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CalendarDays, Cloud, CloudFog, CloudLightning, CloudMoon, CloudOff, CloudRain,
  CloudSnow, CloudSun, Moon, Sun } from 'lucide-react'
import type {Employee} from '../employees/model'
import {greetingForPhilippineTime,philippineDashboardDate,useDashboardClock} from './dashboardGreeting'
import {useCebuWeather} from '../weather/weatherStore'
import type {WeatherReading} from '../weather/weatherStore'
import { StatIcon } from '../../components/Ui'
import type { DashboardDataPoint } from './chartSelectors'
import { KpiPeriodSelect } from './KpiPeriodSelect'
import type { PeriodControl } from './KpiPeriodSelect'

const rainyCodes=new Set([1063,1072,1150,1153,1168,1171,1180,1183,1186,1189,1192,1195,
  1198,1201,1240,1243,1246,1249,1252])
const snowyCodes=new Set([1066,1069,1114,1117,1204,1207,1210,1213,1216,1219,1222,1225,
  1237,1255,1258,1261,1264])
const stormCodes=new Set([1087,1273,1276,1279,1282])
const fogCodes=new Set([1030,1135,1147])
export function conditionIcon(reading:WeatherReading|null){
  if(!reading)return CloudOff
  const {conditionCode:code,isDay}=reading
  if(code===1000)return isDay?Sun:Moon
  if(code===1003)return isDay?CloudSun:CloudMoon
  if(stormCodes.has(code))return CloudLightning
  if(snowyCodes.has(code))return CloudSnow
  if(rainyCodes.has(code))return CloudRain
  if(fogCodes.has(code))return CloudFog
  return Cloud
}
const temperature=(reading:WeatherReading|null)=>reading?`${Math.round(reading.tempC)}°C`:'—°C'
const weatherLabel=(reading:WeatherReading|null,status:'loading'|'ready'|'unavailable')=>reading?
  `Current weather in Cebu City: ${reading.condition}, ${temperature(reading)}. Updated ${reading.providerUpdatedAt}`:
  status==='loading'?'Loading Cebu City weather':'Current weather for Cebu City is unavailable'

/** Shared resortOS dashboard identity; never modifies the approved illustration assets. */
export function DashboardHero() {
  const weather=useCebuWeather()
  const reading=weather.status==='ready'?weather.reading:null
  const Icon=conditionIcon(reading)
  return <section className="resort-art motion-reveal motion-order-1" aria-label="Resort illustration">
    <div className="art-shore" /><div className="art-arch" />
    <div className={`weather ${reading?'':'is-unavailable'}`} title={weatherLabel(reading,weather.status)} aria-label={weatherLabel(reading,weather.status)}>
      <Icon size={29} strokeWidth={1.8} /><div><strong className="weather-temperature">{temperature(reading)}</strong><small>Oceanview Resort</small></div>
    </div>
  </section>
}
export function DashboardGreeting({ account }: { account: Pick<Employee,'id'|'fullName'> }) {
  const now=useDashboardClock()
  const weather=useCebuWeather()
  const reading=weather.status==='ready'?weather.reading:null
  const Icon=conditionIcon(reading)
  return <div className="welcome motion-reveal motion-order-0">
    <h1>{greetingForPhilippineTime(now,account)}</h1>
    <div className="day-meta">
      <span><CalendarDays size={15} />{philippineDashboardDate(now)}</span>
      <span className="meta-divider" />
      <span title={weatherLabel(reading,weather.status)} aria-label={weatherLabel(reading,weather.status)}><Icon size={17} className={reading?'sun-icon':'weather-unavailable-icon'} />
        <span className="weather-temperature">{temperature(reading)}</span></span>
      <span>Oceanview Resort</span>
    </div>
  </div>
}
export function DashboardKpi({ icon, title, value, note, tone = 'lime', open, period, order }: {
  icon: LucideIcon; title: string; value: string | number; note: string; tone?: 'lime' | 'blue'
  open?: { label: string; action: () => void }
  period?: PeriodControl
  order: number
}) {
  return <article className={`panel ros-kpi-card ${period ? 'ros-kpi-has-period' : ''} ${tone === 'lime' ? 'ticket-panel' : 'payments-panel'} motion-reveal motion-order-${order}`}>
    <div className="panel-head"><StatIcon icon={icon} tone={tone === 'blue' ? 'blue' : undefined} /><h2>{title}</h2>
      {open && <button type="button" className="ros-kpi-open" onClick={open.action} aria-label={open.label}>View</button>}
      {period && <KpiPeriodSelect {...period} />}
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
  title: string; context?: string; series: DashboardDataPoint[] | null; kind: 'columns' | 'bars'
  formatValue?: (value: number) => string; formatTick?: (value: number) => string; empty?: string; footer?: ReactNode; order?: number
  highlightUrgent?: boolean
}
/** Accessible, dependency-free chart. Values are always rendered as text, not inferred from bar width. */
export function DashboardChart({ title, context, series, kind, formatValue = n => String(n), formatTick, empty = 'No activity recorded', footer, order = 4, highlightUrgent=false }: ChartProps) {
  const max = Math.max(1, ...(series ?? []).map(point => point.value))
  const positive = !!series?.some(point => point.value > 0)
  return <article className={`panel ros-chart-panel motion-reveal motion-order-${order}`}>
    <header className="ros-chart-head"><h2>{title}</h2>{context && <span>{context}</span>}</header>
    {!series ? <div className="ros-chart-empty" role="status">Records unavailable</div>
      : !positive ? <div className="ros-chart-empty" role="status">{empty}</div>
      : <ul className={`ros-chart-series ros-chart-${kind}`} aria-label={`${title}. ${series.map(p => `${p.label}: ${formatValue(p.value)}`).join('; ')}`}>
        {series.map((point, i) => <li key={`${point.label}:${i}`} className={highlightUrgent&&point.label==='Urgent'?'ros-chart-urgent':undefined}
          tabIndex={0} aria-label={`${point.label}: ${formatValue(point.value)}`} title={`${point.label}: ${formatValue(point.value)}`}>
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
