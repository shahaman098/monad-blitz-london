import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { parseEther } from 'viem'
import { DesktopFeed } from '../components/DesktopFeed'
import { MobileFeed } from '../components/MobileFeed'
import { clutchAbi } from '../lib/clutchAbi'
import { CLUTCH_ADDRESS, monadTestnet, publicClient } from '../lib/chain'
import { parseMarketPrompt } from '../lib/marketPrompt'
import { REELS } from '../lib/reels'
import { burnerWallet, getBurner, requestFunding } from '../lib/wallet'
import {
  isOpen,
  marketTimingLabel,
  priceYesBps,
  useMarkets,
  usePosition,
  usePriceSeries,
  useTradeFeed,
  type Market,
} from '../lib/useClutch'

const STAKES = ['0.005', '0.01', '0.05'] as const

/**
 * Monad reserves `gasLimit * maxFeePerGas` from the sender before executing.
 * Without an explicit limit viem lets the node fall back to the block gas limit
 * (150,000,000), so the pre-flight check demands ~18 MON and every burner-funded
 * bet fails with "Signer had insufficient balance". Local chains do not reserve
 * this way, which is why Anvil never caught it.
 *
 * Monad also CHARGES the full limit, not gas used: a measured bet cost exactly
 * 200,000 * 102 gwei = 0.0204 MON even though `buy` uses ~125k. So this number
 * is a direct lever on how many bets a 0.2 MON burner gets (~7 at this limit).
 */
const TX_GAS = 200_000n

/** Net collateral this wallet has put into a market, for a truthful P&L. */
/** The three-column desktop layout only makes sense with real horizontal room. */
function useIsDesktop(minWidth = 1100) {
  const query = `(min-width: ${minWidth}px)`
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

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

function readBooleanMap(key: string): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

function readNumberMap(key: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function writeMap<T>(key: string, value: Record<string, T>) {
  localStorage.setItem(key, JSON.stringify(value))
}

/**
 * viem stacks the useful text below the first line, so `message.split('\n')[0]`
 * yields a dangling "reverted with the following reason:" and drops the reason.
 * Prefer the structured fields, and translate the one failure the room will
 * actually hit — an unfunded burner — into an instruction instead of a trace.
 */
function readableTxError(e: unknown): string {
  const err = e as { shortMessage?: string; details?: string; message?: string }
  const raw = `${err?.shortMessage ?? ''} ${err?.details ?? ''} ${err?.message ?? ''}`

  // Monad's node phrases this as "Signer had insufficient balance", not the
  // geth-style "insufficient funds", so match both.
  if (/insufficient (funds|balance)|exceeds the balance|gas \* price \+ value/i.test(raw)) {
    return 'Out of testnet MON — reopen the join link to top this wallet up.'
  }
  if (/user rejected|denied/i.test(raw)) return 'Transaction rejected.'
  if (/NotOpen/.test(raw)) return 'This bet is already closed.'
  if (/\bClosed\b/.test(raw)) return 'Betting on this market has closed.'
  if (/Slippage/.test(raw)) return 'Price moved too far — try again.'

  // Fall back to the first line that carries meaning. viem's shortMessage is
  // itself multi-line, so clean it the same way rather than trusting it whole.
  const lines = `${err?.shortMessage ?? err?.details ?? err?.message ?? ''}`
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/reverted with the following reason:?$/i.test(l))

  return (lines[lines.length - 1] ?? 'Transaction failed').slice(0, 160)
}

export default function Trade() {
  const { id } = useParams()
  const account = useMemo(() => getBurner(), [])
  const isDesktop = useIsDesktop()
  const { markets, live, error: marketsError } = useMarkets()

  const market: Market | null = useMemo(() => {
    if (id !== undefined) return markets.find((m) => m.id === Number(id)) ?? null
    return live
  }, [id, markets, live])

  const { yes, no, refresh } = usePosition(market?.id ?? null, account.address as `0x${string}`)
  // One log poller feeds both the activity list and the price chart.
  const { trades } = useTradeFeed(60, 900n, 1500)
  const { points: series, seededUpTo } = usePriceSeries(trades, market?.id ?? null, market)
  const [balance, setBalance] = useState(0n)
  const [stake, setStake] = useState<string>(STAKES[0])
  const [pending, setPending] = useState<null | string>(null)
  const [err, setErr] = useState<string | null>(null)
  const [feedIndex, setFeedIndex] = useState(0)
  const [liked, setLiked] = useState<Record<string, boolean>>(() => readBooleanMap('clutch.social.liked'))
  const [saved, setSaved] = useState<Record<string, boolean>>(() => readBooleanMap('clutch.social.saved'))
  const [followed, setFollowed] = useState<Record<string, boolean>>(() =>
    readBooleanMap('clutch.social.followed')
  )
  const [comments, setComments] = useState<Record<string, number>>(() =>
    readNumberMap('clutch.social.comments')
  )

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const b = await publicClient.getBalance({ address: account.address })
        if (alive) setBalance(b)
      } catch {
        // Keep the feed usable when public RPCs rate-limit balance reads.
      }
    }
    void tick()
    const handle = setInterval(tick, 8000)
    return () => {
      alive = false
      clearInterval(handle)
    }
  }, [account.address])

  const pYes = market ? priceYesBps(market) : 5000
  const resolved = market ? market.status !== 0 : false
  const closed = market ? market.status === 0 && !isOpen(market) : false
  const prompt = market ? parseMarketPrompt(market.question) : null
  const activeReel = market ? (prompt?.reel ?? REELS[0]) : null

  const feedReels = useMemo(() => {
    if (activeReel) {
      return [activeReel, ...REELS.filter((reel) => reel.id !== activeReel.id)]
    }
    return REELS
  }, [activeReel])

  useEffect(() => {
    setFeedIndex(0)
  }, [feedReels.length, activeReel?.id])

  const toggleBooleanMap = (
    key: string,
    setter: (next: Record<string, boolean>) => void,
    current: Record<string, boolean>,
    reelId: string
  ) => {
    const next = { ...current, [reelId]: !current[reelId] }
    setter(next)
    writeMap(key, next)
  }

  const bumpComment = (reelId: string) => {
    const next = { ...comments, [reelId]: (comments[reelId] ?? 0) + 1 }
    setComments(next)
    writeMap('clutch.social.comments', next)
  }

  const send = useCallback(
    async (label: string, run: () => Promise<`0x${string}`>) => {
      setErr(null)
      setPending(label)
      try {
        const hash = await run()
        await publicClient.waitForTransactionReceipt({ hash })
        await refresh()
      } catch (e) {
        // Full error to the console: the on-screen copy is deliberately short,
        // and during a live demo we need the real reason fast.
        console.error('[clutch] tx failed', e)
        setErr(readableTxError(e))
      } finally {
        setPending(null)
      }
    },
    [refresh]
  )

  const buy = (isYes: boolean) => {
    if (!market) return
    if (balance === 0n) {
      setErr('Out of testnet MON — tap Get testnet MON to fund this wallet.')
      return
    }
    const value = parseEther(stake)
    void send(isYes ? 'Betting YES' : 'Betting NO', async () => {
      const quoted = (await publicClient.readContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'quoteBuy',
        args: [BigInt(market.id), isYes, value],
      })) as bigint
      const minOut = (quoted * 80n) / 100n
      const hash = await burnerWallet(account).writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'buy',
        args: [BigInt(market.id), isYes, minOut],
        value,
        chain: monadTestnet,
        account,
        gas: TX_GAS,
      })
      addBasis(account.address, market.id, value)
      return hash
    })
  }

  /** Cash out of a side at the live price — the market maker buys the shares back. */
  const sell = (isYes: boolean) => {
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
        args: [BigInt(market.id), isYes, shares, (quoted * 80n) / 100n],
        chain: monadTestnet,
        account,
        gas: TX_GAS,
      })
      addBasis(account.address, market.id, -quoted)
      return hash
    })
  }

  /** Winning shares pay 1:1 once the host resolves. */
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
        gas: TX_GAS,
      })
    )
  }

  const fund = () => {
    void (async () => {
      setErr(null)
      setPending('Funding wallet')
      try {
        const result = await requestFunding(account.address)
        if (!result.ok) throw new Error(result.error ?? 'Funding failed')
        if (result.hash) {
          await publicClient.waitForTransactionReceipt({ hash: result.hash as `0x${string}` })
        }
        for (let i = 0; i < 40; i++) {
          const next = await publicClient.getBalance({ address: account.address })
          if (next > 0n) {
            setBalance(next)
            return
          }
          await new Promise((r) => setTimeout(r, 400))
        }
        throw new Error('Funding did not land in time')
      } catch (e) {
        setErr(readableTxError(e))
      } finally {
        setPending(null)
      }
    })()
  }

  const value = (yes * BigInt(pYes) + no * BigInt(10_000 - pYes)) / 10_000n
  const spent = market ? readBasis(account.address, market.id) : 0n
  const pnl = value - spent
  const busy = pending !== null
  const canBet = Boolean(market && !resolved && !closed)

  // Shared across both surfaces so a bet behaves identically on phone and projector.
  const feed = {
    reels: feedReels.length > 0 ? feedReels : REELS,
    index: feedIndex,
    onIndexChange: setFeedIndex,
    marketQuestion: prompt?.question ?? null,
    marketTiming: market
      ? `Bet #${market.id} · ${marketTimingLabel(market)}`
      : marketsError
        ? 'Monad RPC is rate-limiting — betting reconnects automatically'
        : 'Waiting for the host to open a bet',
    pYes,
    canBet,
    busy,
    pending,
    error: err,
    stake,
    stakes: STAKES,
    onStakeChange: setStake,
    onBet: buy,
    onSell: sell,
    onRedeem: redeem,
    onFund: fund,
    market,
    resolved,
    outcomeYes: market?.outcomeYes ?? false,
    yesShares: yes,
    noShares: no,
    pnl,
    trades,
    series,
    seededUpTo,
    balance,
    liked,
    saved,
    followed,
    extraComments: comments,
    onToggleLike: (reelId: string) =>
      toggleBooleanMap('clutch.social.liked', setLiked, liked, reelId),
    onToggleSave: (reelId: string) =>
      toggleBooleanMap('clutch.social.saved', setSaved, saved, reelId),
    onToggleFollow: (reelId: string) =>
      toggleBooleanMap('clutch.social.followed', setFollowed, followed, reelId),
    onComment: bumpComment,
  }

  // Only one surface mounts, so we never decode two video trees at once.
  if (!isDesktop) {
    const { onFund: _onFund, ...mobileProps } = feed
    return <MobileFeed {...mobileProps} />
  }

  return <DesktopFeed {...feed} address={account.address} />
}
