import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { parseEther } from 'viem'
import { DesktopFeed } from '../components/DesktopFeed'
import { clutchAbi } from '../lib/clutchAbi'
import { CLUTCH_ADDRESS, monadTestnet, publicClient } from '../lib/chain'
import { parseMarketPrompt } from '../lib/marketPrompt'
import { REELS } from '../lib/reels'
import {
  readWalletTransactions,
  writeWalletTransactions,
  type WalletTransaction,
  type WalletTransactionStatus,
} from '../lib/txHistory'
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
 * Monad also CHARGES the full limit, not gas used. A live first-time buyer
 * exhausted the former 200k ceiling, so 300k keeps safe execution headroom
 * while still allowing several room votes from a 0.2 MON starter balance.
 */
const TX_GAS = 300_000n
const TX_FEE_RESERVE = parseEther('0.06')

class ReceiptStillPendingError extends Error {}

async function waitForMonadReceipt(hash: `0x${string}`, attempts = 24) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await publicClient.getTransactionReceipt({ hash })
    } catch {
      // A freshly broadcast Monad transaction can briefly be unknown to a
      // different RPC in the fallback pool. That is pending, not a failure.
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw new ReceiptStillPendingError('Transaction is still confirming on Monad')
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
  const { markets, error: marketsError } = useMarkets()
  const [feedIndex, setFeedIndex] = useState(0)

  const routeMarket = useMemo(
    () => (id !== undefined ? markets.find((candidate) => candidate.id === Number(id)) ?? null : null),
    [id, markets]
  )
  const routeReel = useMemo(
    () => (routeMarket ? (parseMarketPrompt(routeMarket.question).reel ?? REELS[0]) : null),
    [routeMarket]
  )
  const feedReels = useMemo(() => {
    if (!routeReel) return REELS
    return [routeReel, ...REELS.filter((reel) => reel.id !== routeReel.id)]
  }, [routeReel])
  const visibleReel = feedReels[feedIndex] ?? feedReels[0] ?? null

  const marketByReelId = useMemo(() => {
    const mapped = new Map<string, Market>()
    for (const candidate of markets) {
      const reelId = parseMarketPrompt(candidate.question).reelId
      if (!reelId) continue
      const current = mapped.get(reelId)
      if (
        !current ||
        (isOpen(candidate) && !isOpen(current)) ||
        (isOpen(candidate) === isOpen(current) && candidate.id > current.id)
      ) {
        mapped.set(reelId, candidate)
      }
    }
    return mapped
  }, [markets])

  const market: Market | null = visibleReel
    ? routeMarket && routeReel?.id === visibleReel.id
      ? routeMarket
      : (marketByReelId.get(visibleReel.id) ?? null)
    : null

  const liveReelIds = useMemo(
    () =>
      markets
        .filter(isOpen)
        .map((candidate) => parseMarketPrompt(candidate.question).reelId)
        .filter((reelId): reelId is string => Boolean(reelId)),
    [markets]
  )

  const { yes, no, refresh } = usePosition(market?.id ?? null, account.address as `0x${string}`)
  // One log poller feeds both the activity list and the price chart.
  const { trades } = useTradeFeed(100, 100n, 1500, market?.id ?? null)
  const series = usePriceSeries(trades, market?.id ?? null, market)
  const [balance, setBalance] = useState(0n)
  const [stake, setStake] = useState<string>(STAKES[0])
  const [pending, setPending] = useState<null | string>(null)
  const [err, setErr] = useState<string | null>(null)
  const [liked, setLiked] = useState<Record<string, boolean>>(() => readBooleanMap('clutch.social.liked'))
  const [saved, setSaved] = useState<Record<string, boolean>>(() => readBooleanMap('clutch.social.saved'))
  const [followed, setFollowed] = useState<Record<string, boolean>>(() =>
    readBooleanMap('clutch.social.followed')
  )
  const [comments, setComments] = useState<Record<string, number>>(() =>
    readNumberMap('clutch.social.comments')
  )
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(() =>
    readWalletTransactions(account.address)
  )

  // Keep the presenter clock moving between contract-state polls. The close
  // timestamp still comes from Monad; this interval only refreshes its label.
  const [, setClockTick] = useState(0)
  useEffect(() => {
    if (!market || market.status !== 0 || market.closesAt === 0n) return
    const handle = window.setInterval(() => setClockTick((tick) => tick + 1), 1000)
    return () => window.clearInterval(handle)
  }, [market])

  const upsertWalletTransaction = useCallback(
    (transaction: WalletTransaction) => {
      setWalletTransactions((current) => {
        const next = [
          transaction,
          ...current.filter((item) => item.hash.toLowerCase() !== transaction.hash.toLowerCase()),
        ].slice(0, 30)
        writeWalletTransactions(account.address, next)
        return next
      })
    },
    [account.address]
  )

  const updateWalletTransaction = useCallback(
    (hash: `0x${string}`, status: WalletTransactionStatus) => {
      setWalletTransactions((current) => {
        const next = current.map((item) => (item.hash === hash ? { ...item, status } : item))
        writeWalletTransactions(account.address, next)
        return next
      })
    },
    [account.address]
  )

  useEffect(() => {
    const pendingTransactions = walletTransactions.filter((transaction) => transaction.status === 'pending')
    if (pendingTransactions.length === 0) return

    let alive = true
    const poll = async () => {
      for (const transaction of pendingTransactions) {
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash: transaction.hash })
          if (!alive) return
          updateWalletTransaction(
            transaction.hash,
            receipt.status === 'success' ? 'confirmed' : 'failed'
          )
        } catch {
          // Keep it pending. The next poll or page load will try again.
        }
      }
    }

    void poll()
    const handle = setInterval(poll, 3000)
    return () => {
      alive = false
      clearInterval(handle)
    }
  }, [walletTransactions, updateWalletTransaction])

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

  const changeFeedIndex = (next: number) => {
    setFeedIndex(next)
    setErr(null)
  }

  useEffect(() => {
    setFeedIndex(0)
  }, [feedReels.length, routeReel?.id])

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
    async (
      label: string,
      marketId: number | null,
      run: () => Promise<`0x${string}`>,
      onConfirmed?: () => void
    ) => {
      setErr(null)
      setPending(label)
      let submittedHash: `0x${string}` | null = null
      try {
        const hash = await run()
        submittedHash = hash
        upsertWalletTransaction({
          hash,
          label,
          status: 'pending',
          submittedAt: Date.now(),
          marketId,
        })
        const receipt = await waitForMonadReceipt(hash)
        if (receipt.status === 'reverted') {
          updateWalletTransaction(hash, 'failed')
          setErr('Transaction failed on Monad. No position was changed.')
          return
        }
        updateWalletTransaction(hash, 'confirmed')
        onConfirmed?.()
        await refresh()
      } catch (e) {
        if (submittedHash && e instanceof ReceiptStillPendingError) {
          // The transaction hash is durable and visible in Portfolio. Do not
          // turn temporary RPC propagation into a frightening failure state.
          return
        }
        // Full error to the console: the on-screen copy is deliberately short,
        // and during a live demo we need the real reason fast.
        console.error('[clutch] tx failed', e)
        setErr(readableTxError(e))
      } finally {
        setPending(null)
      }
    },
    [refresh, updateWalletTransaction, upsertWalletTransaction]
  )

  const buy = (isYes: boolean) => {
    if (!market) {
      setErr('This clip is watch-only until its market opens.')
      return
    }
    if (balance === 0n) {
      setErr('Out of testnet MON — tap Get testnet MON to fund this wallet.')
      return
    }
    const value = parseEther(stake)
    if (balance < value + TX_FEE_RESERVE) {
      setErr('Reduce the stake — keep at least 0.06 MON available for Monad gas.')
      return
    }
    const label = isYes ? 'Bought YES' : 'Bought NO'
    void send(label, market.id, async () => {
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
      return hash
    }, () => addBasis(account.address, market.id, value))
  }

  /** Cash out of a side at the live price — the market maker buys the shares back. */
  const sell = (isYes: boolean) => {
    if (!market) return
    const shares = isYes ? yes : no
    if (shares === 0n) return
    let collateralOut = 0n
    void send(`Sold ${isYes ? 'YES' : 'NO'}`, market.id, async () => {
      // Quote before selling: afterwards the reserves have already moved.
      collateralOut = (await publicClient.readContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'quoteSell',
        args: [BigInt(market.id), isYes, shares],
      })) as bigint
      const hash = await burnerWallet(account).writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'sell',
        args: [BigInt(market.id), isYes, shares, (collateralOut * 80n) / 100n],
        chain: monadTestnet,
        account,
        gas: TX_GAS,
      })
      return hash
    }, () => addBasis(account.address, market.id, -collateralOut))
  }

  /** Winning shares pay 1:1 once the host resolves. */
  const redeem = () => {
    if (!market) return
    void send(market.status === 2 ? 'Claimed refund' : 'Redeemed winnings', market.id, async () =>
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

  const fund = async (): Promise<boolean> => {
    setErr(null)
    setPending('Funding wallet')
    try {
      const result = await requestFunding(account.address)
      if (!result.ok) throw new Error(result.error ?? 'Funding failed')
      if (result.hash) {
        const hash = result.hash as `0x${string}`
        upsertWalletTransaction({
          hash,
          label: 'Funding received',
          status: 'pending',
          submittedAt: Date.now(),
          marketId: null,
        })
        try {
          const receipt = await waitForMonadReceipt(hash)
          updateWalletTransaction(hash, receipt.status === 'success' ? 'confirmed' : 'failed')
          if (receipt.status === 'reverted') throw new Error('Funding transaction failed')
        } catch (e) {
          if (!(e instanceof ReceiptStillPendingError)) throw e
        }
      }
      for (let i = 0; i < 40; i++) {
        const next = await publicClient.getBalance({ address: account.address })
        if (next > 0n) {
          setBalance(next)
          return true
        }
        await new Promise((r) => setTimeout(r, 400))
      }
      throw new Error('Funding did not land in time')
    } catch (e) {
      setErr(readableTxError(e))
      return false
    } finally {
      setPending(null)
    }
  }

  const liveValue = (yes * BigInt(pYes) + no * BigInt(10_000 - pYes)) / 10_000n
  const confirmedTradeBasis = useMemo(() => {
    if (!market) return null
    const walletTrades = trades.filter(
      (trade) =>
        trade.marketId === market.id && trade.trader.toLowerCase() === account.address.toLowerCase()
    )
    if (walletTrades.length === 0) return null
    return walletTrades.reduce(
      (total, trade) => total + (trade.isBuy ? trade.collateral : -trade.collateral),
      0n
    )
  }, [account.address, market, trades])
  const spent = confirmedTradeBasis ?? (market ? readBasis(account.address, market.id) : 0n)
  const historicalShares = useMemo(() => {
    if (!market) return { yes: 0n, no: 0n }
    return trades
      .filter(
        (trade) =>
          trade.marketId === market.id && trade.trader.toLowerCase() === account.address.toLowerCase()
      )
      .reduce(
        (position, trade) => {
          const delta = trade.isBuy ? trade.shares : -trade.shares
          if (trade.isYes) position.yes += delta
          else position.no += delta
          return position
        },
        { yes: 0n, no: 0n }
      )
  }, [account.address, market, trades])
  const trackedYes = historicalShares.yes > yes ? historicalShares.yes : yes
  const trackedNo = historicalShares.no > no ? historicalShares.no : no
  const settledValue = !market
    ? 0n
    : market.status === 2
      ? trackedYes + trackedNo
      : market.status === 1
        ? market.outcomeYes
          ? trackedYes
          : trackedNo
        : liveValue
  const positionValue = market?.status === 0 ? liveValue : settledValue
  const pnl = positionValue - spent
  const busy = pending !== null
  const canBet = Boolean(market && !resolved && !closed)
  const visibleQuestion = market
    ? (prompt?.question ?? visibleReel?.marketQuestion ?? null)
    : (visibleReel?.marketQuestion ?? null)

  // Audience and projector share one feed. /join provisions the burner first,
  // while host-only market setup stays isolated at /admin.
  const feed = {
    reels: feedReels.length > 0 ? feedReels : REELS,
    index: feedIndex,
    onIndexChange: changeFeedIndex,
    marketQuestion: visibleQuestion,
    marketTiming: market
      ? `Bet #${market.id} · ${marketTimingLabel(market)}`
      : marketsError
        ? 'Monad RPC is rate-limiting — betting reconnects automatically'
        : 'Market coming soon · no trading yet',
    pYes: market ? pYes : 5000,
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
    resolved: market ? resolved : false,
    outcomeYes: market?.outcomeYes ?? false,
    yesShares: market ? yes : 0n,
    noShares: market ? no : 0n,
    trackedYesShares: market ? trackedYes : 0n,
    trackedNoShares: market ? trackedNo : 0n,
    costBasis: market ? spent : 0n,
    positionValue: market ? positionValue : 0n,
    pnl: market ? pnl : 0n,
    trades,
    series: market ? series : [],
    balance,
    walletTransactions,
    liveReelIds,
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

  return <DesktopFeed {...feed} address={account.address} />
}
