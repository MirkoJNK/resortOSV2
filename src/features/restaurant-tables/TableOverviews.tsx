import { CalendarClock, ReceiptText, UtensilsCrossed } from 'lucide-react'
import type { DiningTable } from '../tables-manager/model'
import { WIDTH, HEIGHT, chairPositions, tableDimensions } from '../tables-manager/model'
import { formatPrice } from '../menu-management/model'
import type { Operations, TableAvailability } from './model'
import { activeOrderTotal, activeRecordedLines, activeReservationForTable, activeSession, orderForSession, reservationTiming, tableAvailability } from './model'

type OverviewProps = {
  tables: DiningTable[]
  operations: Operations
  now: number
  onSelect: (id: string) => void
  selectedId: string | null
}
const colors: Record<TableAvailability, { fill: string; stroke: string; text: string; chair: string }> = {
  available: { fill: '#e2f0e1', stroke: '#8db28c', text: '#276545', chair: '#b7d8bc' },
  occupied: { fill: '#f7dfd9', stroke: '#d68479', text: '#9d463e', chair: '#e8afa5' },
  reserved: { fill: '#fff0cc', stroke: '#d4ae58', text: '#87621c', chair: '#efd693' },
  unavailable: { fill: '#edf0ec', stroke: '#b7c0b7', text: '#707c72', chair: '#d6dcd6' },
}
const statusWords: Record<TableAvailability, string> = {
  available: 'Available', occupied: 'Occupied', reserved: 'Reserved', unavailable: 'Unavailable'
}
function readableLabel(name: string, maxLength: number): string[] {
  if (name.length <= maxLength) return [name]
  const words = name.split(' ')
  if (words.length < 2) return [`${name.slice(0, maxLength - 1)}…`]
  const lines = ['', '']
  for (const word of words) {
    if (lines[0].length + word.length + (lines[0] ? 1 : 0) <= maxLength) lines[0] = `${lines[0]} ${word}`.trim()
    else lines[1] = `${lines[1]} ${word}`.trim()
  }
  return lines.filter(Boolean).map(line => line.length <= maxLength ? line : `${line.slice(0, maxLength - 1)}…`)
}
function indicatorAmount(centavos: number): string {
  const full = formatPrice(centavos)
  return full.length <= 13 ? full : `₱${new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 }).format(centavos / 100)}`
}
type IndicatorData = { label: string; kind: 'receipt' | 'dining' | 'booking' }
/** Shared status, icon and amount semantics for Floor Plan and Table Cards. */
function indicatorFor(table: DiningTable, operations: Operations, now: number): IndicatorData | null {
  const session = activeSession(operations, table.id)
  const order = session && orderForSession(operations, session.id)
  const reservation = activeReservationForTable(operations, table.id, now)
  const status = tableAvailability(table, operations, now)
  if (status === 'occupied') {
    const lines = order ? activeRecordedLines(order) : []
    const label = lines.length ? indicatorAmount(activeOrderTotal(order!)) : 'Seated'
    return { label, kind: session?.phase === 'ready-to-pay' ? 'receipt' : 'dining' }
  }
  if (status === 'reserved' && reservation) {
    return { label: ['due', 'late'].includes(reservationTiming(reservation, now)) ? 'Reservation due' : 'Reserved', kind: 'booking' }
  }
  return null
}
function IndicatorIcon({ kind, size = 20 }: { kind: IndicatorData['kind']; size?: number }) {
  return kind === 'receipt' ? <ReceiptText width={size} height={size} strokeWidth={2} /> :
    kind === 'booking' ? <CalendarClock width={size} height={size} strokeWidth={2} /> :
      <UtensilsCrossed width={size} height={size} strokeWidth={2} />
}
function MiniIndicator({ table, operations, now, show }: { table: DiningTable; operations: Operations; now: number; show: boolean }) {
  const data = indicatorFor(table, operations, now)
  if (!data || !show) return null
  const { label, kind } = data
  const width = Math.max(136, Math.min(190, 62 + label.length * 9))
  const y = -tableDimensions(table).h / 2 - 58
  return <g className="rt-mini-indicator" transform={`translate(${-width / 2} ${y})`} aria-hidden="true">
    <rect width={width} height="38" rx="11" fill="#ffffff" stroke="#dfe6da" strokeWidth="1.8"/>
    <path d={`M ${width / 2 - 8} 38 L ${width / 2} 47 L ${width / 2 + 8} 38`} fill="#fff" stroke="#dfe6da" strokeWidth="1.3" strokeLinejoin="round" />
    <rect x="1.5" y="1.5" width="38" height="35" rx="9" fill="#eff5eb"/>
    <path d="M 40 5 V 33" stroke="#dfe6da" strokeWidth="1.5"/>
    <g transform="translate(10 9)" color="#4d7258"><IndicatorIcon kind={kind}/></g>
    <text x={(width + 40) / 2} y="24" textAnchor="middle" fill="#304237" fontSize={label.length > 12 ? 13 : 15} fontWeight="800">{label}</text>
  </g>
}
function CardIndicator({ data }: { data: IndicatorData | null }) {
  if (!data) return null
  return <span className="rt-card-indicator" aria-hidden="true">
    <span className="rt-card-indicator-icon"><IndicatorIcon kind={data.kind} size={15}/></span>
    <span className="rt-card-indicator-value">{data.label}</span>
  </span>
}
function TableShape({ table, status, showChairs = true, compact = false }: {
  table: DiningTable; status: TableAvailability; showChairs?: boolean; compact?: boolean
}) {
  const d = tableDimensions(table)
  const c = colors[status]
  return <g className="rt-table-shape">
    {showChairs && chairPositions(table).map((p, index) => <rect key={index} x={p.x - 13} y={p.y - 11} width="26" height="22" rx="8" fill={c.chair} stroke={c.stroke} strokeWidth="1.6" />)}
    {table.shape === 'round' ? <circle r={d.w / 2} fill={c.fill} stroke={c.stroke} strokeWidth="2.6"/> :
      <rect x={-d.w/2} y={-d.h/2} width={d.w} height={d.h} rx={table.shape === 'square' ? 12 : 15} fill={c.fill} stroke={c.stroke} strokeWidth="2.6"/>}
    {!compact && <text textAnchor="middle" fill={c.text} fontSize={table.label.length > 14 ? '11' : '13'} fontWeight="800">
      {readableLabel(table.label, table.shape === 'rectangle' ? 18 : 11).map((line, index, lines) => <tspan key={index} x="0" dy={index === 0 ? (lines.length > 1 ? -1 : 4) : 15}>{line}</tspan>)}
    </text>}
  </g>
}
/** Never stack floating amounts over neighboring bubbles or interactive table surfaces.
 * The selected table wins; hidden summaries remain accessible on selection. */
function visibleMiniIndicators(tables: DiningTable[], ops: Operations, now: number, selectedId: string | null) {
  const chosen = new Set<string>()
  const occupied: {x: number; y: number; w: number; h: number}[] = []
  const candidates = [...tables].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId))
  for (const table of candidates) {
    const status = tableAvailability(table, ops, now)
    if (status !== 'occupied' && status !== 'reserved') continue
    const label = indicatorFor(table, ops, now)?.label ?? 'Seated'
    const width = Math.max(136, Math.min(190, 62 + label.length * 9))
    const height = 49
    const rect = { x: table.x - width/2, y: table.y - tableDimensions(table).h/2 - 58, w: width, h: height }
    const collision = (a: typeof rect, b: typeof rect) => a.x < b.x+b.w+7 && a.x+a.w+7 > b.x && a.y < b.y+b.h+7 && a.y+a.h+7 > b.y
    const touchesAnotherTable = tables.some(other => other.id !== table.id && collision(rect,
      {x: other.x - tableDimensions(other).w/2 - 16, y: other.y - tableDimensions(other).h/2 - 16,
        w: tableDimensions(other).w+32, h:tableDimensions(other).h+32}))
    if ((rect.x < 8 || rect.y < 55 || rect.x+width > WIDTH-8 || occupied.some(b => collision(rect,b)) || touchesAnotherTable) && table.id !== selectedId) continue
    occupied.push(rect); chosen.add(table.id)
  }
  return chosen
}
/** One independent Admin-configured area per canvas, using its unchanged logical coordinates. */
export function RestaurantFloorPlan({ tables, operations, now, onSelect, selectedId, area }: OverviewProps & { area: string }) {
  const activeTables = tables.filter(t => t.area === area)
  const visibleIndicators = visibleMiniIndicators(activeTables, operations, now, selectedId)
  return <div className="rt-floor-panel" data-tour-target="restaurant-floor-plan">
    <div className="rt-floor-scroll" tabIndex={0} aria-label={`${area} floor plan, scroll horizontally when needed`}>
      <svg className="rt-floor-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={`${area} table positions`}>
        <defs><pattern id="rt-floor-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" stroke="#edf2e9" strokeWidth="1" fill="none" /></pattern></defs>
        <rect x="1" y="1" width={WIDTH-2} height={HEIGHT-2} rx="16" fill="#fdfefb" stroke="#e1e9df" strokeWidth="2" />
        <rect x="1" y="1" width={WIDTH-2} height={HEIGHT-2} rx="16" fill="url(#rt-floor-grid)" />
        <text x="24" y="39" className="rt-floor-area-label">{area.toLocaleUpperCase()}</text>
        {activeTables.map(table => {
          const state = tableAvailability(table, operations, now)
          const sel = selectedId === table.id
          const session = activeSession(operations, table.id)
          const booking = activeReservationForTable(operations, table.id, now)
          const title = `${table.label}, ${statusWords[state]}${session?.phase === 'ready-to-pay' ? ', ready to pay' : ''}${booking && session ? ', upcoming reservation conflict' : ''}`
          const dimensions = tableDimensions(table)
          return <g key={table.id} className={`rt-floor-table rt-status-${state} ${sel ? 'rt-is-selected' : ''}`}
            transform={`translate(${table.x} ${table.y})`} role="button" tabIndex={0} aria-label={title}
            onClick={() => onSelect(table.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(table.id) } }}>
            <title>{title}</title>
            {sel && (table.shape === 'round' ? <circle r={dimensions.w/2 + 12} className="rt-table-focus-ring" /> :
              <rect x={-dimensions.w/2 - 12} y={-dimensions.h/2 - 12} width={dimensions.w + 24} height={dimensions.h + 24} rx="21" className="rt-table-focus-ring" />)}
            <g transform={`rotate(${table.rotation})`}><TableShape table={table} status={state} /></g>
            <MiniIndicator table={table} operations={operations} now={now} show={visibleIndicators.has(table.id)} />
            {session && booking && <circle cx={dimensions.w/2 + 6} cy={-dimensions.h/2 - 6} r="9" fill="#c04e45" stroke="#fff" strokeWidth="3"><title>Upcoming reservation conflict</title></circle>}
          </g>
        })}
        {activeTables.length === 0 && <text x={WIDTH/2} y={HEIGHT/2} textAnchor="middle" fill="#768278" fontSize="20">No tables in this area</text>}
      </svg>
    </div>
    <div className="rt-status-legend" aria-label="Table status legend">
      {(['available', 'occupied', 'reserved', 'unavailable'] as TableAvailability[]).map(state =>
        <span key={state}><i className={`rt-legend-dot rt-status-${state}`}/>{statusWords[state]}</span>)}
    </div>
  </div>
}
export function RestaurantTableCards({ tables, operations, now, onSelect, selectedId }: OverviewProps) {
  if (tables.length === 0) return <div className="rt-empty">No matching tables</div>
  return <div className="rt-cards" data-tour-target="restaurant-table-cards">
    {tables.map(table => {
      const state = tableAvailability(table, operations, now)
      const session = activeSession(operations, table.id)
      const booking = activeReservationForTable(operations, table.id, now)
      const indicator = indicatorFor(table, operations, now)
      return <button key={table.id} type="button" className={`rt-table-card rt-status-${state} ${selectedId === table.id ? 'rt-is-selected' : ''}`}
        onClick={() => onSelect(table.id)} aria-label={`${table.label}, ${statusWords[state]}${booking && session ? ', upcoming reservation conflict' : ''}`}>
        <span className="rt-card-top"><strong title={table.label}>{table.label}</strong><span className="rt-card-status">{statusWords[state]}</span></span>
        <span className={`rt-card-visual ${indicator ? 'rt-has-indicator' : ''}`}>
          <CardIndicator data={indicator} />
          <svg viewBox="0 0 240 160" className="rt-card-graphic" role="img" aria-label={`${table.shape} table with ${table.chairs} chairs`}>
            <g transform="translate(120 83) scale(.64)"><g transform={`rotate(${table.rotation})`}><TableShape table={table} status={state} compact /></g></g>
          </svg>
        </span>
      </button>
    })}
  </div>
}
