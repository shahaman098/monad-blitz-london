import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { parseEther } from 'viem'
import { clutchAbi } from '../lib/clutchAbi'
import { CLUTCH_ADDRESS, fmtMon, monadTestnet, publicClient, short, txUrl } from '../lib/chain'
import { burnerWallet, getBurner } from '../lib/wallet'
import { priceYesBps, useMarkets, usePosition, type Market } from '../lib/useClutch'

const STAKES = ['0.005', '0.01', '0.05'] as const

/** Net collateral this wallet has put into a market, for a truthful P&L. */
function basisKey(addr: string, id: number) {
  return `clutch.basis.${addr.toLowerCase()}.${id}`
}
function readBasis(addr: string, id: number): bigint {
  try {
    return BigInt(localStorage.getItem(basisKey(addr, id)) ?? '0')
  } catch {
    return 0n
  }
}
function addBasis(addr: string, id: number, delta: bigint) {
  localStorage.setItem(basisKey(addr, id), (readBasis(addr, id) + delta).toString())
}

export default function Trade() {
  const { id } = useParams()
  const account = useMemo(() => getBurner(), [])
  const { markets, live, error: marketsError } = useMarkets()

  const market: Market | null = useMemo(() => {
    if (id !== undefined) return markets.find((m) => m.id === Number(id)) ?? null
    return live
  }, [id, markets, live])

  const { yes, no, refresh } = usePosition(market?.id ?? null, account.address as `0x${string}`)
  const [balance, setBalance] = useState(0n)
  const [stake, setStake] = useState<string>(STAKES[1])
  const [pending, setPending] = useState<null | string>(null)
  const [lastHash, setLastHash] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      const b = await publicClient.getBalance({ address: account.address })
      if (alive) setBalance(b)
    }
    void tick()
    const handle = setInterval(tick, 1200)
    return () => {
      alive = false
      clearInterval(handle)
    }
  }, [account.address])

  const pYes = market ? priceYesBps(market) : 5000
  const resolved = market ? market.status !== 0 : false

  const send = useCallback(
    async (label: string, run: () => Promise<`0x${string}`>) => {
      setErr(null)
      setPending(label)
      try {
        const hash = await run()
        setLastHash(hash)
        await publicClient.waitForTransactionReceipt({ hash })
        await refresh()
      } catch (e) {
        const msg = (e as Error).message
        setErr(msg.split('\n')[0].slice(0, 160))
      } finally {
        setPending(null)
      }
    },
    [refresh]
  )

  const buy = (isYes: boolean) => {
    if (!market) return
    const value = parseEther(stake)
    void send(isYes ? 'Buying YES' : 'Buying NO', async () => {
      const quoted = (await publicClient.readContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'quoteBuy',
        args: [BigInt(market.id), isYes, value],
      })) as bigint
      // Generous tolerance: a room trading at once moves the price, and a
      // reverted trade is a worse demo than a slightly worse fill.
      const minOut = (quoted * 80n) / 100n
      const hash = await burnerWallet(account).writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'buy',
        args: [BigInt(market.id), isYes, minOut],
        value,
        chain: monadTestnet,
        account,
      })
      addBasis(account.address, market.id, value)
      return hash
    })
  }

  const cashOut = (isYes: boolean) => {
    if (!market) return
    const shares = isYes ? yes : no
    if (shares === 0n) return
    void send('Cashing out', async () => {
      // Quote before selling: afterwards the reserves have already moved.
      const quoted = (await publicClient.readContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'quoteSell',
        args: [BigInt(market.id), isYes, shares],
      })) as bigint
      const hash = await burnerWallet(account).writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'sell',
        args: [BigInt(market.id), isYes, shares, 0n],
        chain: monadTestnet,
        account,
      })
      addBasis(account.address, market.id, -quoted)
      return hash
    })
  }

  const redeem = () => {
    if (!market) return
    void send('Redeeming', async () =>
      burnerWallet(account).writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'redeem',
        args: [BigInt(market.id)],
        chain: monadTestnet,
        account,
      })
    )
  }

  // Mark to market at the current pool price.
  const value = (yes * BigInt(pYes) + no * BigInt(10_000 - pYes)) / 10_000n
  const spent = market ? readBasis(account.address, market.id) : 0n
  const pnl = value - spent
  const busy = pending !== null

  if (marketsError) {
    return (
      <Shell>
        <p className="system-error text-sm">{marketsError}</p>
      </Shell>
    )
  }

  if (!market) {
    return (
      <Shell>
        <section className="section-card trade-hero">
          <p className="eyebrow">Market feed</p>
          <h1 className="trade-title">Waiting for the next market to open...</h1>
          <p className="trade-subtitle">
            The phone will route straight into the live question as soon as the host opens it.
          </p>
        </section>
      </Shell>
    )
  }

  return (
    <Shell>
      <section className="section-card trade-hero">
        <div className="trade-topline">
          <p className="trade-wording">
            Market #{market.id} · {resolved ? 'Resolved' : 'Live'}
          </p>
          <div className="trade-balance-pill">
            Wallet <span className="nums">{fmtMon(balance)} MON</span>
          </div>
        </div>
        <h1 className="trade-title">{market.question}</h1>
        <p className="trade-subtitle">
          Tap a side, take the current price, and watch the market reprice onchain in real time.
        </p>
      </section>

      {resolved ? (
        <div className="section-card trade-panel text-center">
          <p className="panel-heading">Settled market</p>
          <p className={`mt-1 text-4xl font-black ${market.outcomeYes ? 'text-yes' : 'text-no'}`}>
            {market.status === 2 ? 'CANCELLED' : market.outcomeYes ? 'YES' : 'NO'}
          </p>
        </div>
      ) : (
        <>
          <div className="trade-price-grid">
            <PriceButton
              side="YES"
              bps={pYes}
              tone="yes"
              disabled={busy}
              onClick={() => buy(true)}
            />
            <PriceButton
              side="NO"
              bps={10_000 - pYes}
              tone="no"
              disabled={busy}
              onClick={() => buy(false)}
            />
          </div>

          <section className="section-card trade-meter-card">
            <p className="trade-meter-label">Market pressure</p>
            <div className="trade-meter-rail">
              <div className="trade-meter-fill" style={{ width: `${pYes / 100}%` }} />
            </div>
            <div className="trade-meter-copy nums">
              <span>YES {(pYes / 100).toFixed(0)}c</span>
              <span>NO {((10_000 - pYes) / 100).toFixed(0)}c</span>
            </div>
          </section>

          <section className="section-card trade-panel">
            <p className="panel-heading">Stake per tap</p>
            <div className="trade-chip-grid">
              {STAKES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStake(s)}
                  className={`chip-button nums ${stake === s ? 'is-active' : ''}`}
                >
                  <strong>{s}</strong>
                  <span>MON</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="section-card trade-panel text-sm">
        <p className="panel-heading">Your position</p>
        <Row label="YES shares" value={`${fmtMon(yes)}`} />
        <Row label="NO shares" value={`${fmtMon(no)}`} />
        <Row label="Marked value" value={`${fmtMon(value)} MON`} />
        <Row
          label="P&L"
          value={`${pnl >= 0n ? '+' : ''}${fmtMon(pnl)} MON`}
          tone={pnl > 0n ? 'yes' : pnl < 0n ? 'no' : undefined}
        />
      </section>

      {!resolved && (yes > 0n || no > 0n) && (
        <div className="trade-actions">
          <button
            disabled={busy || yes === 0n}
            onClick={() => cashOut(true)}
            className="trade-secondary"
          >
            Cash out YES
          </button>
          <button
            disabled={busy || no === 0n}
            onClick={() => cashOut(false)}
            className="trade-secondary"
          >
            Cash out NO
          </button>
        </div>
      )}

      {resolved && (
        <button
          disabled={busy}
          onClick={redeem}
          className="cta-button cta-button--yes w-full text-lg"
        >
          Redeem winnings
        </button>
      )}

      {busy && <p className="flash-in status-message">{pending}... confirming on Monad</p>}
      {err && <p className="trade-error break-words text-xs">{err}</p>}

      <footer className="trade-footer">
        <div className="trade-footer-row">
          <span>{short(account.address)}</span>
          <span className="nums">{fmtMon(balance)} MON</span>
        </div>
        {lastHash && (
          <a href={txUrl(lastHash)} target="_blank" rel="noreferrer" className="trade-link">
            Last trade on MonadScan ↗
          </a>
        )}
      </footer>
    </Shell>
  )
}

const Shell = ({ children }: { children: ReactNode }) => (
  <main className="page-shell trade-shell">{children}</main>
)

const Row = ({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'yes' | 'no'
}) => (
  <div className="trade-row">
    <span className="trade-row-label">{label}</span>
    <span className={`trade-row-value nums ${tone === 'yes' ? 'text-yes' : tone === 'no' ? 'text-no' : ''}`}>
      {value}
    </span>
  </div>
)

const PriceButton = ({
  side,
  bps,
  tone,
  disabled,
  onClick,
}: {
  side: string
  bps: number
  tone: 'yes' | 'no'
  disabled: boolean
  onClick: () => void
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`trade-price-card active:scale-[0.985] disabled:opacity-40 ${
      tone === 'yes' ? 'trade-price-card--yes is-yes-live' : 'trade-price-card--no is-no-live'
    }`}
  >
    <div className="trade-side">{side}</div>
    <div className="trade-odds nums">
      <strong>{(bps / 100).toFixed(0)}</strong>
      <span>cents</span>
    </div>
    <div className="trade-cta-copy">Tap to buy {side} at the live price</div>
  </button>
)
