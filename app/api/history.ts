/// <reference types="node" />

import { decodeEventLog, isAddress } from 'viem'
import { clutchAbi } from '../src/lib/clutchAbi.ts'

type ExplorerRow = {
  Txhash: `0x${string}`
  Status: string
  Method: string
  Blockno: string
  DateTime: string
}

type ReceiptLog = {
  address: `0x${string}`
  data: `0x${string}`
  logIndex: `0x${string}`
  topics: [`0x${string}`, ...`0x${string}`[]]
  transactionHash: `0x${string}`
  blockNumber: `0x${string}`
}

type HistoryTrade = {
  key: string
  marketId: number
  trader: `0x${string}`
  isYes: boolean
  isBuy: boolean
  collateral: string
  shares: string
  resYes: string
  resNo: string
  hash: `0x${string}`
  blockNumber: string
  timestampMs: number
}

const DEFAULT_RPC_URLS = ['https://testnet-rpc.monad.xyz', 'https://rpc.ankr.com/monad_testnet']
const EXPLORER = 'https://testnet.monadscan.com'
const CACHE_MS = 30_000

function parseRpcUrls(raw?: string): string[] {
  return [...new Set((raw ?? '').split(',').map((url) => url.trim()).filter(Boolean))]
}

const RPC_URLS = (() => {
  const configured = parseRpcUrls(process.env.MONAD_RPC_URLS)
  if (configured.length > 0) return configured
  const primary = process.env.MONAD_RPC_URL?.trim()
  return [...new Set([primary, ...DEFAULT_RPC_URLS].filter((url): url is string => Boolean(url)))]
})()

const cache = new Map<string, { expiresAt: number; trades: HistoryTrade[] }>()
const inFlight = new Map<string, Promise<HistoryTrade[]>>()
const receiptCache = new Map<string, HistoryTrade[]>()

function send(res: any, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'public, max-age=15')
  res.end(JSON.stringify(payload))
}

function extractRows(html: string): ExplorerRow[] {
  const match = html.match(/const quickExportCsvData = '([\s\S]*?)';/)
  if (!match) throw new Error('MonadScan transaction data was not found')
  return JSON.parse(match[1]) as ExplorerRow[]
}

async function getReceipt(hash: `0x${string}`): Promise<{ logs: ReceiptLog[] }> {
  let lastError = 'Monad RPC unavailable'
  for (const url of RPC_URLS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionReceipt',
          params: [hash],
        }),
        signal: controller.signal,
      })
      const payload = (await response.json()) as {
        result?: { logs: ReceiptLog[] }
        error?: { message?: string }
      }
      if (response.ok && payload.result) return payload.result
      lastError = payload.error?.message ?? response.statusText
    } catch (error) {
      lastError = (error as Error).message
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error(lastError)
}

function decodeReceipt(logs: ReceiptLog[], row: ExplorerRow, address: string): HistoryTrade[] {
  const timestampMs = Date.parse(`${row.DateTime.replace(' ', 'T')}Z`)
  const trades: HistoryTrade[] = []

  for (const log of logs) {
    if (log.address.toLowerCase() !== address.toLowerCase()) continue
    try {
      const event = decodeEventLog({
        abi: clutchAbi,
        data: log.data,
        topics: log.topics,
      })
      if (event.eventName !== 'Trade') continue
      const args = event.args as unknown as {
        marketId: bigint
        trader: `0x${string}`
        isYes: boolean
        isBuy: boolean
        collateralDelta: bigint
        shares: bigint
        resYes: bigint
        resNo: bigint
      }
      trades.push({
        key: `${row.Txhash}-${Number(BigInt(log.logIndex))}`,
        marketId: Number(args.marketId),
        trader: args.trader,
        isYes: args.isYes,
        isBuy: args.isBuy,
        collateral: args.collateralDelta.toString(),
        shares: args.shares.toString(),
        resYes: args.resYes.toString(),
        resNo: args.resNo.toString(),
        hash: row.Txhash,
        blockNumber: BigInt(log.blockNumber).toString(),
        timestampMs,
      })
    } catch {
      // Ignore other contract events in the same receipt.
    }
  }
  return trades
}

async function loadHistory(address: string): Promise<HistoryTrade[]> {
  const response = await fetch(`${EXPLORER}/address/${address}`, {
    headers: { 'user-agent': 'Clutch market tracker/1.0' },
  })
  if (!response.ok) throw new Error(`MonadScan returned ${response.status}`)

  const rows = extractRows(await response.text()).filter(
    (row) => row.Status === 'Success' && (row.Method === 'Buy' || row.Method === 'Sell')
  )
  const trades: HistoryTrade[] = []

  // Keep the first uncached load under the public RPC's burst quota.
  for (let i = 0; i < rows.length; i += 3) {
    await Promise.all(
      rows.slice(i, i + 3).map(async (row) => {
        const cached = receiptCache.get(row.Txhash)
        if (cached) {
          trades.push(...cached)
          return
        }
        try {
          const receipt = await getReceipt(row.Txhash)
          const decoded = decodeReceipt(receipt.logs, row, address)
          receiptCache.set(row.Txhash, decoded)
          trades.push(...decoded)
        } catch {
          // A later request retries any receipt that all RPCs temporarily reject.
        }
      })
    )
    if (i + 3 < rows.length) {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  return trades.sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)))
}

async function getHistory(address: string): Promise<HistoryTrade[]> {
  const key = address.toLowerCase()
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.trades

  const pending = inFlight.get(key)
  if (pending) return pending

  const request = loadHistory(address)
    .then((trades) => {
      cache.set(key, { expiresAt: Date.now() + CACHE_MS, trades })
      return trades
    })
    .finally(() => inFlight.delete(key))
  inFlight.set(key, request)
  return request
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET')
    return send(res, 405, { error: 'GET only' })
  }

  const url = new URL(req.url ?? '/', 'http://localhost')
  const address = url.searchParams.get('address')
  if (!address || !isAddress(address)) {
    return send(res, 400, { error: 'valid address query parameter required' })
  }

  try {
    const trades = await getHistory(address)
    return send(res, 200, { trades })
  } catch (error) {
    return send(res, 502, { error: (error as Error).message })
  }
}
