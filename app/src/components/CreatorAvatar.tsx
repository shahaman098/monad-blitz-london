import type { ClutchReel } from '../lib/reels'

export function CreatorAvatar({
  reel,
  className = '',
}: {
  reel: Pick<ClutchReel, 'avatar' | 'avatarSrc' | 'displayName'>
  className?: string
}) {
  if (reel.avatarSrc) {
    return (
      <img
        className={`creator-avatar ${className}`.trim()}
        src={reel.avatarSrc}
        alt={reel.displayName}
        width={80}
        height={80}
        loading="lazy"
        decoding="async"
      />
    )
  }

  return <span className={`creator-avatar is-fallback ${className}`.trim()}>{reel.avatar}</span>
}
