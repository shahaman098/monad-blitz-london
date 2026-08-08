import { useEffect, useMemo, useState } from 'react'
import { PriceChart } from './PriceChart'
import { clutchAbi } from '../lib/clutchAbi'
import { CLUTCH_ADDRESS, fmtMon, publicClient, short, txUrl } from '../lib/chain'
import type { Market, PricePoint, TradeEvent } from '../lib/useClutch'

type Side = 'yes' | 'no'
type Mode = 'buy' | 'sell'

export type BetPanelProps = {
  market: Market | null
  question: string | null
  timing: string
  pYes: number
  canBet: boolean
  resolved: boolean
  outcomeYes: boolean
  busy: boolean
  pending: string | null
  error: string | null
  stake: string
  stakes: readonly string[]
  onStakeChange: (next: string) => void
  onBet: (isYes: boolean) => void
  onSell: (isYes: boolean) => void
  onRedeem: () => void
  yesShares: bigint
  noShares: bigint
  pnl: bigint
  balance: bigint
  trades: TradeEvent[]
  series: PricePoint[]
  seededUpTo?: number
}

/**
 * Quotes the current stake against the CPMM so the panel can show a payout
 * before the bet is placed. Debounced because the public Monad RPC caps at
 * 15 req/sec and this fires on every keystroke.
 */
function useQuote(marketId: number | null, side: Side, amount: bigint, enabled: boolean) {
  const [shares, setShares] = useState<bigint | null>(null)

  useEffect(() => {
    if (!enabled || marketId === null || amount <= 0n) {
      setShares(null)
      return
    }
    let alive = true
    const handle = setTimeout(async () => {
      try {
        const out = (await publicClient.readContract({
          address: CLUTCH_ADDRESS,
          abi: clutchAbi,
          functionName: 'quoteBuy',
          args: [BigInt(marketId), side === 'yes', amount],
        })) as bigint
        if (alive) setShares(out)
      } catch {
        if (alive) setShares(null)
      }
    }, 300)
    return () => {
      alive = false
      clearTimeout(handle)
    }
  }, [marketId, side, amount, enabled])

  return shares
}

const pct = (n: number) => `${(n / 100).toFixed(1)}%`

export function BetPanel({
  market,
  question,
  timing,
  pYes,
  canBet,
  resolved,
  outcomeYes,
  busy,
  pending,
  error,
  stake,
  stakes,
  onStakeChange,
  onBet,
  onSell,
  onRedeem,
  yesShares,
  noShares,
  pnl,
  balance,
  trades,
  series,
  seededUpTo = 0,
}: BetPanelProps) {
  const [side, setSide] = useState<Side>('yes')
  const [mode, setMode] = useState<Mode>('buy')

  const amount = useMemo(() => {
    try {
      const n = Number(stake)
      return Number.isFinite(n) && n > 0 ? BigInt(Math.round(n * 1e18)) : 0n
    } catch {
      return 0n
    }
  }, [stake])

  const quoted = useQuote(market?.id ?? null, side, amount, mode === 'buy' && canBet)

  const held = side === 'yes' ? yesShares : noShares
  const hasPosition = yesShares > 0n || noShares > 0n

  // Winning shares redeem 1:1, so shares out *is* the payout.
  const profit = quoted !== null ? quoted - amount : null
  const roi = quoted !== null && amount > 0n ? Number((quoted * 10_000n) / amount) / 100 - 100 : null
  const avgPrice = quoted !== null && quoted > 0n ? Number((amount * 10_000n) / quoted) : null

  const marketTrades = useMemo(
    () => trades.filter((t) => market !== null && t.marketId === market.id).slice(0, 6),
    [trades, market]
  )

  const liquidity = market?.collateral ?? 0n
  const volume = market?.volume ?? 0n
  const traders = useMemo(
    () => new Set(trades.filter((t) => t.marketId === market?.id).map((t) => t.trader)).size,
    [trades, market?.id]
  )

  return (
    <div className="bp">
      <div className="bp-head">
        <p className="bp-q">{question ?? 'No market open yet'}</p>
        <p className="bp-timing">{timing}</p>
      </div>

      <PriceChart
        points={series}
        seededUpTo={seededUpTo}
        height={76}
        accent="var(--bp-yes-fill, var(--bp-yes))"
      />

      <div className="bp-stats">
        <div>
          <span>Volume</span>
          <strong className="nums">{fmtMon(volume, 3)}</strong>
        </div>
        <div>
          <span>Liquidity</span>
          <strong className="nums">{fmtMon(liquidity, 3)}</strong>
        </div>
        <div>
          <span>Traders</span>
          <strong className="nums">{traders}</strong>
        </div>
      </div>

      {resolved ? (
        <div className="bp-settled">
          <p>Settled</p>
          <strong className={outcomeYes ? 'is-yes' : 'is-no'}>{outcomeYes ? 'YES' : 'NO'}</strong>
          <button
            type="button"
            className="bp-submit"
            disabled={busy || !hasPosition}
            onClick={onRedeem}
          >
            {hasPosition ? 'Redeem winnings' : 'Nothing to redeem'}
          </button>
        </div>
      ) : (
        <>
          <div className="bp-mode">
            {(['buy', 'sell'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m ? 'is-active' : ''}
                onClick={() => setMode(m)}
                disabled={m === 'sell' && !hasPosition}
              >
                {m === 'buy' ? 'Buy' : 'Sell'}
              </button>
            ))}
          </div>

          <div className="bp-sides">
            <button
              type="button"
              className={`bp-side bp-yes ${side === 'yes' ? 'is-active' : ''}`}
              onClick={() => setSide('yes')}
            >
              <span>Yes</span>
              <strong className="nums">{pct(pYes)}</strong>
            </button>
            <button
              type="button"
              className={`bp-side bp-no ${side === 'no' ? 'is-active' : ''}`}
              onClick={() => setSide('no')}
            >
              <span>No</span>
              <strong className="nums">{pct(10_000 - pYes)}</strong>
            </button>
          </div>

          {mode === 'buy' ? (
            <>
              <div className="bp-amount">
                <label htmlFor="bp-stake">Amount</label>
                <input
                  id="bp-stake"
                  className="nums"
                  inputMode="decimal"
                  value={stake}
                  onChange={(e) => onStakeChange(e.target.value.replace(/[^0-9.]/g, ''))}
                />
                <span>MON</span>
              </div>

              <div className="bp-chips">
                {stakes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`nums ${stake === s ? 'is-active' : ''}`}
                    onClick={() => onStakeChange(s)}
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  className="nums"
                  onClick={() => onStakeChange(fmtMon((balance * 90n) / 100n, 3))}
                >
                  Max
                </button>
              </div>

              {/* The payout line is the whole point: it turns odds into money. */}
              <div className="bp-payout">
                <div>
                  <span>To win</span>
                  <strong className="nums is-yes">
                    {quoted !== null ? fmtMon(quoted, 4) : '—'} MON
                  </strong>
                </div>
                <div>
                  <span>Profit</span>
                  <strong className="nums">
                    {profit !== null
                      ? `${profit >= 0n ? '+' : ''}${fmtMon(profit, 4)}`
                      : '—'}
                    {roi !== null ? ` (${roi >= 0 ? '+' : ''}${roi.toFixed(0)}%)` : ''}
                  </strong>
                </div>
                <div>
                  <span>Avg price</span>
                  <strong className="nums">{avgPrice !== null ? pct(avgPrice) : '—'}</strong>
                </div>
              </div>

              <button
                type="button"
                className={`bp-submit ${side === 'yes' ? 'is-yes' : 'is-no'}`}
                disabled={!canBet || busy || amount <= 0n}
                onClick={() => onBet(side === 'yes')}
              >
                {busy ? (pending ?? 'Confirming…') : `Bet ${side.toUpperCase()} · ${stake} MON`}
              </button>
            </>
          ) : (
            <>
              <div className="bp-payout">
                <div>
                  <span>{side.toUpperCase()} shares</span>
                  <strong className="nums">{fmtMon(held, 4)}</strong>
                </div>
                <div>
                  <span>Value now</span>
                  <strong className="nums">
                    {fmtMon(
                      (held * BigInt(side === 'yes' ? pYes : 10_000 - pYes)) / 10_000n,
                      4
                    )}{' '}
                    MON
                  </strong>
                </div>
              </div>
              <button
                type="button"
                className="bp-submit is-no"
                disabled={busy || held === 0n}
                onClick={() => onSell(side === 'yes')}
              >
                {busy ? (pending ?? 'Confirming…') : `Cash out ${side.toUpperCase()}`}
              </button>
            </>
          )}
        </>
      )}

      <div className="bp-position">
        <div>
          <span>Your position</span>
          <strong className="nums">
            {fmtMon(yesShares, 3)} YES · {fmtMon(noShares, 3)} NO
          </strong>
        </div>
        <div>
          <span>P&amp;L</span>
          <strong className={`nums ${pnl > 0n ? 'is-yes' : pnl < 0n ? 'is-no' : ''}`}>
            {pnl >= 0n ? '+' : ''}
            {fmtMon(pnl, 4)} MON
          </strong>
        </div>
      </div>

      {error && <p className="bp-note is-error">{error}</p>}

      {marketTrades.length > 0 && (
        <div className="bp-activity">
          <p className="bp-activity-head">Activity</p>
          {marketTrades.map((t) => (
            <a
              key={t.key}
              className="bp-activity-row"
              href={txUrl(t.hash)}
              target="_blank"
              rel="noreferrer"
            >
              <span className="nums">{short(t.trader, 5, 3)}</span>
              <span className={t.isYes ? 'is-yes' : 'is-no'}>
                {t.isBuy ? 'bought' : 'sold'} {t.isYes ? 'YES' : 'NO'}
              </span>
              <span className="nums">{fmtMon(t.collateral, 3)}</span>
              <span className="nums bp-activity-price">{pct(t.priceBps)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
