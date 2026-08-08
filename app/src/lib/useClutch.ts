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

const base = { address: CLUTCH_ADDRESS, abi: clutchAbi } as const

/** Polls every market on the contract. Small N, so plain reads beat multicall. */
export function useMarkets(intervalMs = 600) {
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

        const raw = await Promise.all(
          Array.from({ length: Number(count) }, (_, i) =>
            publicClient.readContract({ ...base, functionName: 'getMarket', args: [BigInt(i)] })
          )
        )
        if (!alive) return
        setMarkets(raw.map((m, id) => ({ id, ...(m as Omit<Market, 'id'>) })))
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
export function useTradeFeed(limit = 40, lookbackBlocks = 300n) {
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
            }
            decoded.push({
              key: `${log.transactionHash}-${log.logIndex}`,
              marketId: Number(a.marketId),
              trader: a.trader,
              isYes: a.isYes,
              isBuy: a.isBuy,
              collateral: a.collateralDelta,
              shares: a.shares,
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
    const handle = setInterval(tick, 700)
    return () => {
      alive = false
      clearInterval(handle)
    }
  }, [limit, lookbackBlocks])

  /** Trades per second over a rolling 5s window — the throughput flex. */
  const tps = useMemo(() => {
    const cutoff = Date.now() - 5000
    return trades.filter((t) => t.seenAt >= cutoff).length / 5
  }, [trades])

  return { trades, tps }
}

export function useBlockNumber() {
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
    const handle = setInterval(tick, 500)
    return () => {
      alive = false
      clearInterval(handle)
    }
  }, [])
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
