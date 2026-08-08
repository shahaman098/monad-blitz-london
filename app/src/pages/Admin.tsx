import { useState } from 'react'
import { createWalletClient, custom, parseEther, type WalletClient } from 'viem'
import { clutchAbi } from '../lib/clutchAbi'
import { CLUTCH_ADDRESS, fmtMon, monadTestnet, publicClient, short, txUrl } from '../lib/chain'
import { priceYesBps, useMarkets } from '../lib/useClutch'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    }
  }
}

const CHAIN_HEX = `0x${monadTestnet.id.toString(16)}`

/**
 * Owner console. Uses the injected wallet rather than a pasted key so the
 * resolver key never touches the page.
 */
export default function Admin() {
  const { markets } = useMarkets(1000)
  const [wallet, setWallet] = useState<WalletClient | null>(null)
  const [address, setAddress] = useState<string>('')
  const [question, setQuestion] = useState('')
  const [seed, setSeed] = useState('0.5')
  const [busy, setBusy] = useState<string | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const connect = async () => {
    setErr(null)
    if (!window.ethereum) {
      setErr('No injected wallet found. Install MetaMask.')
      return
    }
    try {
      const client = createWalletClient({ chain: monadTestnet, transport: custom(window.ethereum) })
      const [addr] = await client.requestAddresses()
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CHAIN_HEX }],
        })
      } catch {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: CHAIN_HEX,
              chainName: monadTestnet.name,
              nativeCurrency: monadTestnet.nativeCurrency,
              rpcUrls: [monadTestnet.rpcUrls.default.http[0]],
              blockExplorerUrls: ['https://testnet.monadscan.com'],
            },
          ],
        })
      }
      setWallet(client)
      setAddress(addr)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const run = async (label: string, fn: (w: WalletClient, a: `0x${string}`) => Promise<`0x${string}`>) => {
    if (!wallet || !address) return
    setBusy(label)
    setErr(null)
    try {
      const h = await fn(wallet, address as `0x${string}`)
      setHash(h)
      await publicClient.waitForTransactionReceipt({ hash: h })
    } catch (e) {
      setErr((e as Error).message.split('\n')[0].slice(0, 200))
    } finally {
      setBusy(null)
    }
  }

  const create = () =>
    run('create', (w, a) =>
      w.writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'createMarket',
        args: [question, 0n],
        value: parseEther(seed || '0.5'),
        chain: monadTestnet,
        account: a,
      })
    )

  const resolve = (id: number, outcomeYes: boolean) =>
    run('resolve', (w, a) =>
      w.writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'resolve',
        args: [BigInt(id), outcomeYes],
        chain: monadTestnet,
        account: a,
      })
    )

  const cancel = (id: number) =>
    run('cancel', (w, a) =>
      w.writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'cancel',
        args: [BigInt(id)],
        chain: monadTestnet,
        account: a,
      })
    )

  const redeemPool = (id: number) =>
    run('redeemPool', (w, a) =>
      w.writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'redeemPool',
        args: [BigInt(id)],
        chain: monadTestnet,
        account: a,
      })
    )

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tighter">CLUTCH · admin</h1>
        {wallet ? (
          <span className="nums text-sm text-dim">{short(address)}</span>
        ) : (
          <button onClick={connect} className="rounded-lg bg-white px-4 py-2 font-bold text-ink">
            Connect wallet
          </button>
        )}
      </header>

      <section className="space-y-3 rounded-2xl border border-edge bg-panel p-5">
        <p className="text-xs uppercase tracking-widest text-dim">Open a market</p>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Will this demo get a laugh in the first 30 seconds?"
          className="w-full rounded-lg border border-edge bg-ink px-3 py-3 outline-none focus:border-yes"
        />
        <div className="flex gap-3">
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="nums w-32 rounded-lg border border-edge bg-ink px-3 py-3 outline-none focus:border-yes"
          />
          <button
            onClick={create}
            disabled={!wallet || !question || busy !== null}
            className="flex-1 rounded-lg bg-yes py-3 font-bold text-ink disabled:opacity-30"
          >
            {busy === 'create' ? 'Opening…' : 'Open market (seed MON)'}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-dim">Markets</p>
        {markets.length === 0 && <p className="text-dim">No markets yet.</p>}
        {[...markets].reverse().map((m) => (
          <div key={m.id} className="rounded-2xl border border-edge bg-panel p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">
                  #{m.id} {m.question}
                </p>
                <p className="nums mt-1 text-sm text-dim">
                  YES {(priceYesBps(m) / 100).toFixed(0)}¢ · vol {fmtMon(m.volume, 3)} MON ·{' '}
                  {m.status === 0 ? 'open' : m.status === 1 ? `resolved ${m.outcomeYes ? 'YES' : 'NO'}` : 'cancelled'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {m.status === 0 ? (
                  <>
                    <button
                      onClick={() => resolve(m.id, true)}
                      disabled={!wallet || busy !== null}
                      className="rounded-lg bg-yes px-3 py-2 text-sm font-bold text-ink disabled:opacity-30"
                    >
                      YES
                    </button>
                    <button
                      onClick={() => resolve(m.id, false)}
                      disabled={!wallet || busy !== null}
                      className="rounded-lg bg-no px-3 py-2 text-sm font-bold text-ink disabled:opacity-30"
                    >
                      NO
                    </button>
                    <button
                      onClick={() => cancel(m.id)}
                      disabled={!wallet || busy !== null}
                      className="rounded-lg border border-edge px-3 py-2 text-sm disabled:opacity-30"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  !m.poolRedeemed && (
                    <button
                      onClick={() => redeemPool(m.id)}
                      disabled={!wallet || busy !== null}
                      className="rounded-lg border border-edge px-3 py-2 text-sm disabled:opacity-30"
                    >
                      Redeem pool
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </section>

      {hash && (
        <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="text-sm underline">
          Last tx on MonadScan ↗
        </a>
      )}
      {err && (
        <p className="break-words rounded-lg border border-no/40 bg-no/10 p-3 text-sm text-no">
          {err}
        </p>
      )}
    </main>
  )
}
