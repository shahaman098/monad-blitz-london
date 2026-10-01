import { useId, useMemo, useState } from 'react'
import { fmtMon } from '../lib/chain'
import type { PricePoint } from '../lib/useClutch'

const fullDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const axisDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatTime(timestampMs: number | null, compact = false) {
  if (timestampMs === null) return 'Time pending'
  return (compact ? axisDate : fullDate).format(new Date(timestampMs))
}

/** A fixed 0-100% odds tracker built only from Monad trade events and live state. */
export function PriceChart({
  points,
  height = 104,
  accent = 'var(--bp-yes-fill, var(--bp-yes))',
}: {
  points: PricePoint[]
  height?: number
  accent?: string
}) {
  const gradientId = useId()
  const [hover, setHover] = useState<number | null>(null)

  const xy = useMemo(() => {
    if (points.length === 0) return []
    const knownTimes = points.map((point) => point.timestampMs)
    const canUseTime = knownTimes.every((time): time is number => time !== null)
    const minTime = canUseTime ? Math.min(...knownTimes) : 0
    const maxTime = canUseTime ? Math.max(...knownTimes) : 0
    const hasTimeRange = canUseTime && maxTime > minTime

    return points.map((point, index) => ({
      x:
        points.length === 1
          ? 100
          : hasTimeRange
            ? ((point.timestampMs! - minTime) / (maxTime - minTime)) * 100
            : (index / (points.length - 1)) * 100,
      y: 100 - point.priceBps / 100,
      point,
    }))
  }, [points])

  if (xy.length === 0) {
    return (
      <div className="chart-empty" style={{ height }}>
        Waiting for Monad market data
      </div>
    )
  }

  const drawPoints =
    xy.length === 1
      ? [
          { ...xy[0], x: 0 },
          { ...xy[0], x: 100 },
        ]
      : xy
  const path = drawPoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
  const area = `0,100 ${path} 100,100`
  const selectedIndex = hover ?? xy.length - 1
  const selected = xy[selectedIndex]
  const delta = selected.point.priceBps - xy[0].point.priceBps
  const tradeCount = points.filter((point) => point.source === 'trade').length
  const midPoint = points[Math.floor((points.length - 1) / 2)]

  const selectFromPointer = (clientX: number, element: SVGSVGElement) => {
    const bounds = element.getBoundingClientRect()
    const cursorX = ((clientX - bounds.left) / bounds.width) * 100
    let nearest = 0
    let distance = Number.POSITIVE_INFINITY
    xy.forEach((point, index) => {
      const nextDistance = Math.abs(point.x - cursorX)
      if (nextDistance < distance) {
        nearest = index
        distance = nextDistance
      }
    })
    setHover(nearest)
  }

  return (
    <section className="chart" aria-label="YES odds over time">
      <div className="chart-kicker">
        <span>
          <i /> Live odds tracker
        </span>
        <span>{tradeCount} on-chain {tradeCount === 1 ? 'trade' : 'trades'}</span>
      </div>

      <div className="chart-head">
        <div>
          <strong className="nums">{(selected.point.priceBps / 100).toFixed(1)}%</strong>
          <span>YES probability</span>
        </div>
        <span className={`nums chart-delta ${delta >= 0 ? 'is-up' : 'is-down'}`}>
          {delta >= 0 ? '+' : ''}
          {(delta / 100).toFixed(1)} pts
        </span>
      </div>

      <div className="chart-plot" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onPointerLeave={() => setHover(null)}
          onPointerMove={(event) => selectFromPointer(event.clientX, event.currentTarget)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[25, 50, 75].map((level) => (
            <line
              key={level}
              x1="0"
              x2="100"
              y1={100 - level}
              y2={100 - level}
              className="chart-grid"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polygon points={area} fill={`url(#${gradientId})`} />
          <polyline
            points={path}
            fill="none"
            stroke={accent}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {xy.map(({ x, y, point }, index) =>
            point.source === 'trade' ? (
              <circle
                key={`${point.hash ?? point.blockNumber}-${index}`}
                cx={x}
                cy={y}
                r="1.45"
                className="chart-point"
                fill={accent}
                vectorEffect="non-scaling-stroke"
              />
            ) : null
          )}

          <line
            x1={selected.x}
            x2={selected.x}
            y1="0"
            y2="100"
            className="chart-cursor"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={selected.x}
            cy={selected.y}
            r="2.6"
            fill={accent}
            className="chart-selected"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="chart-y chart-y-top">100%</span>
        <span className="chart-y chart-y-mid">50%</span>
        <span className="chart-y chart-y-bot">0%</span>
      </div>

      <div className="chart-axis nums">
        <span>{formatTime(points[0].timestampMs, true)}</span>
        {points.length > 2 && <span>{formatTime(midPoint.timestampMs, true)}</span>}
        <span>{formatTime(points[points.length - 1].timestampMs, true)}</span>
      </div>

      <div className="chart-detail" aria-live="polite">
        <div>
          <span>{selected.point.source === 'trade' ? 'Monad trade' : 'Live market snapshot'}</span>
          <strong className="nums">{formatTime(selected.point.timestampMs)}</strong>
        </div>
        <div>
          <span>
            {selected.point.source === 'trade'
              ? `${selected.point.isBuy ? 'Bought' : 'Sold'} ${selected.point.isYes ? 'YES' : 'NO'}`
              : 'Latest contract state'}
          </span>
          <strong className="nums">
            {selected.point.collateral !== undefined
              ? `${fmtMon(selected.point.collateral, 4)} MON`
              : selected.point.blockNumber !== null
                ? `Block ${selected.point.blockNumber}`
                : 'Updating live'}
          </strong>
        </div>
      </div>
    </section>
  )
}
