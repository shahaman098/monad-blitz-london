import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'
import '../styles/desktop-feed.css'
import { BetPanel } from './BetPanel'
import { CreatorAvatar } from './CreatorAvatar'
import { SocialEmbed } from './SocialEmbed'
import '../styles/bet-panel.css'
import type { Market, PricePoint, TradeEvent } from '../lib/useClutch'
import type { ClutchReel } from '../lib/reels'
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
  onFund?: () => void
  address: string
  balance: bigint
  yesShares: bigint
  noShares: bigint
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
  seededUpTo: number
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
  seededUpTo,
}: DesktopFeedProps) {
  const [nav, setNav] = useState<string>('For You')
  const [tab, setTab] = useState<'Comments' | 'You may like'>('You may like')
  const [muted, setMuted] = useState(true)
  const wheelDelta = useRef(0)
  const wheelLocked = useRef(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  const reel = reels[index] ?? reels[0] ?? null

  useEffect(() => {
    setMuted(true)
  }, [reel?.id])

  const step = (delta: 1 | -1) => {
    if (reels.length === 0) return
    onIndexChange((index + delta + reels.length) % reels.length)
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

        <div className="tt-search">
          <IconSearch size={19} />
          <input placeholder="Search" aria-label="Search" />
        </div>

        <nav className="tt-nav">
          {NAV.map(({ key, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setNav(key)}
              className={nav === key ? 'is-active' : ''}
            >
              <Icon size={26} filled={nav === key} />
              {key}
            </button>
          ))}
        </nav>

        {onFund ? (
          <button type="button" className="tt-cta" onClick={onFund} disabled={busy}>
            Get testnet MON
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
          <SocialEmbed reel={reel} muted={muted} />

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
      <aside className="tt-panel">
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
            pnl={pnl}
            balance={balance}
            trades={trades}
            series={series}
            seededUpTo={seededUpTo}
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
