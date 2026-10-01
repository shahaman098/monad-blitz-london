import { useId, useMemo } from 'react'
import { fmtMon } from '../lib/chain'
import type { PricePoint } from '../lib/useClutch'

type PortfolioChartProps = {
  points: PricePoint[]
  yesShares: bigint
  noShares: bigint
  costBasis: bigint
  currentValue: bigint
  settled: boolean
}

/**
 * Turns the market's odds history into this wallet's position history. The
 * underlying odds points remain chain-backed; only the portfolio valuation is
 * derived in the browser from the user's YES/NO exposure.
 */
export function PortfolioChart({
  points,
  yesShares,
  noShares,
  costBasis,
  currentValue,
  settled,
}: PortfolioChartProps) {
  const gradientId = useId()

  const values = useMemo(() => {
    const derived = points.map((point) =>
      (yesShares * BigInt(point.priceBps) + noShares * BigInt(10_000 - point.priceBps)) / 10_000n
    )
    if (derived.length === 0) return [currentValue]
    if (settled && derived[derived.length - 1] !== currentValue) return [...derived, currentValue]
    derived[derived.length - 1] = currentValue
    return derived
  }, [currentValue, noShares, points, settled, yesShares])

  const pnlValues = values.map((value) => value - costBasis)
  const min = pnlValues.reduce((lowest, value) => (value < lowest ? value : lowest), 0n)
  const max = pnlValues.reduce((highest, value) => (value > highest ? value : highest), 0n)
  const range = max - min
  const plotted = pnlValues.map((value, index) => ({
    x: pnlValues.length === 1 ? 100 : (index / (pnlValues.length - 1)) * 100,
    y: range === 0n ? 50 : 92 - Number(((value - min) * 84n) / range),
  }))
  const drawPoints =
    plotted.length === 1
      ? [
          { ...plotted[0], x: 0 },
          { ...plotted[0], x: 100 },
        ]
      : plotted
  const path = drawPoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
  const area = `0,100 ${path} 100,100`
  const zeroY = range === 0n ? 50 : 92 - Number(((-min * 84n) / range))
  const pnl = currentValue - costBasis
  const returnPct = costBasis > 0n ? Number((pnl * 10_000n) / costBasis) / 100 : 0
  const accent = pnl >= 0n ? 'var(--bp-yes-fill, var(--bp-yes))' : 'var(--bp-no)'

  return (
    <section className="position-chart" aria-label="Your position performance">
      <div className="position-chart-head">
        <div>
          <span>Your position</span>
          <strong className="nums">{fmtMon(currentValue, 4)} MON</strong>
        </div>
        <div>
          <span>Total return</span>
          <strong className={`nums ${pnl >= 0n ? 'is-yes' : 'is-no'}`}>
            {pnl >= 0n ? '+' : ''}{fmtMon(pnl, 4)} · {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
          </strong>
        </div>
      </div>

      <div className="position-chart-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" x2="100" y1={zeroY} y2={zeroY} className="position-chart-zero" />
          <polygon points={area} fill={`url(#${gradientId})`} />
          <polyline
            points={path}
            fill="none"
            stroke={accent}
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={plotted[plotted.length - 1].x}
            cy={plotted[plotted.length - 1].y}
            r="3"
            fill={accent}
            className="position-chart-dot"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="position-chart-axis">
        <span>Entry {fmtMon(costBasis, 4)} MON</span>
        <span>{settled ? 'Final payout' : 'Live mark'}</span>
      </div>
    </section>
  )
}
