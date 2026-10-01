import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'
import QRCode from 'qrcode'
import '../styles/desktop-feed.css'
import { BetPanel } from './BetPanel'
import { CreatorAvatar } from './CreatorAvatar'
import { SocialEmbed } from './SocialEmbed'
import '../styles/bet-panel.css'
import type { Market, PricePoint, TradeEvent } from '../lib/useClutch'
import type { ClutchReel } from '../lib/reels'
import type { WalletTransaction } from '../lib/txHistory'
import { fmtMon, short } from '../lib/chain'
import {
  ClutchMark,
  IconBookmark,
  IconChevronDown,
  IconChevronUp,
  IconComment,
  IconCompass,
  IconDevice,
  IconFollowing,
  IconHeart,
  IconHome,
  IconKebab,
  IconLive,
  IconMore,
  IconMuted,
  IconPlus,
  IconProfile,
  IconSearch,
  IconShare,
  IconSound,
  IconUpload,
  IconVerified,
} from './icons'

const NAV = [
  { key: 'For You', Icon: IconHome },
  { key: 'Explore', Icon: IconCompass },
  { key: 'Following', Icon: IconFollowing },
  { key: 'LIVE', Icon: IconLive },
  { key: 'Upload', Icon: IconUpload },
  { key: 'Profile', Icon: IconProfile },
  { key: 'More', Icon: IconMore },
] as const

type NavKey = (typeof NAV)[number]['key']

/** Stable pseudo-counts so the rail looks alive without pretending to be real data. */
function seededCount(id: string, salt: number, max: number) {
  let h = salt
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % max) + 1
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`)

export type DesktopFeedProps = {
  reels: ClutchReel[]
  index: number
  onIndexChange: (next: number) => void
  marketQuestion: string | null
  marketTiming: string
  pYes: number
  canBet: boolean
  busy: boolean
  pending: string | null
  error: string | null
  stake: string
  stakes: readonly string[]
  onStakeChange: (next: string) => void
  onBet: (isYes: boolean) => void
  onFund?: () => boolean | Promise<boolean>
  address: string
  balance: bigint
  yesShares: bigint
  noShares: bigint
  trackedYesShares: bigint
  trackedNoShares: bigint
  costBasis: bigint
  positionValue: bigint
  pnl: bigint
  liked: Record<string, boolean>
  saved: Record<string, boolean>
  followed: Record<string, boolean>
  extraComments: Record<string, number>
  onToggleLike: (id: string) => void
  onToggleSave: (id: string) => void
  onToggleFollow: (id: string) => void
  onComment: (id: string) => void
  market: Market | null
  resolved: boolean
  outcomeYes: boolean
  onSell: (isYes: boolean) => void
  onRedeem: () => void
  trades: TradeEvent[]
  series: PricePoint[]
  walletTransactions: WalletTransaction[]
  liveReelIds: string[]
}

export function DesktopFeed({
  reels,
  index,
  onIndexChange,
  marketQuestion,
  marketTiming,
  pYes,
  canBet,
  busy,
  pending,
  error,
  stake,
  stakes,
  onStakeChange,
  onBet,
  onFund,
  address,
  balance,
  yesShares,
  noShares,
  trackedYesShares,
  trackedNoShares,
  costBasis,
  positionValue,
  pnl,
  liked,
  saved,
  followed,
  extraComments,
  onToggleLike,
  onToggleSave,
  onToggleFollow,
  onComment,
  market,
  resolved,
  outcomeYes,
  onSell,
  onRedeem,
  trades,
  series,
  walletTransactions,
  liveReelIds,
}: DesktopFeedProps) {
  const [nav, setNav] = useState<NavKey>('For You')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [tab, setTab] = useState<'Comments' | 'You may like'>('You may like')
  const [muted, setMuted] = useState(true)
  const [mobileBetOpen, setMobileBetOpen] = useState(false)
  const [joinQr, setJoinQr] = useState('')
  const wheelDelta = useRef(0)
  const wheelLocked = useRef(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const searchInput = useRef<HTMLInputElement>(null)

  const reel = reels[index] ?? reels[0] ?? null
  const joinUrl = useMemo(() => `${window.location.origin}/join`, [])
  const liveIds = useMemo(() => new Set(liveReelIds), [liveReelIds])
  const followedReels = useMemo(
    () => reels.filter((candidate) => followed[candidate.id]),
    [followed, reels]
  )
  const liveReels = useMemo(
    () => reels.filter((candidate) => liveIds.has(candidate.id)),
    [liveIds, reels]
  )
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return reels
    return reels.filter((candidate) =>
      [
        candidate.creator,
        candidate.displayName,
        candidate.category,
        candidate.caption,
        candidate.marketQuestion,
      ].some((value) => value.toLowerCase().includes(query))
    )
  }, [reels, search])

  const activeReels = nav === 'Following' ? followedReels : nav === 'LIVE' ? liveReels : reels

  useEffect(() => {
    setMuted(true)
  }, [reel?.id])

  useEffect(() => {
    void QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 420,
      color: { dark: '#161823', light: '#ffffff' },
    }).then(setJoinQr)
  }, [joinUrl])

  const step = (delta: 1 | -1) => {
    if (activeReels.length === 0) return
    const currentId = reels[index]?.id
    const activeIndex = Math.max(0, activeReels.findIndex((candidate) => candidate.id === currentId))
    const next = activeReels[(activeIndex + delta + activeReels.length) % activeReels.length]
    const nextIndex = reels.findIndex((candidate) => candidate.id === next.id)
    if (nextIndex >= 0) onIndexChange(nextIndex)
  }

  const selectReel = (candidate: ClutchReel) => {
    const nextIndex = reels.findIndex((item) => item.id === candidate.id)
    if (nextIndex >= 0) onIndexChange(nextIndex)
    setSearchOpen(false)
  }

  const selectNav = (next: NavKey) => {
    if (next === 'Upload') {
      window.location.assign('/admin')
      return
    }

    setNav(next)
    setSearchOpen(next === 'Explore')
    if (next === 'Explore') {
      window.requestAnimationFrame(() => searchInput.current?.focus())
      return
    }

    const candidates = next === 'Following' ? followedReels : next === 'LIVE' ? liveReels : null
    if (candidates?.[0]) selectReel(candidates[0])
  }

  const commitStep = (delta: 1 | -1) => {
    if (wheelLocked.current) return
    wheelLocked.current = true
    step(delta)
    window.setTimeout(() => {
      wheelLocked.current = false
      wheelDelta.current = 0
    }, 420)
  }

  const onStageWheel = (event: WheelEvent<HTMLElement>) => {
    const primaryDelta =
      Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
    if (Math.abs(primaryDelta) < 4) return

    event.preventDefault()
    wheelDelta.current += primaryDelta
    if (Math.abs(wheelDelta.current) < 80) return
    commitStep(wheelDelta.current > 0 ? 1 : -1)
  }

  const onPlayerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointerStart.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPlayerPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const primary = Math.abs(dy) >= Math.abs(dx) ? dy : -dx
    if (Math.abs(primary) < 72) return
    commitStep(primary > 0 ? 1 : -1)
  }

  const suggestions = useMemo(
    () => reels.filter((_, i) => i !== index).slice(0, 4),
    [reels, index]
  )

  if (!reel) return null

  const likes = seededCount(reel.id, 7, 400) + (liked[reel.id] ? 1 : 0)
  const commentCount = seededCount(reel.id, 13, 40) + (extraComments[reel.id] ?? 0)
  const saves = seededCount(reel.id, 29, 60) + (saved[reel.id] ? 1 : 0)
  const shares = seededCount(reel.id, 41, 30)
  const isFollowing = Boolean(followed[reel.id])

  return (
    <div className="tt-app">
      {/* ------------------------------------------------------- sidebar */}
      <aside className="tt-sidebar">
        <div className="tt-logo">
          <ClutchMark size={30} />
          <strong>Clutch</strong>
        </div>

        <div className={`tt-search ${searchOpen ? 'is-open' : ''}`}>
          <IconSearch size={19} />
          <input
            ref={searchInput}
            placeholder="Search creators or markets"
            aria-label="Search creators or markets"
            value={search}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setSearchOpen(false)
                event.currentTarget.blur()
              }
              if (event.key === 'Enter' && searchResults[0]) selectReel(searchResults[0])
            }}
          />
          {search && (
            <button
              type="button"
              className="tt-search-clear"
              aria-label="Clear search"
              onClick={() => {
                setSearch('')
                searchInput.current?.focus()
              }}
            >
              ×
            </button>
          )}
        </div>

        {searchOpen && (
          <div className="tt-search-results" aria-label="Search results">
            <div className="tt-search-results-head">
              <strong>{search ? `${searchResults.length} results` : 'Explore creators'}</strong>
              <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search">
                Done
              </button>
            </div>
            {searchResults.length > 0 ? (
              searchResults.slice(0, 5).map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="tt-search-result"
                  onClick={() => selectReel(candidate)}
                >
                  <CreatorAvatar reel={candidate} />
                  <span>
                    <strong>{candidate.displayName}</strong>
                    <small>{candidate.creator} · {candidate.category}</small>
                  </span>
                </button>
              ))
            ) : (
              <p>No creators or markets match “{search}”.</p>
            )}
          </div>
        )}

        <nav className="tt-nav">
          {NAV.map(({ key, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => selectNav(key)}
              className={nav === key ? 'is-active' : ''}
            >
              <Icon size={26} filled={nav === key} />
              {key}
            </button>
          ))}
        </nav>

        {nav === 'Following' && (
          <div className="tt-nav-context">
            <strong>Following</strong>
            {followedReels.length > 0 ? (
              <>
                <span>{followedReels.length} creator{followedReels.length === 1 ? '' : 's'} in your feed</span>
                {followedReels.slice(0, 3).map((candidate) => (
                  <button key={candidate.id} type="button" onClick={() => selectReel(candidate)}>
                    {candidate.creator}
                  </button>
                ))}
              </>
            ) : (
              <span>Follow a creator with the + button beside their video, then they’ll appear here.</span>
            )}
          </div>
        )}

        {nav === 'LIVE' && (
          <div className="tt-nav-context">
            <strong>Live markets</strong>
            {liveReels.length > 0 ? (
              liveReels.map((candidate) => (
                <button key={candidate.id} type="button" onClick={() => selectReel(candidate)}>
                  <i /> {candidate.creator}
                </button>
              ))
            ) : (
              <span>No markets are live right now. Watch-only clips remain available in For You.</span>
            )}
          </div>
        )}

        {nav === 'Profile' && (
          <div className="tt-nav-context tt-profile-card">
            <strong>Your testnet profile</strong>
            <span className="nums">{short(address, 8, 6)}</span>
            <b className="nums">{fmtMon(balance, 3)} MON</b>
            <span>{walletTransactions.length} wallet transaction{walletTransactions.length === 1 ? '' : 's'} · {followedReels.length} following</span>
            <a href={`https://testnet.monadscan.com/address/${address}`} target="_blank" rel="noreferrer">
              View on MonadScan ↗
            </a>
          </div>
        )}

        {nav === 'More' && (
          <div className="tt-nav-context tt-more-links">
            <strong>More from Clutch</strong>
            <a href="/join">Open audience join</a>
            <a href="/admin">Host console</a>
            <a href="https://testnet.monadscan.com" target="_blank" rel="noreferrer">MonadScan ↗</a>
          </div>
        )}

        <a className="tt-join-card" href={joinUrl} aria-label="Open audience join flow">
          {joinQr && <img src={joinQr} alt="Scan to join Clutch" />}
          <span>
            <strong>Scan to trade</strong>
            <small>Instant burner wallet + testnet MON</small>
          </span>
        </a>

        {onFund ? (
          <button
            type="button"
            className="tt-cta"
            onClick={() => void onFund()}
            disabled={busy || balance > 0n}
          >
            {busy
              ? (pending ?? 'Funding wallet…')
              : balance > 0n
                ? `Ready to vote · ${fmtMon(balance, 2)} MON`
                : 'Get testnet MON'}
          </button>
        ) : (
          <a className="tt-cta" href="/" style={{ display: 'grid', placeItems: 'center' }}>
            Get testnet MON
          </a>
        )}

        <div className="tt-wallet">
          <span>{short(address, 6, 4)}</span>
          <strong className="nums">{fmtMon(balance)} MON</strong>
        </div>

        <div className="tt-foot">
          <span>Company</span>
          <span>Programme</span>
          <span>Terms &amp; Policies</span>
          <span>© 2026 Clutch · Monad testnet</span>
        </div>
      </aside>

      {/* -------------------------------------------------------- centre */}
      <main className="tt-stage" onWheel={onStageWheel}>
        <div
          className="tt-player"
          onPointerDown={onPlayerPointerDown}
          onPointerUp={onPlayerPointerEnd}
          onPointerCancel={() => {
            pointerStart.current = null
          }}
        >
          <SocialEmbed reel={reel} muted={muted} preferLocal />

          <div className="tt-player-top">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <IconMuted size={21} /> : <IconSound size={21} />}
            </button>
            <a
              className="tt-embed-toggle"
              href={reel.profileUrl}
              target="_blank"
              rel="noreferrer"
            >
              {reel.creator}
            </a>
          </div>

          <div className={`tt-caption-chip ${market ? 'is-live' : 'is-preview'}`}>
            <div className="tt-caption-status">
              <span>{market ? 'Live market' : 'Market coming soon'}</span>
              <span className="nums">
                {market
                  ? `${(pYes / 100).toFixed(1)}% YES · ${marketTiming.split(' · ').at(-1)}`
                  : 'Watch-only clip'}
              </span>
            </div>
            <strong>{marketQuestion ?? reel.marketQuestion}</strong>
            <p>{reel.caption}</p>
          </div>
        </div>

        {/* ----------------------------------------------------- rail */}
        <div className="tt-rail">
          <div className="tt-rail-nav">
            <button type="button" onClick={() => step(-1)} aria-label="Previous video">
              <IconChevronUp size={22} />
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Next video">
              <IconChevronDown size={22} />
            </button>
          </div>

          <div className="tt-rail-avatar">
            <CreatorAvatar reel={reel} />
            <button
              type="button"
              onClick={() => onToggleFollow(reel.id)}
              className={`tt-rail-follow ${isFollowing ? 'is-following' : ''}`}
              aria-label={isFollowing ? 'Unfollow' : 'Follow'}
            >
              <IconPlus size={11} />
            </button>
          </div>

          <div className="tt-rail-item">
            <button
              type="button"
              onClick={() => onToggleLike(reel.id)}
              className={`tt-rail-btn ${liked[reel.id] ? 'is-liked' : ''}`}
              aria-label="Like"
            >
              <IconHeart size={25} filled={Boolean(liked[reel.id])} />
            </button>
            {compact(likes)}
          </div>

          <div className="tt-rail-item">
            <button
              type="button"
              className="tt-rail-btn"
              onClick={() => {
                onComment(reel.id)
                setTab('Comments')
              }}
              aria-label="Comment"
            >
              <IconComment size={25} />
            </button>
            {compact(commentCount)}
          </div>

          <div className="tt-rail-item">
            <button
              type="button"
              onClick={() => onToggleSave(reel.id)}
              className={`tt-rail-btn ${saved[reel.id] ? 'is-liked' : ''}`}
              aria-label="Save"
            >
              <IconBookmark size={24} filled={Boolean(saved[reel.id])} />
            </button>
            {compact(saves)}
          </div>

          <div className="tt-rail-item">
            <a
              className="tt-rail-btn"
              href={reel.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open source post"
            >
              <IconShare size={24} />
            </a>
            {compact(shares)}
          </div>
        </div>
      </main>

      {/* ---------------------------------------------------- right panel */}
      <aside className={`tt-panel ${mobileBetOpen ? 'is-mobile-open' : ''}`}>
        <div className="tt-panel-top">
          <div className="tt-icon-pill">
            <button type="button" aria-label="Clutch">
              <ClutchMark size={22} />
            </button>
            <button type="button" aria-label="Get the app">
              <IconDevice size={20} />
            </button>
          </div>
          <button type="button" className="tt-panel-cta" onClick={() => setTab('You may like')}>
            {fmtMon(balance, 2)} MON
          </button>
          <button
            type="button"
            className="tt-mobile-open"
            disabled={busy}
            aria-live="polite"
            onClick={async () => {
              if (!market) {
                setMobileBetOpen(true)
                return
              }
              if (balance === 0n && onFund) {
                const funded = await onFund()
                if (funded) setMobileBetOpen(true)
                return
              }
              setMobileBetOpen(true)
            }}
          >
            <span>
              {busy
                ? (pending ?? 'Confirming…')
                : !market
                  ? 'Market coming soon'
                : balance === 0n
                  ? error
                    ? 'Retry funding'
                    : 'Get testnet MON'
                  : 'Trade now'}
            </span>
            <strong className="nums">
              {!market
                ? 'Watch-only clip'
                : balance === 0n
                  ? error
                  ? 'Tap to try again'
                  : 'Free testnet funds'
                : `${(pYes / 100).toFixed(1)}% YES`}
            </strong>
          </button>
          <button
            type="button"
            className="tt-mobile-close"
            onClick={() => setMobileBetOpen(false)}
            aria-label="Close betting panel"
          >
            <span>Place a bet</span>
            <strong className="nums">{fmtMon(balance, 3)} MON · Close</strong>
          </button>
        </div>

        <div className="tt-bet">
          <BetPanel
            market={market}
            question={marketQuestion}
            timing={marketTiming}
            pYes={pYes}
            canBet={canBet}
            resolved={resolved}
            outcomeYes={outcomeYes}
            busy={busy}
            pending={pending}
            error={error}
            stake={stake}
            stakes={stakes}
            onStakeChange={onStakeChange}
            onBet={onBet}
            onSell={onSell}
            onRedeem={onRedeem}
            yesShares={yesShares}
            noShares={noShares}
            trackedYesShares={trackedYesShares}
            trackedNoShares={trackedNoShares}
            costBasis={costBasis}
            positionValue={positionValue}
            pnl={pnl}
            balance={balance}
            trades={trades}
            series={series}
            address={address}
            walletTransactions={walletTransactions}
          />
        </div>

        <nav className="tt-tabs">
          {(['Comments', 'You may like'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={tab === t ? 'is-active' : ''}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="tt-panel-body">
          {tab === 'You may like' ? (
            <div className="tt-grid">
              {suggestions.map((s) => {
                const at = reels.indexOf(s)
                return (
                  <button key={s.id} type="button" className="tt-card" onClick={() => onIndexChange(at)}>
                    <div className="tt-thumb">
                      <span className="tt-thumb-badge">{s.platform}</span>
                      <div className="tt-thumb-account">
                        <CreatorAvatar reel={s} />
                        <span>{s.creator}</span>
                      </div>
                    </div>
                    <div className="tt-card-title">{s.marketQuestion}</div>
                    <div className="tt-card-user">
                      {s.creator}
                      <IconVerified size={14} />
                    </div>
                    <div className="tt-card-stats">
                      <IconHeart size={14} filled /> {compact(seededCount(s.id, 7, 400))}
                      <span>· {s.minutes}m</span>
                      <span className="tt-card-kebab">
                        <IconKebab size={16} />
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div>
              {reel.commentsPreview.length === 0 && (
                <p className="tt-comment-empty">No comments yet.</p>
              )}
              {reel.commentsPreview.map((c) => (
                <div className="tt-comment" key={`${reel.id}-${c.author}`}>
                  <div className="tt-comment-avatar">
                    {c.author.replace('@', '').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="tt-comment-body">
                    <strong>{c.author}</strong>
                    <p>{c.text}</p>
                  </div>
                </div>
              ))}
              {(extraComments[reel.id] ?? 0) > 0 && (
                <div className="tt-comment">
                  <div className="tt-comment-avatar">ME</div>
                  <div className="tt-comment-body">
                    <strong>{short(address, 5, 3)}</strong>
                    <p>Reacted {extraComments[reel.id]}× from this device.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
