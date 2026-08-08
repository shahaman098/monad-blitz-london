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
  seenAt: number
}

export const priceYesBps = (m: Pick<Market, 'resYes' | 'resNo'>): number => {
  const total = m.resYes + m.resNo
  if (total === 0n) return 5000
  return Number((m.resNo * 10_000n) / total)
}

export const isOpen = (m: Market) =>
  m.status === 0 && (m.closesAt === 0n || BigInt(Math.floor(Date.now() / 1000)) < m.closesAt)

export const marketTimingLabel = (m: Pick<Market, 'closesAt' | 'status'>): string => {
  if (m.status !== 0) return 'resolved'
  if (m.closesAt === 0n) return 'open until host resolves'
  const secondsLeft = Number(m.closesAt - BigInt(Math.floor(Date.now() / 1000)))
  if (secondsLeft <= 0) return 'closed for trading'
  if (secondsLeft < 60) return `${secondsLeft}s left`
  const minutes = Math.ceil(secondsLeft / 60)
  if (minutes < 60) return `${minutes}m left`
  const hours = Math.ceil(minutes / 60)
  return `${hours}h left`
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
export function useTradeFeed(limit = 40, lookbackBlocks = 300n, intervalMs = 700) {
  const [trades, setTrades] = useState<TradeEvent[]>([])
  const cursor = useRef<bigint | null>(null)

  useEffect(() => {
    if (!hasContract) return
    let alive = true

    const tick = async () => {
      try {
        const head = await publicClient.getBlockNumber()
        const from =
          cursor.current ?? (head > lookbackBlocks ? head - lookbackBlocks : 0n)
        if (from > head) return

        const logs = await publicClient.getLogs({
          address: CLUTCH_ADDRESS,
          fromBlock: from,
          toBlock: head,
        })
        cursor.current = head + 1n
        if (!alive || logs.length === 0) return

        const decoded: TradeEvent[] = []
        for (const log of logs as Log[]) {
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
              seenAt: Date.now(),
            })
          } catch {
            // Non-Trade event from this contract; ignore.
          }
        }
        if (decoded.length === 0) return

        setTrades((prev) => {
          const seen = new Set(prev.map((t) => t.key))
          const fresh = decoded.filter((t) => !seen.has(t.key))
          return [...fresh.reverse(), ...prev].slice(0, limit)
        })
      } catch {
        // Transient RPC hiccup; next tick retries from the same cursor.
      }
    }

    void tick()
    const handle = setInterval(tick, intervalMs)
    return () => {
      alive = false
      clearInterval(handle)
    }
  }, [intervalMs, limit, lookbackBlocks])

  /** Trades per second over a rolling 5s window — the throughput flex. */
  const tps = useMemo(() => {
    const cutoff = Date.now() - 5000
    return trades.filter((t) => t.seenAt >= cutoff).length / 5
  }, [trades])

  return { trades, tps }
}

export type PricePoint = { blockNumber: bigint; priceBps: number }
export type PriceSeries = { points: PricePoint[]; seededUpTo: number }

/**
 * Real price history for one market, rebuilt from `Trade` logs rather than
 * sampled client-side — so the chart is populated the moment the page loads
 * instead of starting flat and filling in over a minute.
 *
 * `trades` comes from `useTradeFeed`, so this adds no extra RPC load (the
 * public Monad endpoint rate-limits at 15 req/sec).
 */
/**
 * Deterministic warm-up curve so a fresh market shows a real-looking trend
 * instead of a flat line. Seeded from the market id, so it is stable across
 * reloads and identical on the phone and the projector.
 *
 * This is demo scaffolding, not chain data — the UI labels it, and every point
 * after `seedCount` is a real on-chain trade.
 */
function seedTrend(marketId: number, count: number, endBps: number): number[] {
  let s = (marketId + 1) * 9301
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }

  // Waypoints, not a random walk: a walk this short averages out to a flat line.
  // A rally, a sell-off, then a drift onto the live price gives a readable shape.
  const rally = 5000 + 1400 + Math.round(rand() * 1600) // ~64–80%
  const dump = 2600 + Math.round(rand() * 1500) // ~26–41%
  const waypoints = [5000, rally, dump, endBps]

  const out: number[] = []
  const legs = waypoints.length - 1
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * legs
    const leg = Math.min(legs - 1, Math.floor(t))
    const k = t - leg
    // Smoothstep keeps the turns curved rather than sawtoothed.
    const ease = k * k * (3 - 2 * k)
    const base = waypoints[leg] + (waypoints[leg + 1] - waypoints[leg]) * ease
    const noise = (rand() - 0.5) * 420
    // Damp the noise near the end so the join onto the live price stays clean.
    const damp = i > count - 5 ? 0.15 : 1
    out.push(Math.round(Math.max(800, Math.min(9200, base + noise * damp))))
  }
  out[out.length - 1] = endBps
  return out
}

export function usePriceSeries(
  trades: TradeEvent[],
  marketId: number | null,
  live?: Pick<Market, 'resYes' | 'resNo'> | null,
  seedCount = 34
): PriceSeries {
  const liveBps = live ? priceYesBps(live) : 5000
  return useMemo(() => {
    if (marketId === null) return { points: [], seededUpTo: 0 }

    const real = trades
      .filter((t) => t.marketId === marketId)
      .map((t) => ({ blockNumber: t.blockNumber, priceBps: t.priceBps }))
      // useTradeFeed stores newest-first; a chart needs oldest-first.
      .sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : 0))

    // Warm-up ends where real history begins, so the two never contradict.
    const joinAt = real.length > 0 ? real[0].priceBps : liveBps
    const seeded = seedTrend(marketId, seedCount, joinAt).map((priceBps, i) => ({
      blockNumber: BigInt(i),
      priceBps,
    }))

    const points = [...seeded, ...real]
    const last = points[points.length - 1]
    if (last && last.priceBps !== liveBps) {
      points.push({ blockNumber: last.blockNumber + 1n, priceBps: liveBps })
    }
    return { points, seededUpTo: seeded.length }
  }, [trades, marketId, liveBps, seedCount])
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
    const handle = setInterval(refresh, 900)
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
