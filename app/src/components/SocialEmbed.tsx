import type { ClutchReel } from '../lib/reels'
import { TikTokEmbed } from './TikTokEmbed'

/**
 * Render the exact catalog post through TikTok's official embedded player.
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
