/// <reference types="node" />

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  isAddress,
  parseEther,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

/**
 * Sponsor drip. The whole point of Clutch's demo is that a stranger can scan a
 * QR code and be trading in seconds, so we cannot put a faucet or a wallet
 * install in front of them. This endpoint funds a fresh burner once.
 *
 * Env: SPONSOR_PRIVATE_KEY, MONAD_RPC_URL, FUND_AMOUNT_MON, FUND_MAX_WALLETS
 */

const RPC = process.env.MONAD_RPC_URL ?? 'https://testnet-rpc.monad.xyz'
const FUND_AMOUNT = parseEther(process.env.FUND_AMOUNT_MON ?? '0.2')
// Below this, a wallet is considered empty and eligible for a top-up.
const TOPUP_FLOOR = FUND_AMOUNT / 4n
const MAX_WALLETS = Number(process.env.FUND_MAX_WALLETS ?? 250)

const monadTestnet = defineChain({
  id: Number(process.env.MONAD_CHAIN_ID ?? 10143),
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  testnet: true,
})

const publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC) })

const served = new Set<string>()
// Serialise sends so a room full of simultaneous joins cannot race the nonce.
let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job)
  queue = run.catch(() => undefined)
  return run
}

async function readBody(req: any): Promise<any> {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function send(res: any, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(payload))
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })

  const pk = process.env.SPONSOR_PRIVATE_KEY
  if (!pk) return send(res, 500, { error: 'SPONSOR_PRIVATE_KEY is not configured' })

  let address: string
  try {
    address = (await readBody(req)).address
  } catch {
    return send(res, 400, { error: 'invalid JSON body' })
  }

  if (typeof address !== 'string' || !isAddress(address)) {
    return send(res, 400, { error: 'valid `address` required' })
  }

  try {
    // Balance is the real gate: it survives cold starts and multiple instances,
    // where the in-memory set does not.
    const balance = await publicClient.getBalance({ address: address as `0x${string}` })
    if (balance >= TOPUP_FLOOR) {
      return send(res, 200, { ok: true, funded: false, reason: 'already funded' })
    }
    if (served.size >= MAX_WALLETS && !served.has(address.toLowerCase())) {
      return send(res, 429, { error: 'sponsor wallet cap reached' })
    }

    const account = privateKeyToAccount(pk as `0x${string}`)
    const wallet = createWalletClient({ account, chain: monadTestnet, transport: http(RPC) })

    const hash = await enqueue(async () => {
      let lastError: unknown
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const nonce = await publicClient.getTransactionCount({
            address: account.address,
            blockTag: 'pending',
          })
          return await wallet.sendTransaction({
            account,
            chain: monadTestnet,
            to: address as `0x${string}`,
            value: FUND_AMOUNT,
            nonce,
            kzg: undefined,
          })
        } catch (error) {
          lastError = error
        }
      }
      throw lastError
    })

    served.add(address.toLowerCase())
    return send(res, 200, { ok: true, funded: true, hash })
  } catch (error) {
    return send(res, 500, { error: (error as Error).message })
  }
}
