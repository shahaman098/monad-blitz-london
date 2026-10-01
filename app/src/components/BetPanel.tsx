import { useEffect, useMemo, useState } from 'react'
import { PriceChart } from './PriceChart'
import { PortfolioChart } from './PortfolioChart'
import { clutchAbi } from '../lib/clutchAbi'
import { addrUrl, CLUTCH_ADDRESS, fmtMon, publicClient, short, txUrl } from '../lib/chain'
import type { Market, PricePoint, TradeEvent } from '../lib/useClutch'
import type { WalletTransaction } from '../lib/txHistory'

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
  trackedYesShares: bigint
  trackedNoShares: bigint
  costBasis: bigint
  positionValue: bigint
  pnl: bigint
  balance: bigint
  trades: TradeEvent[]
  series: PricePoint[]
  address: string
  walletTransactions: WalletTransaction[]
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
const TX_FEE_RESERVE = 60_000_000_000_000_000n

const activityTime = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

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
  trackedYesShares,
  trackedNoShares,
  costBasis,
  positionValue,
  pnl,
  balance,
  trades,
  series,
  address,
  walletTransactions,
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
  const hasTrackedPosition = trackedYesShares > 0n || trackedNoShares > 0n
  const cancelled = market?.status === 2
  const winningShares = cancelled
    ? trackedYesShares + trackedNoShares
    : outcomeYes
      ? trackedYesShares
      : trackedNoShares
  const losingShares = outcomeYes ? trackedNoShares : trackedYesShares
  const claimable = !market
    ? 0n
    : cancelled
      ? yesShares + noShares
      : outcomeYes
        ? yesShares
        : noShares
  const won = market?.status === 1 && winningShares > 0n
  const lost = market?.status === 1 && winningShares === 0n && losingShares > 0n

  // Winning shares redeem 1:1, so shares out *is* the payout.
  const profit = quoted !== null ? quoted - amount : null
  const roi = quoted !== null && amount > 0n ? Number((quoted * 10_000n) / amount) / 100 - 100 : null
  const avgPrice = quoted !== null && quoted > 0n ? Number((amount * 10_000n) / quoted) : null

  const marketTrades = useMemo(
    () => trades.filter((t) => market !== null && t.marketId === market.id).slice(0, 6),
    [trades, market]
  )

  const portfolioTransactions = useMemo(() => {
    const byHash = new Map<string, WalletTransaction>()
    for (const transaction of walletTransactions) byHash.set(transaction.hash, transaction)
    for (const trade of trades) {
      if (trade.trader.toLowerCase() !== address.toLowerCase()) continue
      const existing = byHash.get(trade.hash)
      byHash.set(trade.hash, {
        hash: trade.hash,
        label: `${trade.isBuy ? 'Bought' : 'Sold'} ${trade.isYes ? 'YES' : 'NO'}`,
        status: 'confirmed',
        submittedAt: trade.timestampMs ?? existing?.submittedAt ?? 0,
        marketId: trade.marketId,
      })
    }
    return [...byHash.values()].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 8)
  }, [address, trades, walletTransactions])

  const latestTransaction = portfolioTransactions[0] ?? null
  const marketTransactions = portfolioTransactions.filter((transaction) => transaction.marketId === market?.id)
  const hasConfirmedBet = marketTransactions.some(
    (transaction) => transaction.status === 'confirmed' && /Bought (YES|NO)/.test(transaction.label)
  ) || hasTrackedPosition
  const hasConfirmedPosition = hasTrackedPosition || hasPosition
  const redeemed = marketTransactions.some(
    (transaction) => transaction.status === 'confirmed' && transaction.label.startsWith('Redeemed')
  )
  const settlementTitle = cancelled
    ? 'Market cancelled'
    : won
      ? 'You won'
      : lost
        ? 'You lost'
        : 'Market settled'
  const settlementCopy = cancelled
    ? 'Both sides are refundable at 1:1.'
    : won
      ? `${outcomeYes ? 'YES' : 'NO'} finished as the winning side.`
      : lost
        ? `${outcomeYes ? 'YES' : 'NO'} won this market. Your opposing shares pay 0 MON.`
        : 'You did not hold a position when this market settled.'

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

      {market && (
        <ol className="bp-flow" aria-label="Betting progress">
          <li className={hasConfirmedBet ? 'is-complete' : 'is-current'}>
            <i>{hasConfirmedBet ? '✓' : '1'}</i>
            <span>{hasConfirmedBet ? 'Bet placed' : 'Place bet'}</span>
          </li>
          <li className={hasConfirmedPosition ? 'is-complete' : hasConfirmedBet ? 'is-current' : ''}>
            <i>{hasConfirmedPosition ? '✓' : '2'}</i>
            <span>{hasConfirmedPosition ? 'In portfolio' : 'Portfolio'}</span>
          </li>
          <li className={resolved ? 'is-complete' : hasConfirmedPosition ? 'is-current' : ''}>
            <i>{resolved ? '✓' : '3'}</i>
            <span>{resolved ? (cancelled ? 'Refund' : won ? 'Won' : lost ? 'Lost' : 'Settled') : 'Result'}</span>
          </li>
        </ol>
      )}

      {latestTransaction && (
        <a
          className={`bp-confirmation is-${latestTransaction.status}`}
          href={txUrl(latestTransaction.hash)}
          target="_blank"
          rel="noreferrer"
        >
          <span>
            {latestTransaction.status === 'confirmed'
              ? 'Confirmed on Monad'
              : latestTransaction.status === 'failed'
                ? 'Transaction failed'
                : 'Submitted · confirming'}
          </span>
          <strong>{latestTransaction.label}</strong>
          <small className="nums">{short(latestTransaction.hash, 8, 6)} · View receipt</small>
        </a>
      )}

      {market && (
        <>
          <PriceChart
            points={series}
            height={104}
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
        </>
      )}

      {!market ? (
        <div className="bp-coming-soon">
          <div className="bp-coming-kicker">
            <strong>Market coming soon</strong>
            <span>Watch-only clip</span>
          </div>
          <p>This question is queued for a future on-chain market. No voting is shown until trading is real.</p>
        </div>
      ) : resolved ? (
        <div className={`bp-settled ${won || cancelled ? 'is-win' : lost ? 'is-loss' : ''}`}>
          <div className="bp-result-icon" aria-hidden="true">{cancelled ? '↩' : won ? '✓' : lost ? '×' : '—'}</div>
          <div className="bp-result-copy">
            <p>{cancelled ? 'Refund' : `Final result · ${outcomeYes ? 'YES' : 'NO'}`}</p>
            <strong>{settlementTitle}</strong>
            <span>{settlementCopy}</span>
          </div>
          <div className="bp-result-stats">
            <div>
              <span>Cost</span>
              <strong className="nums">{fmtMon(costBasis, 4)} MON</strong>
            </div>
            <div>
              <span>{cancelled ? 'Refund' : 'Payout'}</span>
              <strong className="nums">{fmtMon(positionValue, 4)} MON</strong>
            </div>
            <div>
              <span>Final P&amp;L</span>
              <strong className={`nums ${pnl >= 0n ? 'is-yes' : 'is-no'}`}>
                {pnl >= 0n ? '+' : ''}{fmtMon(pnl, 4)} MON
              </strong>
            </div>
          </div>
          {claimable > 0n ? (
            <button type="button" className="bp-submit is-yes" disabled={busy} onClick={onRedeem}>
              {busy ? (pending ?? 'Confirming…') : `${cancelled ? 'Claim refund' : 'Redeem winnings'} · ${fmtMon(claimable, 4)} MON`}
            </button>
          ) : (
            <p className="bp-result-done">{redeemed ? 'Payout claimed on Monad' : lost ? 'No payout to claim' : 'Nothing to redeem'}</p>
          )}
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
                  onClick={() =>
                    onStakeChange(fmtMon(balance > TX_FEE_RESERVE ? balance - TX_FEE_RESERVE : 0n, 3))
                  }
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

      {market && (
        <>
          <div className="bp-position">
            <div>
              <span>Your shares</span>
              <strong className="nums">
                {fmtMon(resolved ? trackedYesShares : yesShares, 3)} YES · {fmtMon(resolved ? trackedNoShares : noShares, 3)} NO
              </strong>
            </div>
            <div>
              <span>{resolved ? 'Final payout' : 'Position value'}</span>
              <strong className="nums">{fmtMon(positionValue, 4)} MON</strong>
            </div>
            <div>
              <span>{resolved ? 'Final P&L' : 'Unrealized P&L'}</span>
              <strong className={`nums ${pnl > 0n ? 'is-yes' : pnl < 0n ? 'is-no' : ''}`}>
                {pnl >= 0n ? '+' : ''}{fmtMon(pnl, 4)} MON
              </strong>
            </div>
          </div>
          {hasTrackedPosition && (
            <PortfolioChart
              points={series}
              yesShares={trackedYesShares}
              noShares={trackedNoShares}
              costBasis={costBasis}
              currentValue={positionValue}
              settled={resolved}
            />
          )}
        </>
      )}

      {error && <p className="bp-note is-error">{error}</p>}

      <div className="bp-portfolio">
        <div className="bp-portfolio-head">
          <div>
            <strong>Your transactions</strong>
            <span>{portfolioTransactions.length} recorded on this wallet</span>
          </div>
          <a href={addrUrl(address)} target="_blank" rel="noreferrer">
            View wallet
          </a>
        </div>
        {portfolioTransactions.length > 0 ? (
          portfolioTransactions.map((transaction) => (
            <a
              key={transaction.hash}
              className="bp-portfolio-row"
              href={txUrl(transaction.hash)}
              target="_blank"
              rel="noreferrer"
            >
              <span className={`bp-status is-${transaction.status}`}>
                {transaction.status}
              </span>
              <strong>{transaction.label}</strong>
              <time className="nums">
                {transaction.submittedAt > 0
                  ? activityTime.format(new Date(transaction.submittedAt))
                  : 'On-chain'}
              </time>
              <small className="nums">
                {transaction.marketId === null ? 'Wallet funding' : `Market #${transaction.marketId}`} · {short(transaction.hash, 6, 5)} · Receipt ↗
              </small>
            </a>
          ))
        ) : (
          <p className="bp-portfolio-empty">Your submitted transactions will appear here.</p>
        )}
      </div>

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
              <time
                className="nums"
                dateTime={t.timestampMs === null ? undefined : new Date(t.timestampMs).toISOString()}
                title={
                  t.timestampMs === null
                    ? 'Block timestamp unavailable'
                    : new Date(t.timestampMs).toLocaleString()
                }
              >
                {t.timestampMs === null ? 'Pending' : activityTime.format(new Date(t.timestampMs))}
              </time>
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
