export type WalletTransactionStatus = 'pending' | 'confirmed' | 'failed'

export type WalletTransaction = {
  hash: `0x${string}`
  label: string
  status: WalletTransactionStatus
  submittedAt: number
  marketId: number | null
}

const historyKey = (address: string) => `clutch.transactions.${address.toLowerCase()}`

export function readWalletTransactions(address: string): WalletTransaction[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyKey(address)) ?? '[]') as WalletTransaction[]
    return parsed
      .filter((tx) => /^0x[0-9a-f]{64}$/i.test(tx.hash) && Number.isFinite(tx.submittedAt))
      .slice(0, 30)
  } catch {
    return []
  }
}

export function writeWalletTransactions(address: string, transactions: WalletTransaction[]) {
  localStorage.setItem(historyKey(address), JSON.stringify(transactions.slice(0, 30)))
}
