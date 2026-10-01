import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { decodeEventLog, type Log } from 'viem'
import { clutchAbi } from './clutchAbi'
import { CLUTCH_ADDRESS, hasContract, publicClient } from './chain'

export type Market = {
  id: number
  question: string
  creator: `0x${string}`
  closesAt: bigint
  resYes: bigint
  resNo: bigint
  collateral: bigint
  volume: bigint
  status: number // 0 open, 1 resolved, 2 cancelled
  outcomeYes: boolean
  poolRedeemed: boolean
}

export type TradeEvent = {
  key: string
  marketId: number
  trader: `0x${string}`
  isYes: boolean
  isBuy: boolean
  collateral: bigint
  shares: bigint
  /** Pool reserves *after* this trade — lets us rebuild real price history. */
  resYes: bigint
  resNo: bigint
  priceBps: number
  hash: `0x${string}`
  blockNumber: bigint
  /** Unix milliseconds from the Monad block containing the trade. */
  timestampMs: number | null
}

export const priceYesBps = (m: Pick<Market, 'resYes' | 'resNo'>): number => {
  const total = m.resYes + m.resNo
  if (total === 0n) return 5000
  return Number((m.resNo * 10_000n) / total)
}

export const isOpen = (m: Market) =>
  m.status === 0 && (m.closesAt === 0n || BigInt(Math.floor(Date.now() / 1000)) < m.closesAt)

export const marketTimingLabel = (m: Pick<Market, 'closesAt' | 'status'>): string => {
  if (m.status === 1) return 'resolved'
  if (m.status === 2) return 'cancelled · refunds available'
  if (m.closesAt === 0n) return 'open until host resolves'
  const secondsLeft = Number(m.closesAt - BigInt(Math.floor(Date.now() / 1000)))
  if (secondsLeft <= 0) return 'closed for trading'
  const seconds = secondsLeft % 60
  const minutes = Math.floor(secondsLeft / 60) % 60
  const hours = Math.floor(secondsLeft / 3600)
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} left`
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} left`
}

const base = { address: CLUTCH_ADDRESS, abi: clutchAbi } as const

/** Polls every market on the contract via Multicall3 to avoid N+1 RPC pressure. */
export function useMarkets(intervalMs = 2500) {
  const [markets, setMarkets] = useState<Market[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!hasContract) {
      setError('VITE_CLUTCH_ADDRESS is not set')
      setLoaded(true)
      return
    }
    let alive = true

    const tick = async () => {
      try {
        const count = (await publicClient.readContract({
          ...base,
          functionName: 'marketCount',
        })) as bigint

        if (count === 0n) {
          if (!alive) return
          setMarkets([])
          setError(null)
          return
        }

        const raw = await publicClient.multicall({
          allowFailure: false,
          contracts: Array.from({ length: Number(count) }, (_, i) => ({
            ...base,
            functionName: 'getMarket',
            args: [BigInt(i)] as const,
          })),
        })
        if (!alive) return
        setMarkets(raw.map((m, id) => ({ id, ...((m as unknown) as Omit<Market, 'id'>) })))
        setError(null)
      } catch (e) {
        if (alive) setError((e as Error).message)
      } finally {
        if (alive) setLoaded(true)
      }
    }

    void tick()
    const handle = setInterval(tick, intervalMs)
    return () => {
      alive = false
      clearInterval(handle)
    }
  }, [intervalMs])

  /** The market the room is trading right now: newest still-open market. */
  const live = useMemo(() => {
    const open = markets.filter(isOpen)
    return open.length ? open[open.length - 1] : (markets[markets.length - 1] ?? null)
  }, [markets])

  return { markets, live, error, loaded }
}

/**
 * Trade feed via explicit getLogs polling. Deliberately not eth_newFilter —
 * filter support varies by RPC and a dead feed would kill the demo.
 */
const blockTimestampCache = new Map<bigint, number>()
const blockTimestampPending = new Map<bigint, Promise<number>>()

async function getBlockTimestamp(blockNumber: bigint): Promise<number> {
  const cached = blockTimestampCache.get(blockNumber)
  if (cached !== undefined) return cached

  const pending = blockTimestampPending.get(blockNumber)
  if (pending) return pending

  const request = publicClient
    .getBlock({ blockNumber, includeTransactions: false })
    .then((block) => {
      const timestampMs = Number(block.timestamp) * 1000
      blockTimestampCache.set(blockNumber, timestampMs)
      return timestampMs
    })
    .finally(() => blockTimestampPending.delete(blockNumber))

  blockTimestampPending.set(blockNumber, request)
  return request
}

async function attachBlockTimes(events: TradeEvent[], concurrency = 4): Promise<TradeEvent[]> {
  const blocks = [
    ...new Set(
      events.filter((event) => event.timestampMs === null).map((event) => event.blockNumber)
    ),
  ]
  const timestamps = new Map<bigint, number>()

  // Keep the relay below public RPC burst limits while hydrating old history.
  for (let i = 0; i < blocks.length; i += concurrency) {
    await Promise.all(
      blocks.slice(i, i + concurrency).map(async (blockNumber) => {
        try {
          timestamps.set(blockNumber, await getBlockTimestamp(blockNumber))
        } catch {
          // The trade remains useful even if one block-time lookup is throttled.
        }
      })
    )
  }

  return events.map((event) => ({
    ...event,
    timestampMs: event.timestampMs ?? timestamps.get(event.blockNumber) ?? null,
  }))
}

function decodeTradeLogs(logs: Log[]): TradeEvent[] {
  const decoded: TradeEvent[] = []
  for (const log of logs) {
    try {
      const ev = decodeEventLog({
        abi: clutchAbi,
        data: log.data,
        topics: log.topics,
      })
      if (ev.eventName !== 'Trade') continue
      const a = ev.args as unknown as {
        marketId: bigint
        trader: `0x${string}`
        isYes: boolean
        isBuy: boolean
        collateralDelta: bigint
        shares: bigint
        resYes: bigint
        resNo: bigint
      }
      decoded.push({
        key: `${log.transactionHash}-${log.logIndex}`,
        marketId: Number(a.marketId),
        trader: a.trader,
        isYes: a.isYes,
        isBuy: a.isBuy,
        collateral: a.collateralDelta,
        shares: a.shares,
        resYes: a.resYes,
        resNo: a.resNo,
        priceBps: priceYesBps({ resYes: a.resYes, resNo: a.resNo }),
        hash: log.transactionHash!,
        blockNumber: log.blockNumber!,
        timestampMs: null,
      })
    } catch {
      // Non-Trade event from this contract; ignore.
    }
  }
  return decoded
}

type IndexedTrade = Omit<TradeEvent, 'collateral' | 'shares' | 'resYes' | 'resNo' | 'blockNumber' | 'priceBps' | 'timestampMs'> & {
  collateral: string
  shares: string
  resYes: string
  resNo: string
  blockNumber: string
  timestampMs: number
}

async function fetchIndexedTrades(): Promise<TradeEvent[]> {
  const response = await fetch(`/api/history?address=${CLUTCH_ADDRESS}`)
  if (!response.ok) throw new Error(`History endpoint returned ${response.status}`)
  const payload = (await response.json()) as { trades?: IndexedTrade[] }
  return (payload.trades ?? []).map((trade) => {
    const resYes = BigInt(trade.resYes)
    const resNo = BigInt(trade.resNo)
    return {
      ...trade,
      collateral: BigInt(trade.collateral),
      shares: BigInt(trade.shares),
      resYes,
      resNo,
      blockNumber: BigInt(trade.blockNumber),
      priceBps: priceYesBps({ resYes, resNo }),
    }
  })
}

export function useTradeFeed(
  limit = 80,
  lookbackBlocks = 100n,
  intervalMs = 1500,
  marketId: number | null = null
) {
  const [trades, setTrades] = useState<TradeEvent[]>([])
  const cursor = useRef<bigint | null>(null)

  useEffect(() => {
    if (!hasContract) return
    let alive = true
    let running = false
    cursor.current = null
    setTrades([])

    const tick = async () => {
      if (running) return
      running = true
      try {
        const head = await publicClient.getBlockNumber()
        const decoded: TradeEvent[] = []

        if (cursor.current === null) {
          try {
            decoded.push(...(await fetchIndexedTrades()))
          } catch {
            // The short RPC window below still keeps new trades live.
          }

          // Monad's public RPC rejects large eth_getLogs ranges. The indexed
          // endpoint supplies history; this short window closes its freshness gap.
          const fromBlock = head >= lookbackBlocks ? head - lookbackBlocks + 1n : 0n
          try {
            const logs = await publicClient.getLogs({
              address: CLUTCH_ADDRESS,
              fromBlock,
              toBlock: head,
            })
            decoded.push(...decodeTradeLogs(logs as Log[]))
          } catch {
            // Indexed history remains usable if the live RPC is throttled.
          }
          cursor.current = head + 1n
        } else {
          const fromBlock = cursor.current
          if (fromBlock > head) return
          const logs = await publicClient.getLogs({
            address: CLUTCH_ADDRESS,
            fromBlock,
            toBlock: head,
          })
          decoded.push(...decodeTradeLogs(logs as Log[]))
          cursor.current = head + 1n
        }

        if (!alive || decoded.length === 0) return

        const newest = [...new Map(decoded.map((trade) => [trade.key, trade])).values()]
          .sort((a, b) =>
            a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : 0
          )
          .slice(-limit)
        const timestamped = await attachBlockTimes(newest)
        if (!alive) return

        setTrades((prev) => {
          const seen = new Set(prev.map((trade) => trade.key))
          const fresh = timestamped.filter((trade) => !seen.has(trade.key))
          return [...fresh.reverse(), ...prev].slice(0, limit)
        })
      } catch {
        // Transient RPC hiccup; next tick retries from the same cursor.
      } finally {
        running = false
      }
    }

    void tick()
    const handle = setInterval(tick, intervalMs)
    return () => {
      alive = false
      clearInterval(handle)
    }
  }, [intervalMs, limit, lookbackBlocks, marketId])

  /** Trades per second over a rolling 5s window — the throughput flex. */
  const tps = useMemo(() => {
    const cutoff = Date.now() - 5000
    return trades.filter((t) => t.timestampMs !== null && t.timestampMs >= cutoff).length / 5
  }, [trades])

  return { trades, tps }
}

export type PricePoint = {
  blockNumber: bigint | null
  timestampMs: number | null
  priceBps: number
  source: 'trade' | 'snapshot'
  collateral?: bigint
  isYes?: boolean
  isBuy?: boolean
  hash?: `0x${string}`
}

/**
 * Real price history for one market, rebuilt from `Trade` logs rather than
 * sampled client-side — so the chart is populated the moment the page loads
 * instead of starting flat and filling in over a minute.
 *
 * `trades` comes from `useTradeFeed`; timestamps are read once per unique block
 * and cached, keeping reloads truthful without creating a second event poller.
 */

export function usePriceSeries(
  trades: TradeEvent[],
  marketId: number | null,
  live?: Pick<Market, 'resYes' | 'resNo'> | null
): PricePoint[] {
  const liveBps = live ? priceYesBps(live) : 5000
  return useMemo(() => {
    if (marketId === null) return []

    const real = trades
      .filter((t) => t.marketId === marketId)
      .map((t): PricePoint => ({
        blockNumber: t.blockNumber,
        timestampMs: t.timestampMs,
        priceBps: t.priceBps,
        source: 'trade',
        collateral: t.collateral,
        isYes: t.isYes,
        isBuy: t.isBuy,
        hash: t.hash,
      }))
      // useTradeFeed stores newest-first; a chart needs oldest-first.
      .sort((a, b) => (a.blockNumber! < b.blockNumber! ? -1 : a.blockNumber! > b.blockNumber! ? 1 : 0))

    const points = [...real]
    const last = real[real.length - 1]
    if (last && last.priceBps !== liveBps) {
      points.push({
        blockNumber: null,
        timestampMs: Date.now(),
        priceBps: liveBps,
        source: 'snapshot',
      })
    } else if (!last) {
      points.push({
        blockNumber: null,
        timestampMs: Date.now(),
        priceBps: liveBps,
        source: 'snapshot',
      })
    }
    return points
  }, [trades, marketId, liveBps])
}

export function useBlockNumber(intervalMs = 500) {
  const [block, setBlock] = useState<bigint | null>(null)
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const n = await publicClient.getBlockNumber()
        if (alive) setBlock(n)
      } catch {
        /* ignore */
      }
    }
    void tick()
    const handle = setInterval(tick, intervalMs)
    return () => {
      alive = false
      clearInterval(handle)
    }
  }, [intervalMs])
  return block
}

export function usePosition(marketId: number | null, trader?: `0x${string}`) {
  const [pos, setPos] = useState<{ yes: bigint; no: bigint }>({ yes: 0n, no: 0n })

  const refresh = useCallback(async () => {
    if (!hasContract || marketId === null || !trader) return
    try {
      const [yes, no] = (await publicClient.readContract({
        ...base,
        functionName: 'positionOf',
        args: [BigInt(marketId), trader],
      })) as [bigint, bigint]
      setPos({ yes, no })
    } catch {
      /* ignore */
    }
  }, [marketId, trader])

  useEffect(() => {
    void refresh()
    // Positions are user-specific and cannot be coalesced across the room.
    // A calmer cadence leaves RPC headroom for the transaction itself.
    const handle = setInterval(refresh, 3000)
    return () => clearInterval(handle)
  }, [refresh])

  return { ...pos, refresh }
}

/** Rolling price history for the big-screen chart. */
export function usePriceHistory(market: Market | null, cap = 180) {
  const [history, setHistory] = useState<number[]>([])
  const lastId = useRef<number | null>(null)

  useEffect(() => {
    if (!market) return
    if (lastId.current !== market.id) {
      lastId.current = market.id
      setHistory([priceYesBps(market)])
      return
    }
    setHistory((prev) => {
      const next = [...prev, priceYesBps(market)]
      return next.length > cap ? next.slice(next.length - cap) : next
    })
  }, [market, cap])

  return history
}
