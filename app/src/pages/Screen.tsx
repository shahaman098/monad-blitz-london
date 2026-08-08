import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { SocialEmbed } from '../components/SocialEmbed'
import { CLUTCH_ADDRESS, addrUrl, fmtMon, hasContract, short, txUrl } from '../lib/chain'
import { parseMarketPrompt, type ParsedMarketPrompt } from '../lib/marketPrompt'
import { REELS } from '../lib/reels'
import {
  marketTimingLabel,
  priceYesBps,
  useBlockNumber,
  useMarkets,
  usePriceHistory,
  useTradeFeed,
} from '../lib/useClutch'

/** Sparkline of YES price in bps, 0-10000 mapped to the full height. */
function Chart({ history }: { history: number[] }) {
  if (history.length < 2) {
    return <div className="grid h-full place-items-center text-dim">waiting for trades...</div>
  }
  const pts = history.map((p, i) => {
    const x = (i / (history.length - 1)) * 100
    const y = 100 - (p / 10_000) * 100
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  const last = history[history.length - 1]
  const rising = last >= history[0]
  const stroke = rising ? 'var(--color-yes)' : 'var(--color-no)'

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.32" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1="50" x2="100" y2="50" stroke="var(--color-edge)" strokeWidth="0.4" />
      <polygon points={`0,100 ${pts.join(' ')} 100,100`} fill="url(#fade)" />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function MediaStage({ prompt }: { prompt: ParsedMarketPrompt | null }) {
  const reel = prompt?.reel ?? REELS[0]
  const fallback = !prompt?.reel

  return (
    <div className="media-stage">
      <SocialEmbed reel={reel} />
      <div className="media-stage-source">
        <strong>{reel.displayName}</strong>
        <span>
          {fallback ? 'demo reel fallback · ' : ''}
          Official {reel.platform} post · {reel.creator}
        </span>
      </div>
    </div>
  )
}

export default function Screen() {
  const { markets, live } = useMarkets(1500)
  const { trades, tps } = useTradeFeed(24)
  const block = useBlockNumber()
  const history = usePriceHistory(live)
  const [qr, setQr] = useState<string>('')

  const joinUrl = useMemo(() => window.location.origin, [])

  useEffect(() => {
    void QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 420,
      color: { dark: '#07090d', light: '#ffffff' },
    }).then(setQr)
  }, [joinUrl])

  const pYes = live ? priceYesBps(live) : 5000
  const livePrompt = live ? parseMarketPrompt(live.question) : null
  const traders = useMemo(() => new Set(trades.map((t) => t.trader.toLowerCase())).size, [trades])
  const volume = useMemo(() => markets.reduce((acc, m) => acc + m.volume, 0n), [markets])

  return (
    <main className="page-shell screen-shell">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Live room bet</p>
          <h1>CLUTCH</h1>
          <p className="screen-subtitle">
            real-time betting on creator traction
          </p>
        </div>
        <div className="screen-header-right">
          <span className="screen-pill nums">
            block <strong>{block?.toString() ?? '---'}</strong>
          </span>
          <span className={`screen-pill nums ${tps > 0 ? 'is-live' : ''}`}>
            {tps.toFixed(1)} bets/sec
          </span>
        </div>
      </header>

      {!hasContract && (
        <p className="system-error text-sm">
          Set <code>VITE_CLUTCH_ADDRESS</code> in <code>.env</code> and restart.
        </p>
      )}

      <div className="screen-grid">
        <section className="section-card arena-card">
          <div className="arena-status">
            <div>
              <p className="eyebrow">Current question</p>
              <p className="arena-question">{livePrompt?.question ?? 'No bet live'}</p>
              <p className="arena-note">
                {live
                  ? `${marketTimingLabel(live)} · every bet is a real Monad testnet fill`
                  : 'Create a reel bet from the host console.'}
              </p>
            </div>
            <div className="arena-badge nums">{markets.length} bets in rotation</div>
          </div>

          <MediaStage prompt={livePrompt} />

          <div className="arena-prices">
            <div className="arena-side arena-side--yes">
              <p className="arena-side-label">YES</p>
              <strong className="nums">
                {(pYes / 100).toFixed(0)}
                <span>c</span>
              </strong>
            </div>
            <div className="arena-side arena-side--no">
              <p className="arena-side-label">NO</p>
              <strong className="nums">
                {((10_000 - pYes) / 100).toFixed(0)}
                <span>c</span>
              </strong>
            </div>
          </div>

          <div className="arena-meter">
            <div className="arena-meter-rail">
              <div className="arena-meter-fill" style={{ width: `${pYes / 100}%` }} />
            </div>
            <div className="arena-meter-copy nums">
              <span>YES conviction {pYes.toFixed(0)} bps</span>
              <span>NO conviction {(10_000 - pYes).toFixed(0)} bps</span>
            </div>
          </div>

          <div className="arena-chart-card">
            <Chart history={history} />
          </div>

          <div className="arena-stats">
            <Stat label="Bet volume" value={`${fmtMon(volume, 2)} MON`} />
            <Stat label="Active bettors" value={traders.toString()} />
            <Stat label="Live contract" value={CLUTCH_ADDRESS ? short(CLUTCH_ADDRESS, 6, 4) : 'unset'} />
          </div>
        </section>

        <aside className="screen-rail">
          <section className="section-card qr-card">
            <p className="eyebrow text-[#865300]">Bet the reel</p>
            <div className="qr-frame">{qr && <img src={qr} alt="Join Clutch" className="mx-auto w-full max-w-[240px]" />}</div>
            <p className="qr-copy">
              <strong>Scan to bet</strong>
              <span className="nums">{joinUrl.replace(/^https?:\/\//, '')}</span>
            </p>
          </section>

          <section className="section-card feed-card">
            <p className="panel-heading">Live bets</p>
            <div className="feed-list">
              {trades.length === 0 && <div className="text-sm text-dim">no bets yet</div>}
              {trades.map((t) => (
                <div key={t.key} className="feed-item flash-in">
                  <span className={`feed-item-side ${t.isYes ? 'is-yes' : 'is-no'}`}>
                    {t.isBuy ? '+' : '-'}
                    {t.isYes ? 'YES' : 'NO'}
                  </span>
                  <div className="feed-item-copy">
                    <strong className="nums">{short(t.trader, 5, 3)}</strong>
                    <span>{fmtMon(t.collateral, 3)} MON</span>
                  </div>
                  <a
                    href={txUrl(t.hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="feed-item-link nums"
                  >
                    view tx
                  </a>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <footer className="screen-footer">
        <a href={addrUrl(CLUTCH_ADDRESS)} target="_blank" rel="noreferrer" className="nums">
          {CLUTCH_ADDRESS || 'contract not set'} ↗
        </a>
        <span>viral momentum, priced live and settled on Monad testnet</span>
      </footer>
    </main>
  )
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="arena-stat">
    <p className="arena-stat-label">{label}</p>
    <p className="arena-stat-value nums">{value}</p>
  </div>
)
