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
        <p className="rounded-xl border border-no/40 bg-no/10 p-4 text-sm text-no">
          {marketsError}
        </p>
      </Shell>
    )
  }

  if (!market) {
    return (
      <Shell>
        <p className="text-dim">Waiting for the next market to open…</p>
      </Shell>
    )
  }

  return (
    <Shell>
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-dim">
          Market #{market.id} · {resolved ? 'Resolved' : 'Live'}
        </p>
        <h1 className="text-2xl font-bold leading-tight text-balance">{market.question}</h1>
      </header>

      {resolved ? (
        <div className="rounded-2xl border border-edge bg-panel p-6 text-center">
          <p className="text-sm uppercase tracking-widest text-dim">Settled</p>
          <p className={`mt-1 text-4xl font-black ${market.outcomeYes ? 'text-yes' : 'text-no'}`}>
            {market.status === 2 ? 'CANCELLED' : market.outcomeYes ? 'YES' : 'NO'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
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

          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-dim">Stake per tap</p>
            <div className="grid grid-cols-3 gap-2">
              {STAKES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStake(s)}
                  className={`nums rounded-lg border py-3 text-sm font-semibold transition ${
                    stake === s ? 'border-white bg-white text-ink' : 'border-edge text-dim'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <section className="space-y-2 rounded-2xl border border-edge bg-panel p-4 text-sm">
        <Row label="YES shares" value={`${fmtMon(yes)}`} />
        <Row label="NO shares" value={`${fmtMon(no)}`} />
        <Row label="Position value" value={`${fmtMon(value)} MON`} />
        <Row
          label="P&L"
          value={`${pnl >= 0n ? '+' : ''}${fmtMon(pnl)} MON`}
          tone={pnl > 0n ? 'yes' : pnl < 0n ? 'no' : undefined}
        />
      </section>

      {!resolved && (yes > 0n || no > 0n) && (
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={busy || yes === 0n}
            onClick={() => cashOut(true)}
            className="rounded-lg border border-edge py-3 text-sm font-semibold disabled:opacity-30"
          >
            Cash out YES
          </button>
          <button
            disabled={busy || no === 0n}
            onClick={() => cashOut(false)}
            className="rounded-lg border border-edge py-3 text-sm font-semibold disabled:opacity-30"
          >
            Cash out NO
          </button>
        </div>
      )}

      {resolved && (
        <button
          disabled={busy}
          onClick={redeem}
          className="w-full rounded-xl bg-yes py-4 text-lg font-bold text-ink disabled:opacity-30"
        >
          Redeem winnings
        </button>
      )}

      {busy && (
        <p className="flash-in text-center text-sm text-dim">{pending}… confirming on Monad</p>
      )}
      {err && (
        <p className="break-words rounded-lg border border-no/40 bg-no/10 p-3 text-xs text-no">
          {err}
        </p>
      )}

      <footer className="space-y-1 border-t border-edge pt-4 text-xs text-dim">
        <div className="flex justify-between">
          <span>{short(account.address)}</span>
          <span className="nums">{fmtMon(balance)} MON</span>
        </div>
        {lastHash && (
          <a
            href={txUrl(lastHash)}
            target="_blank"
            rel="noreferrer"
            className="block underline decoration-dotted"
          >
            Last trade on MonadScan ↗
          </a>
        )}
      </footer>
    </Shell>
  )
}

const Shell = ({ children }: { children: ReactNode }) => (
  <main className="mx-auto flex min-h-full max-w-md flex-col gap-5 px-5 py-8">{children}</main>
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
  <div className="flex justify-between">
    <span className="text-dim">{label}</span>
    <span
      className={`nums font-semibold ${tone === 'yes' ? 'text-yes' : tone === 'no' ? 'text-no' : ''}`}
    >
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
    className={`rounded-2xl border-2 py-8 transition active:scale-[0.98] disabled:opacity-40 ${
      tone === 'yes' ? 'border-yes/50 bg-yes/10' : 'border-no/50 bg-no/10'
    }`}
  >
    <div className={`text-sm font-bold tracking-widest ${tone === 'yes' ? 'text-yes' : 'text-no'}`}>
      {side}
    </div>
    <div className="nums mt-1 text-5xl font-black">{(bps / 100).toFixed(0)}</div>
    <div className="text-xs text-dim">cents</div>
  </button>
)
