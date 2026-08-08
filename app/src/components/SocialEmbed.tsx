import { TikTokEmbed } from './TikTokEmbed'
import type { ClutchReel } from '../lib/reels'

/** Render the verified catalog account/post pair with TikTok's official player. */
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
