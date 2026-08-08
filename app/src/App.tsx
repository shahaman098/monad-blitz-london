import { useEffect, useRef, useState } from 'react'
import './App.css'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    }
  }
}

type FeedItem = {
  hash: string
  watchedSeconds: number
  payoutMon: number
  createdAt: number
}

type WalletState = {
  address: string | null
  chainId: number | null
  pending: boolean
  error: string | null
}

const MONAD_TESTNET = {
  chainId: 10143,
  chainIdHex: '0x279f',
  label: 'Monad Testnet',
  rpcUrl: 'https://testnet-rpc.monad.xyz',
  explorerUrl: 'https://testnet.monadscan.com',
}

const VIDEO_URL = '/media/midroll-demo.mp4'
const VIDEO_POSTER = '/media/midroll-host.png'
const JOIN_CODE = '4X7Q'
const DEMO_DOMAIN = 'midroll.live'
const SESSION_COUNT = 84
const BASE_FUNDED_MON = 18
const BASE_CREATOR_EARNED_MON = 5.184
const BASE_WATCHED_SECONDS = 1234
const RATE_PER_WATCHED_SECOND_MON = 0.0042
const SPONSOR_SEGMENT = {
  start: 12,
  end: 22,
}

const SWARM_POINTS = Array.from({ length: SESSION_COUNT }, (_, index) => ({
  id: index,
  x: (index % 14) * 7.3 + 3 + ((index * 13) % 5),
  y: Math.floor(index / 14) * 16 + 10 + ((index * 7) % 6),
  seed: index * 0.83 + 1.7,
}))

const INITIAL_FEED: FeedItem[] = [
  createFeedItem(0.017, 4.1, 5000, 1),
  createFeedItem(0.024, 5.7, 3800, 2),
  createFeedItem(0.011, 2.6, 2600, 3),
  createFeedItem(0.032, 7.6, 1400, 4),
]

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playbackRef = useRef({ currentTime: 0, isPlaying: false })
  const settlementClockRef = useRef<number | null>(null)
  const lastFeedRef = useRef(0)
  const feedSerialRef = useRef(INITIAL_FEED.length + 1)

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(30)
  const [videoReady, setVideoReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [campaignState, setCampaignState] = useState({
    fundedMon: BASE_FUNDED_MON,
    creatorEarnedMon: BASE_CREATOR_EARNED_MON,
    watchedSeconds: BASE_WATCHED_SECONDS,
  })
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    chainId: null,
    pending: false,
    error: null,
  })
  const [feedItems, setFeedItems] = useState<FeedItem[]>(INITIAL_FEED)

  useEffect(() => {
    playbackRef.current = { currentTime, isPlaying }
  }, [currentTime, isPlaying])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 30)
      setVideoReady(true)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoReady) return

    video.muted = isMuted
  }, [isMuted, videoReady])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoReady) return

    void video.play().catch(() => {
      setIsPlaying(false)
    })
  }, [videoReady])

  useEffect(() => {
    void hydrateWalletState()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const playback = playbackRef.current
      const sponsorActive = playback.isPlaying && isSponsorMoment(playback.currentTime)

      if (!sponsorActive) {
        settlementClockRef.current = null
        return
      }

      const now = performance.now()
      const previous = settlementClockRef.current ?? now - 250
      const deltaSeconds = Math.min((now - previous) / 1000, 0.35)
      settlementClockRef.current = now

      const activeSessions = getActiveSessionCount(playback.currentTime, true)
      const addedMon = activeSessions * RATE_PER_WATCHED_SECOND_MON * deltaSeconds

      setCampaignState((previousState) => {
        const remainingBefore = previousState.fundedMon - previousState.creatorEarnedMon
        if (remainingBefore <= 0.0001) return previousState

        const appliedMon = Math.min(remainingBefore, addedMon)
        const appliedSeconds = appliedMon / RATE_PER_WATCHED_SECOND_MON

        return {
          ...previousState,
          creatorEarnedMon: previousState.creatorEarnedMon + appliedMon,
          watchedSeconds: previousState.watchedSeconds + appliedSeconds,
        }
      })

      if (now - lastFeedRef.current > 1150) {
        lastFeedRef.current = now
        const watchedSeconds = 1.2 + (feedSerialRef.current % 5) * 1.4
        const payoutMon = watchedSeconds * RATE_PER_WATCHED_SECOND_MON
        const item = createFeedItem(
          payoutMon,
          watchedSeconds,
          0,
          feedSerialRef.current,
        )

        feedSerialRef.current += 1
        setFeedItems((current) => [item, ...current].slice(0, 7))
      }
    }, 250)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const sponsorActive = isPlaying && isSponsorMoment(currentTime)
  const activeSessions = getActiveSessionCount(currentTime, sponsorActive)
  const escrowRemainingMon = Math.max(
    campaignState.fundedMon - campaignState.creatorEarnedMon,
    0,
  )
  const currentRunRateMon = activeSessions * RATE_PER_WATCHED_SECOND_MON
  const sponsorProgress = getSponsorProgress(currentTime)
  const timelineBackground = getTimelineBackground(duration)
  const walletOnMonad = wallet.chainId === MONAD_TESTNET.chainId

  async function hydrateWalletState() {
    if (!window.ethereum) return

    try {
      const [accounts, chainIdHex] = await Promise.all([
        window.ethereum.request({ method: 'eth_accounts' }) as Promise<string[]>,
        window.ethereum.request({ method: 'eth_chainId' }) as Promise<string>,
      ])

      setWallet((previous) => ({
        ...previous,
        address: accounts[0] ?? null,
        chainId: Number.parseInt(chainIdHex, 16),
        error: null,
      }))
    } catch (error) {
      setWallet((previous) => ({
        ...previous,
        error: error instanceof Error ? error.message : 'Wallet state unavailable.',
      }))
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setWallet((previous) => ({
        ...previous,
        error: 'MetaMask was not found in this browser.',
      }))
      return
    }

    setWallet((previous) => ({
      ...previous,
      pending: true,
      error: null,
    }))

    try {
      const chainIdHex = (await window.ethereum.request({
        method: 'eth_chainId',
      })) as string

      if (chainIdHex !== MONAD_TESTNET.chainIdHex) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: MONAD_TESTNET.chainIdHex }],
          })
        } catch {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: MONAD_TESTNET.chainIdHex,
                chainName: MONAD_TESTNET.label,
                nativeCurrency: {
                  name: 'Monad',
                  symbol: 'MON',
                  decimals: 18,
                },
                rpcUrls: [MONAD_TESTNET.rpcUrl],
                blockExplorerUrls: [MONAD_TESTNET.explorerUrl],
              },
            ],
          })
        }
      }

      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[]
      const freshChainIdHex = (await window.ethereum.request({
        method: 'eth_chainId',
      })) as string

      setWallet({
        address: accounts[0] ?? null,
        chainId: Number.parseInt(freshChainIdHex, 16),
        pending: false,
        error: null,
      })
    } catch (error) {
      setWallet((previous) => ({
        ...previous,
        pending: false,
        error: error instanceof Error ? error.message : 'Wallet connection failed.',
      }))
    }
  }

  function togglePlayback() {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      void video.play()
      return
    }

    video.pause()
  }

  function toggleMuted() {
    const video = videoRef.current
    if (!video) return

    const nextMuted = !isMuted
    video.muted = nextMuted
    setIsMuted(nextMuted)
  }

  function scrubTo(nextTime: number) {
    const video = videoRef.current
    if (!video) return

    video.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  return (
    <main className="shell">
      <section className="board">
        <header className="masthead">
          <div>
            <p className="eyeline">Monad Blitz London build</p>
            <h1>Midroll</h1>
          </div>

          <div className="masthead-meta">
            <div className="status-chip">
              <span className="status-dot" />
              {MONAD_TESTNET.label}
            </div>
            <div className="wallet-chip">
              <div>
                <span className="chip-label">Funding wallet</span>
                <strong>
                  {wallet.address ? shortenAddress(wallet.address) : 'Not connected'}
                </strong>
              </div>
              <button
                type="button"
                className="wallet-button"
                onClick={connectWallet}
                disabled={wallet.pending}
              >
                {wallet.pending ? 'Connecting…' : wallet.address ? 'Refresh' : 'Connect'}
              </button>
            </div>
          </div>
        </header>

        {wallet.error ? <p className="eyeline">{wallet.error}</p> : null}

        <section className="hero-grid">
          <article className="video-card">
            <div className="video-frame">
              <div className="video-stage-header">
                <span className={`segment-pill ${sponsorActive ? 'live' : ''}`}>
                  Sponsor segment {sponsorActive ? 'active' : 'armed'}
                </span>
                <span className="clock-pill">
                  {formatTime(Math.max(currentTime - SPONSOR_SEGMENT.start, 0))} /{' '}
                  {formatTime(SPONSOR_SEGMENT.end - SPONSOR_SEGMENT.start)}
                </span>
              </div>

              <video
                ref={videoRef}
                className="video-player"
                preload="auto"
                poster={VIDEO_POSTER}
                playsInline
                muted
                src={VIDEO_URL}
              />

              <div className="video-sponsor-strip">
                <div
                  className="video-sponsor-progress"
                  style={{ width: `${sponsorProgress * 100}%` }}
                />
              </div>

              <div className="video-controls">
                <div className="video-buttons">
                  <button type="button" className="control-button" onClick={togglePlayback}>
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button type="button" className="control-button muted" onClick={toggleMuted}>
                    {isMuted ? 'Muted' : 'Sound'}
                  </button>
                </div>

                <div className="scrubber-block">
                  <input
                    className="scrubber"
                    type="range"
                    min={0}
                    max={duration}
                    value={currentTime}
                    step={0.05}
                    onChange={(event) => scrubTo(Number(event.target.value))}
                    style={{ background: timelineBackground }}
                    aria-label="Video timeline"
                  />
                  <div className="scrubber-labels">
                    <span>{formatTime(0)}</span>
                    <span>
                      Sponsor {formatTime(SPONSOR_SEGMENT.start)} -{' '}
                      {formatTime(SPONSOR_SEGMENT.end)}
                    </span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="video-footnote">
              <span>Brand budget: {formatMon(BASE_FUNDED_MON, 2)} MON</span>
              <span>Rate: {formatMon(RATE_PER_WATCHED_SECOND_MON, 4)} MON / watched second</span>
              <span>{videoReady ? 'Local demo video loaded' : 'Loading media…'}</span>
            </div>
          </article>

          <aside className="metrics-panel">
            <div className="join-card">
              <div>
                <p className="join-label">Join on your phone</p>
                <strong className="join-domain">{DEMO_DOMAIN}</strong>
                <div className="join-code">{JOIN_CODE}</div>
              </div>
              <QrGlyph />
            </div>

            <MetricCard
              label="Brand escrow remaining"
              value={`${formatMon(escrowRemainingMon, 3)} MON`}
              note={`Current drain: ${formatMon(currentRunRateMon, 3)} MON / second`}
            />
            <MetricCard
              label="Creator earned"
              value={`${formatMon(campaignState.creatorEarnedMon, 3)} MON`}
              note={
                sponsorActive
                  ? 'Growing only while the sponsor segment is watched'
                  : 'Paused until sponsor playback resumes'
              }
            />
            <MetricCard
              label="Watched sponsor seconds"
              value={`${Math.round(campaignState.watchedSeconds).toLocaleString()}s`}
              note="Aggregate across all joined sessions"
              accent
            />
            <MetricCard
              label="Live sessions"
              value={`${activeSessions}`}
              note={`${SESSION_COUNT} joined via QR`}
            />

            <div className="proof-row">
              <a href={MONAD_TESTNET.explorerUrl} target="_blank" rel="noreferrer">
                Open MonadScan
              </a>
              <span className={walletOnMonad ? 'proof-ok' : 'proof-warn'}>
                {walletOnMonad ? 'Wallet on Monad' : 'Switch wallet to Monad'}
              </span>
            </div>
          </aside>
        </section>

        <section className="lower-grid">
          <article className="panel feed-panel">
            <div className="panel-head">
              <h2>Live settlements</h2>
              <span className={`live-tag ${sponsorActive ? 'active' : ''}`}>
                {sponsorActive ? 'LIVE' : 'STANDBY'}
              </span>
            </div>
            <ul className="feed-list">
              {feedItems.map((item) => (
                <li key={item.hash} className="feed-item">
                  <div className="feed-badge">↘</div>
                  <div className="feed-copy">
                    <strong>+{item.watchedSeconds.toFixed(1)}s watched</strong>
                    <a
                      href={`${MONAD_TESTNET.explorerUrl}/tx/${item.hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortenHash(item.hash)}
                    </a>
                  </div>
                  <div className="feed-amount">
                    <strong>+{formatMon(item.payoutMon, 3)} MON</strong>
                    <span>{getRelativeAge(item.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel swarm-panel">
            <div className="panel-head">
              <h2>Audience swarm</h2>
              <span>{activeSessions} attentive now</span>
            </div>
            <div className="swarm-field" aria-hidden="true">
              {SWARM_POINTS.map((point) => {
                const heat = getPointHeat(point.seed, currentTime, sponsorActive)
                return (
                  <span
                    key={point.id}
                    className={`swarm-dot ${heat > 0.62 ? 'active' : ''} ${
                      heat > 0.82 ? 'hot' : ''
                    }`}
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                      opacity: 0.16 + heat * 0.84,
                    }}
                  />
                )
              })}
            </div>
            <div className="swarm-legend">
              <span>
                <i className="legend-dot active" />
                Watching now
              </span>
              <span>
                <i className="legend-dot" />
                Idle or skipped
              </span>
            </div>
          </article>

          <article className="panel phone-panel">
            <div className="phone-shell">
              <div className="phone-camera" />
              <div className="phone-screen">
                <div className="phone-top">
                  <strong>Midroll</strong>
                  <span className="phone-live">{sponsorActive ? 'LIVE' : 'QUEUE'}</span>
                </div>

                <div
                  className="phone-video"
                  style={{ backgroundImage: `url(${VIDEO_POSTER})` }}
                >
                  <div className={`phone-segment-tag ${sponsorActive ? 'live' : ''}`}>
                    {sponsorActive ? 'Sponsor segment active' : 'Sponsor segment queued'}
                  </div>
                  <div className="phone-progress">
                    <span style={{ width: `${(currentTime / duration) * 100}%` }} />
                  </div>
                </div>

                <div className="phone-metric">
                  <span className="phone-metric-label">Watched sponsor seconds</span>
                  <strong>{Math.round(campaignState.watchedSeconds)}</strong>
                  <p>
                    {sponsorActive
                      ? 'Keep watching. Money is flowing now.'
                      : 'Skip the segment and the meter stops.'}
                  </p>
                </div>

                <div className="phone-session">
                  <div>
                    <span>Session status</span>
                    <strong>{sponsorActive ? 'Watching now' : 'Waiting on sponsor cue'}</strong>
                  </div>
                  <div>
                    <span>Active viewers</span>
                    <strong>{activeSessions}</strong>
                  </div>
                </div>

                <div className="phone-callout">
                  Watching now contributes to creator payout.
                </div>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  )
}

function MetricCard({
  label,
  value,
  note,
  accent = false,
}: {
  label: string
  value: string
  note: string
  accent?: boolean
}) {
  return (
    <section className={`metric-card ${accent ? 'accent' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </section>
  )
}

function QrGlyph() {
  return (
    <svg className="qr-code" viewBox="0 0 76 76" role="presentation" aria-hidden="true">
      <rect width="76" height="76" rx="10" fill="#fffdf8" />
      <rect x="6" y="6" width="18" height="18" rx="2" fill="#111111" />
      <rect x="10" y="10" width="10" height="10" rx="1" fill="#fffdf8" />
      <rect x="52" y="6" width="18" height="18" rx="2" fill="#111111" />
      <rect x="56" y="10" width="10" height="10" rx="1" fill="#fffdf8" />
      <rect x="6" y="52" width="18" height="18" rx="2" fill="#111111" />
      <rect x="10" y="56" width="10" height="10" rx="1" fill="#fffdf8" />
      {[
        [30, 8],
        [36, 8],
        [42, 8],
        [30, 14],
        [42, 14],
        [28, 22],
        [36, 22],
        [44, 22],
        [30, 30],
        [38, 30],
        [46, 30],
        [26, 38],
        [34, 38],
        [42, 38],
        [50, 38],
        [30, 46],
        [38, 46],
        [46, 46],
        [54, 46],
        [28, 54],
        [36, 54],
        [44, 54],
        [52, 54],
        [30, 62],
        [42, 62],
        [54, 62],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" rx="1" fill="#111111" />
      ))}
    </svg>
  )
}

function isSponsorMoment(time: number) {
  return time >= SPONSOR_SEGMENT.start && time < SPONSOR_SEGMENT.end
}

function getSponsorProgress(time: number) {
  if (time <= SPONSOR_SEGMENT.start) return 0
  if (time >= SPONSOR_SEGMENT.end) return 1

  return (time - SPONSOR_SEGMENT.start) / (SPONSOR_SEGMENT.end - SPONSOR_SEGMENT.start)
}

function getTimelineBackground(duration: number) {
  const start = (SPONSOR_SEGMENT.start / duration) * 100
  const end = (SPONSOR_SEGMENT.end / duration) * 100

  return `linear-gradient(
    to right,
    #241f19 0%,
    #241f19 ${start}%,
    rgba(255, 97, 76, 0.78) ${start}%,
    rgba(255, 97, 76, 0.78) ${end}%,
    #241f19 ${end}%,
    #241f19 100%
  )`
}

function getPointHeat(seed: number, time: number, sponsorActive: boolean) {
  const wave =
    Math.sin(seed * 1.4 + time * 0.92) +
    Math.cos(seed * 0.8 + time * 1.37) +
    Math.sin(seed * 0.28 + time * 2.11)

  const normalized = (wave + 3) / 6
  if (!sponsorActive) return normalized * 0.22
  return 0.38 + normalized * 0.62
}

function getActiveSessionCount(time: number, sponsorActive: boolean) {
  return SWARM_POINTS.filter((point) => getPointHeat(point.seed, time, sponsorActive) > 0.62)
    .length
}

function createFeedItem(
  payoutMon: number,
  watchedSeconds: number,
  ageMs: number,
  serial = 1,
): FeedItem {
  const hashSource = Math.abs(Math.sin(serial * 44.7) * 10 ** 16)
    .toString(16)
    .replace('.', '')
    .padEnd(64, '0')
    .slice(0, 64)

  return {
    hash: `0x${hashSource}`,
    watchedSeconds,
    payoutMon,
    createdAt: Date.now() - ageMs,
  }
}

function formatTime(value: number) {
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatMon(value: number, digits: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function shortenAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function shortenHash(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}

function getRelativeAge(createdAt: number) {
  const diffSeconds = Math.max(0, Math.round((Date.now() - createdAt) / 1000))
  if (diffSeconds <= 1) return 'just now'
  return `${diffSeconds}s ago`
}

export default App
