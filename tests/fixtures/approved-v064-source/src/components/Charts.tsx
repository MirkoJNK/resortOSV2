/* resortOS charts v0.2.4
   These composable visual primitives use supplied values instead of hard-coded bar sizes
   The dashboard supplies illustrative activity samples until operational history is connected
*/
import type { CSSProperties } from 'react'

type ChartSeries = { label: string; value: number; color: string }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** Each day has two activity snapshots, both positioned directly over the corresponding day label */
export function Bars({ values, labels, compact = false }: {
  values: number[]
  labels: string[]
  compact?: boolean
}) {
  const perDay = labels.length ? Math.ceil(values.length / labels.length) : 0
  const maxValue = Math.max(1, ...values.map(v => Math.max(0, v)))
  return <figure
    className={`chart-bars ${compact ? 'compact' : ''}`.trim()}
    role="img"
    aria-label={`Illustrative support activity across ${labels.length} days, with two snapshots per day`}>
    <div className="bars-plot">
      {labels.map((label, day) => {
        const daily = values.slice(day * perDay, day * perDay + perDay)
        return <div
          className={`bar-day ${day === labels.length - 1 ? 'current-day' : ''}`}
          key={`${label}-${day}`}>
          <div className="day-pair">
            {daily.map((value, index) => <span
              key={index}
              className={`chart-bar ${day === labels.length - 1 || index === 0 ? 'lime-bar' : 'muted-bar'}`}
              style={{ height: `${clamp(100 * Math.max(0, value) / maxValue, 5, 100)}%` }} />)}
          </div>
          <span className="bar-day-label">{label}</span>
        </div>
      })}
    </div>
  </figure>
}

/** Smooth Catmull-Rom to cubic Bezier interpolation, preserving the supplied sample values */
function smoothPath(samples: number[], width: number, height: number) {
  const max = Math.max(1, ...samples), min = Math.min(0, ...samples)
  const points = samples.map((value, index) => ({ x: index * width / Math.max(1, samples.length - 1), y: height - 12 - (value - min) / Math.max(1, max - min) * (height - 25) }))
  if (!points.length) return { line: '', area: '', last: { x: 0, y: height } }
  let line = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const previous = points[Math.max(0, i - 1)], from = points[i], to = points[i + 1], next = points[Math.min(points.length - 1, i + 2)]
    const c1x = from.x + (to.x - previous.x) / 6, c1y = from.y + (to.y - previous.y) / 6
    const c2x = to.x - (next.x - from.x) / 6, c2y = to.y - (next.y - from.y) / 6
    line += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${to.x.toFixed(1)} ${to.y.toFixed(1)}`
  }
  return { line, area: `${line} L ${width} ${height} L 0 ${height} Z`, last: points.at(-1)! }
}

export function PaymentLine({ values = [16, 21, 33, 40, 30, 26, 47, 35, 30, 55, 44, 43, 62, 57, 71, 83], labels = [
  '6am',
  '10am',
  '2pm',
  '6pm',
  '10pm'
] }: {
  values?: number[]
  labels?: string[]
}) {
  const { line, area, last } = smoothPath(values, 460, 104)
  return <figure
    className="payment-line"
    role="img"
    aria-label="Illustrative payment activity through the day, rising overall toward the evening">
    <svg preserveAspectRatio="none" viewBox="0 0 460 104" aria-hidden="true">
      <line className="payment-baseline" x1="0" x2="460" y1="103" y2="103" />
      <path className="payment-area" d={area} />
      <path className="payment-stroke" d={line} pathLength={1} />
      <circle className="payment-end-halo" cx={last.x} cy={last.y} r="7" />
      <circle className="payment-end" cx={last.x} cy={last.y} r="4.8" />
    </svg>
    <div className="chart-axis">{labels.map(label => <span key={label}>{label}</span>)}</div>
  </figure>
}

export function ProgressBar({ label, value, max, color }: {
  label: string
  value: number
  max: number
  color?: string
}) {
  const ratio = clamp(max > 0 ? value / max * 100 : 0, 0, 100)
  return <div
    className="dept-track"
    role="progressbar"
    aria-label={label}
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={max}>
    <span
      className="dept-fill"
      style={{ width: `${ratio}%`, ...(color ? { '--fill-color': color } as CSSProperties : {}) }} />
  </div>
}

export function RoleDistribution({ items }: { items: ChartSeries[] }) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0)
  return <div
    className="access-track"
    role="img"
    aria-label={`Role distribution: ${items.map(x => `${x.value} ${x.label.toLowerCase()}`).join(', ')}`}>
    {items.map(item => <span
      key={item.label}
      title={`${item.label}: ${item.value} (${total ? Math.round(100 * item.value / total) : 0}%)`}
      style={{ flexGrow: Math.max(0, item.value), background: item.color }} />)}
  </div>
}
