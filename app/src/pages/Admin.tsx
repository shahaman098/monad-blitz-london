import { useEffect, useMemo, useState } from 'react'
import { createWalletClient, custom, parseEther, type WalletClient } from 'viem'
import { CreatorAvatar } from '../components/CreatorAvatar'
import { SocialEmbed } from '../components/SocialEmbed'
import { clutchAbi } from '../lib/clutchAbi'
import { CLUTCH_ADDRESS, fmtMon, monadTestnet, publicClient, short, txUrl } from '../lib/chain'
import { buildMarketPrompt, parseMarketPrompt } from '../lib/marketPrompt'
import { REELS } from '../lib/reels'
import { marketTimingLabel, priceYesBps, useMarkets } from '../lib/useClutch'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    }
  }
}

const CHAIN_HEX = `0x${monadTestnet.id.toString(16)}`
const CREATE_GAS = 700_000n
const ADMIN_GAS = 300_000n
const QUESTION_PRESETS = [
  'Will this clip gain 10,000 views before the clock runs out?',
  'Will this clip gain 5,000 likes before the clock runs out?',
  'Will this clip gain 500 comments before the clock runs out?',
] as const

async function waitForReceipt(hash: `0x${string}`) {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      return await publicClient.getTransactionReceipt({ hash })
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  return null
}

export default function Admin() {
  const { markets } = useMarkets(1500)
  const [wallet, setWallet] = useState<WalletClient | null>(null)
  const [address, setAddress] = useState<string>('')
  const [owner, setOwner] = useState<string>('')
  const [selectedReelId, setSelectedReelId] = useState(REELS[0].id)
  const selectedReel = REELS.find((reel) => reel.id === selectedReelId) ?? REELS[0]
  const [question, setQuestion] = useState(selectedReel.marketQuestion)
  const [seed, setSeed] = useState('0.5')
  const [durationMinutes, setDurationMinutes] = useState(selectedReel.minutes)
  const [busy, setBusy] = useState<string | null>(null)
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    void publicClient
      .readContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'owner',
      })
      .then((nextOwner) => setOwner(nextOwner as string))
      .catch(() => setErr('Could not verify the contract owner. Check Monad RPC connectivity.'))
  }, [])

  const isOwner = Boolean(address && owner && address.toLowerCase() === owner.toLowerCase())
  const canCreate = useMemo(() => {
    const minutes = Number(durationMinutes)
    const seedAmount = Number(seed)
    return (
      isOwner &&
      question.trim().length > 0 &&
      Number.isFinite(minutes) &&
      minutes > 0 &&
      Number.isFinite(seedAmount) &&
      seedAmount > 0 &&
      busy === null
    )
  }, [busy, durationMinutes, isOwner, question, seed])

  const connect = async () => {
    setErr(null)
    if (!window.ethereum) {
      setErr('No injected wallet found. Open this host-only page in a browser with MetaMask.')
      return
    }

    try {
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
              rpcUrls: monadTestnet.rpcUrls.default.http,
              blockExplorerUrls: ['https://testnet.monadscan.com'],
            },
          ],
        })
      }

      const client = createWalletClient({ chain: monadTestnet, transport: custom(window.ethereum) })
      const [nextAddress] = await client.requestAddresses()
      setWallet(client)
      setAddress(nextAddress)
    } catch (cause) {
      setErr((cause as Error).message.split('\n')[0].slice(0, 200))
    }
  }

  const run = async (
    label: string,
    submit: (client: WalletClient, account: `0x${string}`) => Promise<`0x${string}`>
  ) => {
    if (!wallet || !address || !isOwner) {
      setErr('Connect the contract owner wallet before using host controls.')
      return
    }

    setBusy(label)
    setErr(null)
    try {
      const nextHash = await submit(wallet, address as `0x${string}`)
      setHash(nextHash)
      setBusy(`${label}-confirming`)
      const receipt = await waitForReceipt(nextHash)
      if (!receipt) {
        setErr('Transaction submitted and still confirming. Use the MonadScan link below.')
      } else if (receipt.status !== 'success') {
        setErr('The transaction was mined but reverted. Open the MonadScan receipt below.')
      }
    } catch (cause) {
      setErr((cause as Error).message.split('\n')[0].slice(0, 200))
    } finally {
      setBusy(null)
    }
  }

  const create = () => {
    const closesAt = BigInt(
      Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(Number(durationMinutes))) * 60
    )
    void run('Creating market', (client, account) =>
      client.writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'createMarket',
        args: [buildMarketPrompt(question, { reelId: selectedReel.id }), closesAt],
        value: parseEther(seed),
        gas: CREATE_GAS,
        chain: monadTestnet,
        account,
      })
    )
  }

  const resolve = (id: number, outcomeYes: boolean) =>
    void run('Resolving market', (client, account) =>
      client.writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'resolve',
        args: [BigInt(id), outcomeYes],
        gas: ADMIN_GAS,
        chain: monadTestnet,
        account,
      })
    )

  const cancel = (id: number) =>
    void run('Cancelling market', (client, account) =>
      client.writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'cancel',
        args: [BigInt(id)],
        gas: ADMIN_GAS,
        chain: monadTestnet,
        account,
      })
    )

  const redeemPool = (id: number) =>
    void run('Redeeming pool', (client, account) =>
      client.writeContract({
        address: CLUTCH_ADDRESS,
        abi: clutchAbi,
        functionName: 'redeemPool',
        args: [BigInt(id)],
        gas: ADMIN_GAS,
        chain: monadTestnet,
        account,
      })
    )

  return (
    <main className="page-shell admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Host console</p>
          <h1>CLUTCH admin</h1>
          <p className="admin-subtitle">
            Open one timed metric market immediately before the demo, then resolve it from the
            public TikTok number. Audience wallets never use MetaMask.
          </p>
        </div>
        {wallet ? (
          <span className={`status-pill nums ${isOwner ? '' : 'is-warning'}`}>
            {isOwner ? `Owner ${short(address)}` : `Wrong wallet ${short(address)}`}
          </span>
        ) : (
          <button type="button" onClick={connect} className="admin-connect">
            Connect owner wallet
          </button>
        )}
      </header>

      <div className="admin-grid">
        <section className="section-card admin-card">
          <p className="admin-label">1. Choose the exact clip</p>
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
                <span className="admin-reel-avatar"><CreatorAvatar reel={reel} /></span>
                <span>
                  <strong>{reel.displayName}</strong>
                  <small>{reel.minutes} minute default</small>
                </span>
              </button>
            ))}
          </div>

          <div className="admin-reel-preview">
            <SocialEmbed reel={selectedReel} compact preferLocal />
            <div>
              <p>{selectedReel.creator}</p>
              <strong>{selectedReel.caption}</strong>
              <p className="text-sm text-dim">
                <a href={selectedReel.sourceUrl} target="_blank" rel="noreferrer">Verify public post</a>
              </p>
            </div>
          </div>

          <p className="admin-label admin-label--spaced">2. Set the measurable target</p>
          <div className="admin-preset-row">
            {QUESTION_PRESETS.map((preset) => (
              <button key={preset} type="button" className="admin-button" onClick={() => setQuestion(preset)}>
                {preset.match(/[\d,]+ (views|likes|comments)/)?.[0] ?? 'Use target'}
              </button>
            ))}
          </div>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="admin-input"
            aria-label="Market question"
          />

          <div className="admin-card-row">
            <label className="admin-field">
              <span>Seed MON</span>
              <input value={seed} onChange={(event) => setSeed(event.target.value)} className="admin-number nums" />
            </label>
            <label className="admin-field">
              <span>Clock minutes</span>
              <input
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                className="admin-number nums"
              />
            </label>
            <button type="button" onClick={create} disabled={!canCreate} className="admin-button admin-button--primary flex-1">
              {busy?.startsWith('Creating') ? busy : 'Open timed market'}
            </button>
          </div>
          {!isOwner && address && (
            <p className="trade-error text-sm">Connected account is not contract owner {short(owner)}.</p>
          )}
        </section>

        <section className="section-card admin-card">
          <p className="admin-label">Live and previous markets</p>
          <div className="admin-market-list">
            {[...markets].reverse().map((market) => {
              const prompt = parseMarketPrompt(market.question)
              return (
                <div key={market.id} className="admin-market-card">
                  <div className="admin-market-top">
                    <div>
                      <p className="admin-market-creator">{prompt.reel?.creator ?? 'Legacy market'}</p>
                      <p className="admin-market-title">#{market.id} {prompt.question}</p>
                      <p className="admin-market-meta nums">
                        YES {(priceYesBps(market) / 100).toFixed(1)}% | {fmtMon(market.volume, 3)} MON | {marketTimingLabel(market)}
                      </p>
                    </div>
                    <div className="admin-market-actions">
                      {market.status === 0 ? (
                        <>
                          <button type="button" onClick={() => resolve(market.id, true)} disabled={!isOwner || busy !== null} className="admin-button admin-button--yes">Resolve YES</button>
                          <button type="button" onClick={() => resolve(market.id, false)} disabled={!isOwner || busy !== null} className="admin-button admin-button--no">Resolve NO</button>
                          <button type="button" onClick={() => cancel(market.id)} disabled={!isOwner || busy !== null} className="admin-button">Cancel</button>
                        </>
                      ) : !market.poolRedeemed ? (
                        <button type="button" onClick={() => redeemPool(market.id)} disabled={!isOwner || busy !== null} className="admin-button">Redeem pool</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {hash && <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="utility-link text-sm">Last host transaction on MonadScan</a>}
      {err && <p className="trade-error break-words text-sm">{err}</p>}
    </main>
  )
}
