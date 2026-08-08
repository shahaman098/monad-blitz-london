export function TikTokEmbed({
  videoId,
  caption,
  sourceUrl,
  compact = false,
  autoplay = true,
  muted = true,
}: {
  videoId: string
  caption: string
  sourceUrl: string
  compact?: boolean
  autoplay?: boolean
  muted?: boolean
}) {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    loop: '1',
    muted: muted ? '1' : '0',
    rel: '0',
  })
  const embedUrl = `https://www.tiktok.com/player/v1/${videoId}?${params}`

  return (
    <div className={`social-embed-shell tiktok-embed-shell ${compact ? 'is-compact' : ''}`}>
      <iframe
        title={caption}
        src={embedUrl}
        loading="lazy"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <a className="social-embed-fallback is-quiet" href={sourceUrl} target="_blank" rel="noreferrer">
        Open on TikTok
      </a>
    </div>
  )
}
