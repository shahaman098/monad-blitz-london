import { createPublicClient, defineChain, http } from 'viem'

export const RPC_URL =
  (import.meta.env.VITE_MONAD_RPC_URL as string | undefined) ?? 'https://testnet-rpc.monad.xyz'

export const EXPLORER = 'https://testnet.monadscan.com'

export const monadTestnet = defineChain({
  id: Number(import.meta.env.VITE_MONAD_CHAIN_ID ?? 10143),
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'MonadScan', url: EXPLORER } },
  testnet: true,
})

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(RPC_URL),
  // Monad produces blocks in ~400ms; poll close to block cadence.
  pollingInterval: 500,
})

export const CLUTCH_ADDRESS = (import.meta.env.VITE_CLUTCH_ADDRESS ?? '') as `0x${string}`

export const hasContract = /^0x[0-9a-fA-F]{40}$/.test(CLUTCH_ADDRESS)

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`
export const addrUrl = (address: string) => `${EXPLORER}/address/${address}`

export const short = (value: string, lead = 6, tail = 4) =>
  value.length <= lead + tail ? value : `${value.slice(0, lead)}…${value.slice(-tail)}`

/** Format wei as MON with a fixed number of decimals, without exponent noise. */
export function fmtMon(wei: bigint, decimals = 3): string {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const whole = abs / 10n ** 18n
  const frac = abs % 10n ** 18n
  const fracStr = frac.toString().padStart(18, '0').slice(0, decimals)
  return `${negative ? '-' : ''}${whole}${decimals > 0 ? `.${fracStr}` : ''}`
}
