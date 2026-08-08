import { useState } from 'react'
import { createWalletClient, custom, parseEther, type WalletClient } from 'viem'
import { SocialEmbed } from '../components/SocialEmbed'
import { CreatorAvatar } from '../components/CreatorAvatar'
import { clutchAbi } from '../lib/clutchAbi'
import { CLUTCH_ADDRESS, fmtMon, monadTestnet, publicClient, short, txUrl } from '../lib/chain'
import { buildMarketPrompt, parseMarketPrompt } from '../lib/marketPrompt'
import { REELS } from '../lib/reels'
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
  const { markets } = useMarkets(4000)
  const [wallet, setWallet] = useState<WalletClient | null>(null)
  const [address, setAddress] = useState<string>('')
  const [selectedReelId, setSelectedReelId] = useState(REELS[0].id)
  const selectedReel = REELS.find((reel) => reel.id === selectedReelId) ?? REELS[0]
  const [question, setQuestion] = useState(selectedReel.marketQuestion)
  const [seed, setSeed] = useState('0.5')
  const [durationMinutes, setDurationMinutes] = useState(selectedReel.minutes)
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
    run('create', (w, a) => {
      const minutes = Number(durationMinutes)
      const closesAt =
        Number.isFinite(minutes) && minutes > 0
          ? BigInt(Math.floor(Date.now() / 1000) + Math.floor(minutes * 60))
          : 0n

      return w.writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'createMarket',
        args: [buildMarketPrompt(question, { reelId: selectedReel.id }), closesAt],
        value: parseEther(seed || '0.5'),
        chain: monadTestnet,
        account: a,
      })
    })

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
    <main className="page-shell admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Host console</p>
          <h1>CLUTCH admin</h1>
          <p className="admin-subtitle">
            Create bets from the reel feed, resolve from the live platform numbers, and keep every
            reel, vote, and transaction visible onchain.
          </p>
        </div>
        {wallet ? (
          <span className="status-pill nums">{short(address)}</span>
        ) : (
          <button onClick={connect} className="admin-connect">
            Connect wallet
          </button>
        )}
      </header>

      <div className="admin-grid">
        <section className="section-card admin-card">
          <p className="admin-label">Choose a reel</p>
          <div className="admin-reel-picker">
            {REELS.map((reel) => (
              <button
                key={reel.id}
                type="button"
                onClick={() => {
                  setSelectedReelId(reel.id)
                  setQuestion(reel.marketQuestion)
                  setDurationMinutes(reel.minutes)
                }}
                className={`admin-reel-option ${reel.id === selectedReel.id ? 'is-active' : ''}`}
              >
                <span className="admin-reel-avatar">
                  <CreatorAvatar reel={reel} />
                </span>
                <span>
                  <strong>{reel.displayName}</strong>
                  <small>
                    Official {reel.platform} · {reel.creator}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <div className="admin-reel-preview">
            <SocialEmbed reel={selectedReel} compact />
            <div>
              <p>{selectedReel.displayName}</p>
              <strong>{selectedReel.caption}</strong>
              <p className="text-sm text-dim">
                Profile: <a href={selectedReel.profileUrl} target="_blank" rel="noreferrer">{selectedReel.creator}</a>{' '}
                · <a href={selectedReel.sourceUrl} target="_blank" rel="noreferrer">post</a>{' '}
                · <a href={selectedReel.licenseUrl} target="_blank" rel="noreferrer">terms</a>
              </p>
            </div>
          </div>
          <p className="admin-label admin-label--spaced">Create a bet</p>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will this Reel hit 10,000 views in the next 30 minutes?"
            className="admin-input"
          />
          <div className="admin-card-row">
            <label className="admin-field">
              <span>Seed MON</span>
              <input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="admin-number nums"
              />
            </label>
            <label className="admin-field">
              <span>Minutes</span>
              <input
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="admin-number nums"
              />
            </label>
            <button
              onClick={create}
              disabled={!wallet || !question || busy !== null}
              className="admin-button admin-button--primary flex-1"
            >
              {busy === 'create' ? 'Creating...' : 'Create bet'}
            </button>
          </div>
        </section>

        <section className="section-card admin-card">
          <p className="admin-label">Live bets</p>
          {markets.length === 0 && <p className="text-dim">No bets yet.</p>}
          <div className="admin-market-list">
            {[...markets].reverse().map((m) => (
              <div key={m.id} className="admin-market-card">
                <div className="admin-market-top">
                  <div>
                    {parseMarketPrompt(m.question).reel && (
                      <p className="admin-market-creator">{parseMarketPrompt(m.question).reel!.creator}</p>
                    )}
                    <p className="admin-market-title">
                      #{m.id} {parseMarketPrompt(m.question).question}
                    </p>
                    <p className="admin-market-meta nums">
                      YES {(priceYesBps(m) / 100).toFixed(0)}c · vol {fmtMon(m.volume, 3)} MON ·{' '}
                      {m.status === 0
                        ? 'open'
                        : m.status === 1
                          ? `resolved ${m.outcomeYes ? 'YES' : 'NO'}`
                          : 'cancelled'}
                    </p>
                  </div>
                  <div className="admin-market-actions">
                    {m.status === 0 ? (
                      <>
                        <button
                          onClick={() => resolve(m.id, true)}
                          disabled={!wallet || busy !== null}
                          className="admin-button admin-button--yes"
                        >
                          Resolve YES
                        </button>
                        <button
                          onClick={() => resolve(m.id, false)}
                          disabled={!wallet || busy !== null}
                          className="admin-button admin-button--no"
                        >
                          Resolve NO
                        </button>
                        <button
                          onClick={() => cancel(m.id)}
                          disabled={!wallet || busy !== null}
                          className="admin-button"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      !m.poolRedeemed && (
                        <button
                          onClick={() => redeemPool(m.id)}
                          disabled={!wallet || busy !== null}
                          className="admin-button"
                        >
                          Redeem pool
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {hash && (
        <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="utility-link text-sm">
          Last tx on MonadScan ↗
        </a>
      )}
      {err && <p className="trade-error break-words text-sm">{err}</p>}
    </main>
  )
}
