import { useEffect, useRef, type MouseEvent, type VideoHTMLAttributes } from 'react'

type PlayableVideoProps = VideoHTMLAttributes<HTMLVideoElement> & {
  forcePlay?: boolean
  playWhenVisible?: boolean
}

export function PlayableVideo({
  autoPlay,
  forcePlay = false,
  muted = true,
  onClick,
  playWhenVisible = true,
  playsInline = true,
  preload = 'auto',
  src,
  ...props
}: PlayableVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return

    video.muted = muted !== false
    video.defaultMuted = muted !== false
    video.playsInline = playsInline !== false

    const play = () => {
      if (!video.paused) return
      void video.play().catch(() => {
        // Browser policies can still require a tap; the click handler retries.
      })
    }
    const pause = () => {
      if (!video.paused && !forcePlay) video.pause()
    }

    const handleReady = () => {
      if (forcePlay) play()
    }

    video.addEventListener('canplay', handleReady)
    video.addEventListener('loadeddata', handleReady)
    if (forcePlay) play()

    if (!playWhenVisible || !('IntersectionObserver' in window)) {
      if (!forcePlay && playWhenVisible) play()
      return () => {
        video.removeEventListener('canplay', handleReady)
        video.removeEventListener('loadeddata', handleReady)
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          play()
        } else {
          pause()
        }
      },
      { threshold: [0, 0.35, 0.7] }
    )
    observer.observe(video)

    return () => {
      observer.disconnect()
      video.removeEventListener('canplay', handleReady)
      video.removeEventListener('loadeddata', handleReady)
    }
  }, [forcePlay, muted, playWhenVisible, playsInline, src])

  const handleClick = (event: MouseEvent<HTMLVideoElement>) => {
    const video = event.currentTarget
    video.muted = true
    video.defaultMuted = true
    void video.play().catch(() => {})
    onClick?.(event)
  }

  return (
    <video
      {...props}
      ref={ref}
      src={src}
      autoPlay={autoPlay ?? (forcePlay || playWhenVisible)}
      muted={muted}
      playsInline={playsInline}
      preload={preload}
      onClick={handleClick}
    />
  )
}
