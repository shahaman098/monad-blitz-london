import { PlayableVideo } from './PlayableVideo'
import { TikTokEmbed } from './TikTokEmbed'
import type { ClutchReel } from '../lib/reels'

/**
 * Feed playback via TikTok's official player, so the clip on screen is the
 * verified post from the catalog rather than stand-in footage.
 *
 * `preferLocal` swaps to the bundled MP4 — kept as an escape hatch, because the
 * iframe cannot degrade on its own if the venue network blocks tiktok.com.
 */
export function SocialEmbed({
  compact = false,
  forcePlay = true,
  muted = true,
  preferLocal = false,
  reel,
}: {
  compact?: boolean
  forcePlay?: boolean
  muted?: boolean
  preferLocal?: boolean
  reel: ClutchReel
}) {
  if (preferLocal) {
    return (
      <div className={`social-embed-shell local-video-shell ${compact ? 'is-compact' : ''}`}>
        <video
          className="social-embed-bg"
          src={reel.videoSrc}
          muted
          loop
          playsInline
          autoPlay={forcePlay}
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
        />
        <PlayableVideo
          key={reel.id}
          src={reel.videoSrc}
          aria-label={`${reel.displayName}: ${reel.caption}`}
          forcePlay={forcePlay}
          playWhenVisible={!forcePlay}
          muted={muted}
          loop
          playsInline
          preload="auto"
        />
        <a
          className="social-embed-fallback is-quiet"
          href={reel.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open on {reel.sourceLabel}
        </a>
      </div>
    )
  }

  return (
    <TikTokEmbed
      videoId={reel.tiktokVideoId}
      caption={`${reel.displayName}: ${reel.caption}`}
      sourceUrl={reel.sourceUrl}
      compact={compact}
      autoplay={forcePlay}
      muted={muted}
    />
  )
}
