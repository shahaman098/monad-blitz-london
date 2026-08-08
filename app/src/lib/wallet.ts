import { createWalletClient, http, type Account } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { monadTestnet, RPC_URL } from './chain'

const KEY = 'clutch.burner.v2'

/**
 * A throwaway testnet key held in localStorage. This exists so the room can go
 * from QR scan to first trade in seconds — no extension, no faucet, no seed
 * phrase. Testnet MON only; nothing here is worth stealing.
 */
export function getBurner(): Account {
  let pk = localStorage.getItem(KEY)
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    pk = generatePrivateKey()
    localStorage.setItem(KEY, pk)
  }
  return privateKeyToAccount(pk as `0x${string}`)
}

export function resetBurner(): Account {
  localStorage.removeItem(KEY)
  return getBurner()
}

export function burnerWallet(account: Account) {
  return createWalletClient({ account, chain: monadTestnet, transport: http(RPC_URL) })
}

export type FundResult = { ok: boolean; funded: boolean; hash?: string; error?: string }

/** Ask the sponsor wallet to drip gas + stake money to this burner. */
export async function requestFunding(address: string): Promise<FundResult> {
  try {
    const res = await fetch('/api/fund', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address }),
    })
    const body = (await res.json()) as FundResult
    if (!res.ok) return { ok: false, funded: false, error: body.error ?? `HTTP ${res.status}` }
    return body
  } catch (error) {
    return { ok: false, funded: false, error: (error as Error).message }
  }
}
