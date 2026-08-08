import { PlayableVideo } from './PlayableVideo'
import { TikTokEmbed } from './TikTokEmbed'
import type { ClutchReel } from '../lib/reels'

/**
 * Feed playback.
 *
 * Defaults to the locally hosted clip: TikTok's iframe drops a cookie-consent
 * dialog over the video, requires a live connection to tiktok.com, and cannot
 * be styled or muted reliably — all of which are liabilities on a projector
 * over venue wifi. The verified post URL stays on the card as attribution.
 *
 * Pass `preferEmbed` to render TikTok's official player instead.
 */
export function SocialEmbed({
  compact = false,
  forcePlay = true,
  muted = true,
  preferEmbed = false,
  backdrop = false,
  reel,
}: {
  compact?: boolean
  forcePlay?: boolean
  muted?: boolean
  preferEmbed?: boolean
  backdrop?: boolean
  reel: ClutchReel
}) {
  if (preferEmbed) {
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

  return (
    <div className={`social-embed-shell ${compact ? 'is-compact' : ''}`}>
      {/* The clips are 16:9 in a 9:16 frame. A blurred copy fills the letterbox
          the way vertical feeds do. Opt-in, because it costs a second decode. */}
      {backdrop && (
        <video
          className="social-embed-bg"
          src={reel.videoSrc}
          muted
          loop
          playsInline
          autoPlay
          aria-hidden="true"
          tabIndex={-1}
        />
      )}
      <PlayableVideo
        key={reel.id}
        src={reel.videoSrc}
        poster={reel.posterSrc}
        forcePlay={forcePlay}
        playWhenVisible={!forcePlay}
        muted={muted}
        loop
        playsInline
      />
      <a
        className="social-embed-fallback"
        href={reel.sourceUrl}
        target="_blank"
        rel="noreferrer"
      >
        Open on {reel.sourceLabel}
      </a>
    </div>
  )
}
