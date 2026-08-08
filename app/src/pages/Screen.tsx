import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { CLUTCH_ADDRESS, addrUrl, fmtMon, hasContract, short, txUrl } from '../lib/chain'
import {
  priceYesBps,
  useBlockNumber,
  useMarkets,
  usePriceHistory,
  useTradeFeed,
} from '../lib/useClutch'

/** Sparkline of YES price in bps, 0–10000 mapped to the full height. */
function Chart({ history }: { history: number[] }) {
  if (history.length < 2) {
    return <div className="grid h-full place-items-center text-dim">waiting for trades…</div>
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
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1="50" x2="100" y2="50" stroke="var(--color-edge)" strokeWidth="0.4" />
      <polygon points={`0,100 ${pts.join(' ')} 100,100`} fill="url(#fade)" />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default function Screen() {
  const { markets, live } = useMarkets(500)
  const { trades, tps } = useTradeFeed(24)
  const block = useBlockNumber()
  const history = usePriceHistory(live)
  const [qr, setQr] = useState<string>('')

  const joinUrl = useMemo(() => window.location.origin, [])

  useEffect(() => {
    void QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 420,
      color: { dark: '#06070a', light: '#ffffff' },
    }).then(setQr)
  }, [joinUrl])

  const pYes = live ? priceYesBps(live) : 5000
  const traders = useMemo(() => new Set(trades.map((t) => t.trader.toLowerCase())).size, [trades])
  const volume = useMemo(() => markets.reduce((acc, m) => acc + m.volume, 0n), [markets])

  return (
    <main className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="text-4xl font-black tracking-tighter">CLUTCH</h1>
          <p className="text-dim">in-play markets · Monad testnet</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span className="nums text-dim">
            block <span className="text-white">{block?.toString() ?? '—'}</span>
          </span>
          <span
            className={`nums rounded-full border px-4 py-1.5 font-bold ${
              tps > 0 ? 'border-yes/60 bg-yes/10 text-yes' : 'border-edge text-dim'
            }`}
          >
            {tps.toFixed(1)} trades/sec
          </span>
        </div>
      </header>

      {!hasContract && (
        <p className="rounded-xl border border-no/40 bg-no/10 p-4 text-no">
          Set <code>VITE_CLUTCH_ADDRESS</code> in <code>.env</code> and restart.
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[1.9fr_1fr] gap-4">
        <section className="flex min-h-0 flex-col gap-4 rounded-3xl border border-edge bg-panel p-7">
          <p className="text-3xl font-bold leading-tight text-balance">
            {live?.question ?? 'No market open'}
          </p>

          <div className="flex items-end gap-10">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-yes">YES</p>
              <p className="nums text-8xl font-black leading-none text-yes">
                {(pYes / 100).toFixed(0)}
                <span className="text-3xl">¢</span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-no">NO</p>
              <p className="nums text-8xl font-black leading-none text-no">
                {((10_000 - pYes) / 100).toFixed(0)}
                <span className="text-3xl">¢</span>
              </p>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-no">
            <div
              className="h-full rounded-full bg-yes transition-all duration-300"
              style={{ width: `${pYes / 100}%` }}
            />
          </div>

          <div className="min-h-0 flex-1">
            <Chart history={history} />
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-edge pt-4">
            <Stat label="Volume traded" value={`${fmtMon(volume, 2)} MON`} />
            <Stat label="Traders in room" value={traders.toString()} />
            <Stat label="Markets" value={markets.length.toString()} />
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-4">
          <div className="rounded-3xl border border-edge bg-white p-4 text-center">
            {qr && <img src={qr} alt="Join Clutch" className="mx-auto w-full max-w-[220px]" />}
            <p className="mt-2 text-sm font-bold text-ink">Scan to trade</p>
            <p className="nums text-xs text-ink/60">{joinUrl.replace(/^https?:\/\//, '')}</p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-edge bg-panel p-4">
            <p className="mb-2 text-xs uppercase tracking-widest text-dim">Live trades</p>
            <ul className="min-h-0 flex-1 space-y-1 overflow-hidden">
              {trades.length === 0 && <li className="text-sm text-dim">no trades yet</li>}
              {trades.map((t) => (
                <li
                  key={t.key}
                  className="flash-in flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm odd:bg-white/[0.02]"
                >
                  <span className="nums text-dim">{short(t.trader, 5, 3)}</span>
                  <span
                    className={`font-bold ${t.isYes ? 'text-yes' : 'text-no'}`}
                  >{`${t.isBuy ? '+' : '−'}${t.isYes ? 'YES' : 'NO'}`}</span>
                  <a
                    href={txUrl(t.hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="nums text-dim underline decoration-dotted"
                  >
                    {fmtMon(t.collateral, 3)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <footer className="flex justify-between text-xs text-dim">
        <a
          href={addrUrl(CLUTCH_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="nums underline decoration-dotted"
        >
          {CLUTCH_ADDRESS || 'contract not set'} ↗
        </a>
        <span>every trade is a real Monad testnet transaction</span>
      </footer>
    </main>
  )
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs uppercase tracking-widest text-dim">{label}</p>
    <p className="nums text-2xl font-bold">{value}</p>
  </div>
)
