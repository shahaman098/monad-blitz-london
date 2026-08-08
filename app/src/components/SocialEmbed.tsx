import type { ClutchReel } from '../lib/reels'

/**
 * Feed playback prefers local clips so the hackathon demo never shows a blank
 * iframe or cookie prompt. The verified TikTok post remains one click away.
 */
export function SocialEmbed({
  compact = false,
  forcePlay = true,
  muted = true,
  reel,
}: {
  compact?: boolean
  forcePlay?: boolean
  muted?: boolean
  reel: ClutchReel
}) {
  return (
    <div className={`social-embed-shell local-video-shell ${compact ? 'is-compact' : ''}`}>
      <video
        src={reel.videoSrc}
        aria-label={`${reel.displayName}: ${reel.caption}`}
        autoPlay={forcePlay}
        muted={muted}
        loop
        playsInline
        preload="metadata"
      />
      <a className="social-embed-fallback is-quiet" href={reel.sourceUrl} target="_blank" rel="noreferrer">
        Open on TikTok
      </a>
    </div>
  )
}
