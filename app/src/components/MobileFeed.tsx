import { useEffect, useRef, useState } from 'react'
import '../styles/mobile-feed.css'
import { BetPanel } from './BetPanel'
import { CreatorAvatar } from './CreatorAvatar'
import { SocialEmbed } from './SocialEmbed'
import '../styles/bet-panel.css'
import type { Market, PricePoint, TradeEvent } from '../lib/useClutch'
import type { ClutchReel } from '../lib/reels'
import { fmtMon } from '../lib/chain'
import {
  ClutchMark,
  IconBookmark,
  IconComment,
  IconHeart,
  IconHome,
  IconInbox,
  IconMusic,
  IconMuted,
  IconPlus,
  IconProfile,
  IconSearch,
  IconShare,
  IconSound,
  IconVerified,
} from './icons'

function seededCount(id: string, salt: number, max: number) {
  let h = salt
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % max) + 1
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`)

export type MobileFeedProps = {
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
  balance: bigint
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
  yesShares: bigint
  noShares: bigint
  pnl: bigint
  trades: TradeEvent[]
  series: PricePoint[]
  seededUpTo: number
}

export function MobileFeed({
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
  balance,
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
  yesShares,
  noShares,
  pnl,
  trades,
  series,
  seededUpTo,
}: MobileFeedProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [tab, setTab] = useState<'Following' | 'For You'>('For You')
  const [nav, setNav] = useState('Home')
  const [muted, setMuted] = useState(true)
  const [openCaption, setOpenCaption] = useState<string | null>(null)
  const [mode, setMode] = useState<'scroll' | 'swipe'>('scroll')
  const [drag, setDrag] = useState(0)
  const dragStart = useRef<number | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLElement | null)[]>([])
  const didAlignScroller = useRef(false)

  // Report the reel that is actually on screen back up, so the bet dock and
  // the projector stay pointed at the same clip.
  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    if (!didAlignScroller.current) {
      root.scrollTop = index * root.clientHeight
      didAlignScroller.current = true
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const at = slideRefs.current.indexOf(entry.target as HTMLElement)
            if (at >= 0 && at !== index) onIndexChange(at)
          }
        }
      },
      { root, threshold: [0.6] }
    )
    slideRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reels.length, index])

  const nextStake = () => {
    const at = stakes.indexOf(stake)
    onStakeChange(stakes[(at + 1) % stakes.length])
  }

  const advance = () => onIndexChange((index + 1) % Math.max(1, reels.length))

  // Swipe deck: right commits YES, left commits NO. Same bet path as the dock.
  const SWIPE_COMMIT = 96
  const endDrag = () => {
    if (dragStart.current === null) return
    dragStart.current = null
    if (Math.abs(drag) >= SWIPE_COMMIT) {
      if (canBet && !busy) onBet(drag > 0)
      advance()
    }
    setDrag(0)
  }

  if (reels.length === 0) return null

  const current = reels[Math.min(index, reels.length - 1)]

  const storyRail = (
    <div className="mt-strip">
      <div className="mt-stories">
        {reels.map((reel, i) => (
          <button
            key={reel.id}
            type="button"
            className={`mt-story ${followed[reel.id] ? 'is-following' : ''} ${
              i === index ? 'is-active' : ''
            }`}
            onClick={() => {
              onIndexChange(i)
              if (mode === 'scroll') {
                slideRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
          >
            <CreatorAvatar reel={reel} />
            <span>{reel.displayName}</span>
          </button>
        ))}
      </div>
      <div className="mt-mode" role="tablist" aria-label="Feed mode">
        {(['scroll', 'swipe'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={mode === m ? 'is-active' : ''}
          >
            {m === 'scroll' ? 'Scroll' : 'Swipe'}
          </button>
        ))}
      </div>
    </div>
  )

  const swipeDeck = (
    <div className="mt-deck">
      <div
        className="mt-card"
        style={{
          transform: `translateX(${drag}px) rotate(${drag / 26}deg)`,
          transition: dragStart.current === null ? 'transform 200ms ease' : 'none',
        }}
        onPointerDown={(e) => {
          dragStart.current = e.clientX
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (dragStart.current === null) return
          setDrag(e.clientX - dragStart.current)
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <SocialEmbed reel={current} muted={muted} />

        <span className="mt-hint mt-hint-yes" style={{ opacity: Math.max(0, drag / SWIPE_COMMIT) }}>
          YES
        </span>
        <span className="mt-hint mt-hint-no" style={{ opacity: Math.max(0, -drag / SWIPE_COMMIT) }}>
          NO
        </span>

        <div className="mt-card-scrim" />
        <div className="mt-card-meta">
          <strong>
            {current.creator}
            <IconVerified size={14} />
          </strong>
          <p>{current.marketQuestion}</p>
        </div>
      </div>
      <p className="mt-deck-help">Swipe right to bet YES · left to bet NO · tap a story to jump</p>
    </div>
  )

  return (
    <div className="mt-app">
      {mode === 'swipe' ? (
        swipeDeck
      ) : (
        <div
          className="mt-scroller"
          ref={scrollerRef}
          onScroll={(event) => {
            const root = event.currentTarget
            const at = Math.round(root.scrollTop / Math.max(1, root.clientHeight))
            const bounded = Math.min(reels.length - 1, Math.max(0, at))
            if (bounded !== index) onIndexChange(bounded)
          }}
        >
        {reels.map((reel, i) => {
          const likes = seededCount(reel.id, 7, 400) + (liked[reel.id] ? 1 : 0)
          const commentCount = seededCount(reel.id, 13, 40) + (extraComments[reel.id] ?? 0)
          const saves = seededCount(reel.id, 29, 60) + (saved[reel.id] ? 1 : 0)
          const shares = seededCount(reel.id, 41, 30)
          const isFollowing = Boolean(followed[reel.id])
          // Only the visible and adjacent slides mount third-party players.
          const near = Math.abs(i - index) <= 1

          return (
            <section
              className="mt-slide"
              key={reel.id}
              ref={(el) => {
                slideRefs.current[i] = el
              }}
            >
              {near ? (
                <SocialEmbed reel={reel} forcePlay={i === index} muted={muted} />
              ) : null}

              <div className="mt-rail">
                <div className="mt-rail-avatar">
                  <CreatorAvatar reel={reel} />
                  <button
                    type="button"
                    className={`mt-rail-follow ${isFollowing ? 'is-following' : ''}`}
                    onClick={() => onToggleFollow(reel.id)}
                    aria-label={isFollowing ? 'Unfollow' : 'Follow'}
                  >
                    <IconPlus size={12} />
                  </button>
                </div>

                <div className={`mt-rail-item ${liked[reel.id] ? 'is-liked' : ''}`}>
                  <button type="button" onClick={() => onToggleLike(reel.id)} aria-label="Like">
                    <IconHeart size={31} filled={Boolean(liked[reel.id])} />
                  </button>
                  {compact(likes)}
                </div>

                <div className="mt-rail-item">
                  <button type="button" onClick={() => onComment(reel.id)} aria-label="Comment">
                    <IconComment size={30} filled />
                  </button>
                  {compact(commentCount)}
                </div>

                <div className={`mt-rail-item ${saved[reel.id] ? 'is-liked' : ''}`}>
                  <button type="button" onClick={() => onToggleSave(reel.id)} aria-label="Save">
                    <IconBookmark size={29} filled={Boolean(saved[reel.id])} />
                  </button>
                  {compact(saves)}
                </div>

                <div className="mt-rail-item">
                  <a href={reel.sourceUrl} target="_blank" rel="noreferrer" aria-label="Share">
                    <IconShare size={28} />
                  </a>
                  {compact(shares)}
                </div>

                <div className="mt-disc">
                  <IconMusic size={16} filled />
                </div>
              </div>

              <div className="mt-meta">
                <div className="mt-meta-author">
                  {reel.creator}
                  <IconVerified size={15} />
                </div>
                <p
                  className={`mt-meta-caption ${openCaption === reel.id ? 'is-open' : ''}`}
                  onClick={() => setOpenCaption((c) => (c === reel.id ? null : reel.id))}
                >
                  {reel.caption} · {reel.marketQuestion}
                </p>
                <div className="mt-meta-music">
                  <IconMusic size={14} filled />
                  {reel.displayName} · {reel.category}
                  <a
                    href={reel.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.8 }}
                  >
                    Official {reel.platform}
                  </a>
                </div>
              </div>
            </section>
          )
        })}
        </div>
      )}

      {storyRail}

      {/* ------------------------------------------------------------ top */}
      <div className="mt-top">
        <button
          type="button"
          className="mt-top-btn"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <IconMuted size={22} /> : <IconSound size={22} />}
        </button>
        <div className="mt-tabs">
          {(['Following', 'For You'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={tab === t ? 'is-active' : ''}
            >
              {t}
            </button>
          ))}
        </div>
        <button type="button" className="mt-top-btn" aria-label="Search">
          <IconSearch size={22} />
        </button>
      </div>

      {/* ------------------------------------------------------- bet dock */}
      <div className="mt-dock">
        <button type="button" className="mt-dock-q" onClick={() => setSheetOpen(true)}>
          <strong>{marketQuestion ?? 'No bet open yet'}</strong>
          <span className="nums">
            {fmtMon(balance, 2)} MON <span className="mt-dock-more">Chart ›</span>
          </span>
        </button>
        <div className="mt-dock-row">
          <button
            type="button"
            className="mt-yes"
            disabled={!canBet || busy}
            onClick={() => onBet(true)}
          >
            YES <span className="nums">{(pYes / 100).toFixed(0)}¢</span>
          </button>
          <button
            type="button"
            className="mt-no"
            disabled={!canBet || busy}
            onClick={() => onBet(false)}
          >
            NO <span className="nums">{((10_000 - pYes) / 100).toFixed(0)}¢</span>
          </button>
          <button type="button" className="mt-stake" onClick={nextStake} aria-label="Change stake">
            {stake}
          </button>
        </div>
        <p className={`mt-dock-note ${error ? 'is-error' : ''}`}>
          {error ?? (pending ? `${pending}… confirming on Monad` : marketTiming)}
        </p>
      </div>

      {/* Full market sheet: chart, payout preview, cash out, activity. */}
      {sheetOpen && (
        <div className="mt-sheet-backdrop" onClick={() => setSheetOpen(false)}>
          <div
            className="mt-sheet"
            role="dialog"
            aria-label="Market details"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="mt-sheet-grip"
              onClick={() => setSheetOpen(false)}
              aria-label="Close"
            />
            <div className="mt-sheet-body">
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
                pnl={pnl}
                balance={balance}
                trades={trades}
                series={series}
                seededUpTo={seededUpTo}
              />
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------- bottom nav */}
      <nav className="mt-nav">
        {[
          { key: 'Home', Icon: IconHome },
          { key: 'Discover', Icon: IconSearch },
        ].map(({ key, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setNav(key)}
            className={nav === key ? 'is-active' : ''}
          >
            <Icon size={23} filled={nav === key} />
            {key}
          </button>
        ))}
        <button type="button" aria-label="Open a bet">
          <span className="mt-nav-plus">
            <IconPlus size={18} />
          </span>
        </button>
        {[
          { key: 'Inbox', Icon: IconInbox },
          { key: 'Profile', Icon: IconProfile },
        ].map(({ key, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setNav(key)}
            className={nav === key ? 'is-active' : ''}
          >
            <Icon size={23} filled={nav === key} />
            {key}
          </button>
        ))}
      </nav>

      <span hidden>
        <ClutchMark size={1} />
      </span>
    </div>
  )
}
