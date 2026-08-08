import { useId, useMemo, useState } from 'react'
import type { PricePoint } from '../lib/useClutch'

/**
 * Compact probability chart: YES odds over time on a fixed 0–100% axis, so a
 * two-point drift cannot be auto-scaled into a fake cliff.
 *
 * The warm-up segment (everything before `seededUpTo`) is drawn dashed and
 * labelled, because it is demo scaffolding rather than chain history. Real
 * on-chain trades are the solid part of the line.
 */
export function PriceChart({
  points,
  seededUpTo = 0,
  height = 76,
  accent = 'var(--bp-yes-fill, var(--bp-yes))',
}: {
  points: PricePoint[]
  seededUpTo?: number
  height?: number
  accent?: string
}) {
  const gradientId = useId()
  const [hover, setHover] = useState<number | null>(null)

  const xy = useMemo(() => {
    if (points.length === 0) return []
    const src = points.length === 1 ? [points[0], points[0]] : points
    return src.map((p, i) => ({
      x: (i / (src.length - 1)) * 100,
      y: 100 - (p.priceBps / 10_000) * 100,
      bps: p.priceBps,
    }))
  }, [points])

  if (xy.length === 0) {
    return <div className="chart-empty" style={{ height }} />
  }

  // Overlap by one point so the dashed and solid halves visually connect.
  const cut = Math.max(1, Math.min(xy.length - 1, seededUpTo))
  const warm = xy.slice(0, cut + 1)
  const realPart = xy.slice(cut)

  const path = (pts: typeof xy) => pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
  const area = `${xy[0].x},100 ${path(xy)} 100,100`

  const last = xy[xy.length - 1].bps
  const delta = last - xy[0].bps
  const shown = hover !== null ? xy[hover] : xy[xy.length - 1]
  const up = delta >= 0

  return (
    <div className="chart">
      <div className="chart-head">
        <strong className="nums">{(shown.bps / 100).toFixed(1)}%</strong>
        <span className={`nums chart-delta ${up ? 'is-up' : 'is-down'}`}>
          {up ? '▲' : '▼'} {Math.abs(delta / 100).toFixed(1)}
        </span>
        {seededUpTo > 0 && realPart.length <= 2 && (
          <span className="chart-tag">warm-up · live from first bet</span>
        )}
      </div>

      <div className="chart-plot" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const ratio = (e.clientX - r.left) / r.width
            setHover(Math.max(0, Math.min(xy.length - 1, Math.round(ratio * (xy.length - 1)))))
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.26" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>

          <line x1="0" x2="100" y1="50" y2="50" className="chart-mid" vectorEffect="non-scaling-stroke" />
          <polygon points={area} fill={`url(#${gradientId})`} />

          {warm.length > 1 && (
            <polyline
              points={path(warm)}
              fill="none"
              stroke={accent}
              strokeWidth="1.5"
              strokeOpacity="0.45"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {realPart.length > 1 && (
            <polyline
              points={path(realPart)}
              fill="none"
              stroke={accent}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {hover !== null && (
            <line
              x1={xy[hover].x}
              x2={xy[hover].x}
              y1="0"
              y2="100"
              className="chart-cursor"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <circle cx={shown.x} cy={shown.y} r="2.5" fill={accent} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="chart-y chart-y-top">100</span>
        <span className="chart-y chart-y-mid">50</span>
        <span className="chart-y chart-y-bot">0</span>
      </div>
    </div>
  )
}
