import { useState } from 'react'
import type { RoomPostingPoint } from './chartSelectors'
import { formatPrice } from '../menu-management/model'

const PLOT_LEFT = 48
const PLOT_RIGHT = 960
const PLOT_TOP = 24
const PLOT_BOTTOM = 164

function dateLabel(isoDay: string, long = false): string {
  const day = new Date(`${isoDay}T12:00:00Z`)
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC', month: long ? 'long' : 'short', day: 'numeric', ...(long ? { year: 'numeric' } : {})
  }).format(day)
}

/** Seven resort-local daily posting counts, with the separately recorded value of charges posted.
 * SVG is decorative; the positioned point buttons expose exact values to keyboard and touch. */
export function RoomPostingsLineChart({ series }: { series: RoomPostingPoint[] | null }) {
  const [inspected, setInspected] = useState<number | null>(null)
  const maxCount = Math.max(0, ...(series ?? []).map(point => point.value))
  const ceiling = Math.max(1, Math.ceil(maxCount / 2) * 2)
  const positions = (series ?? []).map((point, index) => ({
    x: PLOT_LEFT + index * (PLOT_RIGHT - PLOT_LEFT) / 6,
    y: PLOT_BOTTOM - (point.value / ceiling) * (PLOT_BOTTOM - PLOT_TOP)
  }))
  const points = positions.map(point => `${point.x},${point.y}`).join(' ')
  const active = inspected !== null && series ? series[inspected] : null
  const activePosition = inspected !== null ? positions[inspected] : null

  return <article className="panel ros-chart-panel ros-postings-panel motion-reveal motion-order-4">
    <header className="ros-chart-head"><h2>Room postings</h2><span>Last 7 days</span></header>
    {!series || series.length !== 7 ? <div className="ros-chart-empty" role="status">Posting records unavailable</div> : <>
      <div className="ros-line-plot" aria-label="Room postings for the last seven days">
        <svg className="ros-line-graphic" viewBox="0 0 1000 184" preserveAspectRatio="none" aria-hidden="true">
          {[PLOT_TOP, (PLOT_TOP + PLOT_BOTTOM) / 2, PLOT_BOTTOM].map(y =>
            <line key={y} className="ros-line-grid" x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} />)}
          <polyline className="ros-line-path" points={points} />
        </svg>
        {series.map((point, index) => <button type="button" key={point.label}
          className={`ros-line-point ${inspected === index ? 'is-inspected' : ''}`}
          style={{ left: `${positions[index].x / 10}%`, top: `${positions[index].y / 184 * 100}%` }}
          aria-label={`${dateLabel(point.label, true)}: ${point.value} room ${point.value === 1 ? 'posting' : 'postings'}, ${formatPrice(point.postedCentavos)} posted`}
          onMouseEnter={() => setInspected(index)}
          onMouseLeave={() => setInspected(current => current === index ? null : current)}
          onFocus={() => setInspected(index)}
          onBlur={() => setInspected(current => current === index ? null : current)}
          onClick={() => setInspected(index)}>
          <span className="rt-sr-only">Inspect {dateLabel(point.label)}</span>
        </button>)}
        {active && activePosition && <div className={`ros-line-tooltip ${activePosition.y < 82 ? 'is-below' : ''}`}
          style={{ left: `${Math.max(19, Math.min(81, activePosition.x / 10))}%`, top: `${activePosition.y / 184 * 100}%` }}>
          <strong>{dateLabel(active.label)}</strong>
          <span>{active.value} {active.value === 1 ? 'posting' : 'postings'}</span>
          <span>{formatPrice(active.postedCentavos)} posted</span>
        </div>}
      </div>
      <div className="ros-line-dates" aria-hidden="true">
        {series.map(point => <span key={point.label}>{dateLabel(point.label)}</span>)}
      </div>
      {maxCount === 0 && <div className="ros-line-zero-summary">No room postings recorded in the last 7 days</div>}
    </>}
  </article>
}
