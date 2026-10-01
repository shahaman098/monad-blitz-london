/// <reference types="node" />

/**
 * Same-origin Monad JSON-RPC relay.
 *
 * Public RPCs throttle by source IP. If every audience phone polls them
 * directly, the room can exhaust the shared quota and all vote buttons become
 * disabled because no device can load the open market. This relay coalesces
 * identical reads and keeps a very short shared cache while still forwarding
 * signed raw transactions immediately.
 */

type JsonRpcId = string | number | null
type JsonRpcRequest = {
  jsonrpc?: string
  id?: JsonRpcId
  method?: string
  params?: unknown
}
type JsonRpcResult = { result?: unknown; error?: unknown }

const DEFAULT_RPC_URLS = ['https://testnet-rpc.monad.xyz', 'https://rpc.ankr.com/monad_testnet']

const ALLOWED_METHODS = new Set([
  'eth_blockNumber',
  'eth_call',
  'eth_chainId',
  'eth_estimateGas',
  'eth_feeHistory',
  'eth_gasPrice',
  'eth_getBalance',
  'eth_getBlockByNumber',
  'eth_getCode',
  'eth_getLogs',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_maxPriorityFeePerGas',
  'eth_sendRawTransaction',
  'net_version',
])

const CACHE_TTL_MS: Record<string, number> = {
  eth_blockNumber: 750,
  eth_call: 1_250,
  eth_chainId: 60_000,
  eth_feeHistory: 750,
  eth_gasPrice: 750,
  eth_getBalance: 2_000,
  eth_getBlockByNumber: 750,
  eth_getCode: 60_000,
  eth_getLogs: 1_250,
  eth_getTransactionReceipt: 500,
  eth_maxPriorityFeePerGas: 750,
  net_version: 60_000,
}

const cache = new Map<string, { expiresAt: number; result: unknown }>()
const inFlight = new Map<string, Promise<JsonRpcResult>>()

function parseRpcUrls(raw?: string): string[] {
  return [...new Set((raw ?? '').split(',').map((url) => url.trim()).filter(Boolean))]
}

const RPC_URLS = (() => {
  const configured = parseRpcUrls(process.env.MONAD_RPC_URLS)
  if (configured.length > 0) return configured
  const primary = process.env.MONAD_RPC_URL?.trim()
  return [...new Set([primary, ...DEFAULT_RPC_URLS].filter((url): url is string => Boolean(url)))]
})()

async function readBody(req: any): Promise<JsonRpcRequest> {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 256_000) throw new Error('request body too large')
    chunks.push(chunk as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function send(res: any, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

function isRateLimitError(error: unknown): boolean {
  const value = error as { code?: number; message?: string }
  return (
    value?.code === -32011 ||
    value?.code === -32090 ||
    /rate limit|too many requests|throttl/i.test(value?.message ?? '')
  )
}

async function callUpstream(request: JsonRpcRequest): Promise<JsonRpcResult> {
  let lastFailure: unknown = { code: -32000, message: 'Monad RPC unavailable' }

  for (const url of RPC_URLS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      })
      const payload = (await response.json()) as JsonRpcResult
      if (!response.ok || isRateLimitError(payload.error)) {
        lastFailure = payload.error ?? { code: response.status, message: response.statusText }
        continue
      }
      return payload
    } catch (error) {
      lastFailure = { code: -32000, message: (error as Error).message }
    } finally {
      clearTimeout(timeout)
    }
  }

  return { error: lastFailure }
}

async function resolveRequest(request: JsonRpcRequest): Promise<JsonRpcResult> {
  const method = request.method!
  const ttl = CACHE_TTL_MS[method] ?? 0
  if (ttl === 0) return callUpstream(request)

  const key = `${method}:${JSON.stringify(request.params ?? [])}`
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return { result: cached.result }

  const pending = inFlight.get(key)
  if (pending) return pending

  const next = callUpstream(request)
    .then((payload) => {
      if (!('error' in payload) || payload.error === undefined) {
        cache.set(key, { expiresAt: Date.now() + ttl, result: payload.result })
      }
      return payload
    })
    .finally(() => {
      inFlight.delete(key)
    })
  inFlight.set(key, next)
  return next
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST')
    return send(res, 405, { error: 'POST only' })
  }

  let request: JsonRpcRequest
  try {
    request = await readBody(req)
  } catch (error) {
    return send(res, 400, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: (error as Error).message || 'invalid JSON body' },
    })
  }

  const id = request.id ?? null
  if (
    request.jsonrpc !== '2.0' ||
    typeof request.method !== 'string' ||
    !ALLOWED_METHODS.has(request.method)
  ) {
    return send(res, 400, {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: 'RPC method not allowed' },
    })
  }

  const payload = await resolveRequest(request)
  return send(res, 200, { jsonrpc: '2.0', id, ...payload })
}
