/* eslint-disable react/only-export-components -- icon barrel: many small components by design */
/**
 * Icon set for the Clutch social surfaces.
 *
 * These are app-specific SVG glyphs rendered through Astryx, Meta's open-source
 * design system. Keeping the public exports stable lets the feed components stay
 * focused on product behavior while the visual icon language can change here.
 */
import { Icon as AstryxIcon, type IconSize, type IconType } from '@astryxdesign/core/Icon'
import type { CSSProperties, SVGProps } from 'react'

type IconProps = {
  size?: number
  className?: string
  /** Renders the solid variant by filling the glyph with currentColor. */
  filled?: boolean
}

type GlyphProps = SVGProps<SVGSVGElement> & {
  'data-filled'?: boolean
}

const STROKE = 1.65

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: STROKE,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  vectorEffect: 'non-scaling-stroke',
} satisfies SVGProps<SVGSVGElement>

const toAstryxSize = (size: number): IconSize => {
  if (size <= 12) return 'xsm'
  if (size <= 16) return 'sm'
  if (size <= 20) return 'md'
  return 'lg'
}

const fixedSizeStyle = (size: number): CSSProperties => ({
  width: size,
  height: size,
  fontSize: size,
})

function make(Glyph: IconType, defaultSize: number) {
  return function Wrapped({ size = defaultSize, className, filled }: IconProps) {
    return (
      <AstryxIcon
        icon={Glyph}
        size={toAstryxSize(size)}
        color="inherit"
        className={className}
        style={fixedSizeStyle(size)}
        width={size}
        height={size}
        data-filled={filled || undefined}
      />
    )
  }
}

const SearchGlyph = (props: GlyphProps) => (
  <svg {...base} {...props}>
    <path d="M10.7 18.1a7.4 7.4 0 1 1 0-14.8 7.4 7.4 0 0 1 0 14.8Z" />
    <path d="m16.1 16.1 4.6 4.6" />
  </svg>
)

const HomeGlyph = ({ 'data-filled': filled, ...props }: GlyphProps) => (
  <svg {...base} fill={filled ? 'currentColor' : 'none'} {...props}>
    <path d="M3.6 11.3 12 4l8.4 7.3" />
    <path d="M6.5 10.2v8.2c0 .9.7 1.6 1.6 1.6h7.8c.9 0 1.6-.7 1.6-1.6v-8.2" />
    <path d="M10 20v-5.2h4V20" fill={filled ? '#fff' : 'none'} />
  </svg>
)

const CompassGlyph = (props: GlyphProps) => (
  <svg {...base} {...props}>
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
    <path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5 5.5-2.1Z" />
  </svg>
)

const FollowingGlyph = (props: GlyphProps) => (
  <svg {...base} {...props}>
    <path d="M8.6 11.1a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4Z" />
    <path d="M2.8 20.2c.8-3.2 2.7-5 5.8-5 1.6 0 2.9.5 3.9 1.4" />
    <path d="m14.2 16.9 2.1 2.1 4.7-5.5" />
  </svg>
)

const LiveGlyph = (props: GlyphProps) => (
  <svg {...base} {...props}>
    <rect x="3.2" y="5.4" width="17.6" height="12.2" rx="2.2" />
    <path d="M8 20.6h8" />
    <path d="M12 17.6v3" />
    <path d="m10.3 9.2 4.4 2.3-4.4 2.3V9.2Z" fill="currentColor" stroke="none" />
  </svg>
)

const UploadGlyph = (props: GlyphProps) => (
  <svg {...base} {...props}>
    <path d="M12 15V4.6" />
    <path d="m7.8 8.7 4.2-4.2 4.2 4.2" />
    <path d="M4.8 14.5v3.7c0 1 .8 1.8 1.8 1.8h10.8c1 0 1.8-.8 1.8-1.8v-3.7" />
  </svg>
)

const ProfileGlyph = ({ 'data-filled': filled, ...props }: GlyphProps) => (
  <svg {...base} fill={filled ? 'currentColor' : 'none'} {...props}>
    <path d="M12 12.1a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Z" />
    <path d="M4.5 20.4c1-3.4 3.4-5.2 7.5-5.2s6.5 1.8 7.5 5.2" />
  </svg>
)

const MoreGlyph = (props: GlyphProps) => (
  <svg {...base} fill="currentColor" stroke="none" {...props}>
    <circle cx="5" cy="12" r="1.55" />
    <circle cx="12" cy="12" r="1.55" />
    <circle cx="19" cy="12" r="1.55" />
  </svg>
)

const HeartGlyph = ({ 'data-filled': filled, ...props }: GlyphProps) => (
  <svg {...base} fill={filled ? 'currentColor' : 'none'} {...props}>
    <path d="M12 20.4s-7.8-4.7-8.7-10.1C2.8 7 4.9 4.8 7.6 4.8c1.7 0 3.2 1 4.4 2.5 1.2-1.5 2.7-2.5 4.4-2.5 2.7 0 4.8 2.2 4.3 5.5-.9 5.4-8.7 10.1-8.7 10.1Z" />
  </svg>
)

const CommentGlyph = ({ 'data-filled': filled, ...props }: GlyphProps) => (
  <svg {...base} fill={filled ? 'currentColor' : 'none'} {...props}>
    <path d="M4.2 5.8c1.7-1.9 4.4-3 7.8-3 5.4 0 9.2 3.1 9.2 7.7s-3.8 7.7-9.2 7.7c-1.1 0-2.1-.1-3.1-.4L4 21.2l1-5.3c-1.4-1.4-2.2-3.2-2.2-5.4 0-1.8.5-3.3 1.4-4.7Z" />
    <path d="M8.2 9.6h7.6" stroke={filled ? '#fff' : 'currentColor'} />
    <path d="M8.2 13h5.1" stroke={filled ? '#fff' : 'currentColor'} />
  </svg>
)

const BookmarkGlyph = ({ 'data-filled': filled, ...props }: GlyphProps) => (
  <svg {...base} fill={filled ? 'currentColor' : 'none'} {...props}>
    <path d="M6.7 4.1h10.6c.6 0 1.1.5 1.1 1.1v15.1L12 16.8l-6.4 3.5V5.2c0-.6.5-1.1 1.1-1.1Z" />
  </svg>
)

const ShareGlyph = (props: GlyphProps) => (
  <svg {...base} {...props}>
    <path d="M21 4.2 10.5 14.8" />
    <path d="m21 4.2-5.7 16-4.8-5.4-6.7-2.6L21 4.2Z" />
  </svg>
)

const ChevronUpGlyph = (props: GlyphProps) => (
  <svg {...base} {...props}>
    <path d="m6.4 14.2 5.6-5.6 5.6 5.6" />
  </svg>
)

const ChevronDownGlyph = (props: GlyphProps) => (
  <svg {...base} {...props}>
    <path d="m6.4 9.8 5.6 5.6 5.6-5.6" />
  </svg>
)

const MusicGlyph = ({ 'data-filled': filled, ...props }: GlyphProps) => (
  <svg {...base} fill={filled ? 'currentColor' : 'none'} {...props}>
    <path d="M9.2 18.7a2.5 2.5 0 1 1-1.1-2.1V5.4l9-1.7v11.6a2.5 2.5 0 1 1-1.1-2.1V7.4l-6.8 1.3v10Z" />
  </svg>
)

const PlusGlyph = (props: GlyphProps) => (
  <svg {...base} {...props}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
)

const DeviceGlyph = (props: GlyphProps) => (
  <svg {...base} {...props}>
    <rect x="7.4" y="2.8" width="9.2" height="18.4" rx="2" />
    <path d="M10.5 18.2h3" />
  </svg>
)

const InboxGlyph = (props: GlyphProps) => (
  <svg {...base} {...props}>
    <path d="M4.3 5.3h15.4l-1.5 13.4H5.8L4.3 5.3Z" />
    <path d="M5 13h4.2l1.4 2.2h2.8l1.4-2.2H19" />
  </svg>
)

const MutedGlyph = (props: GlyphProps) => (
  <svg {...base} {...props}>
    <path d="M4 14.4V9.6h3.5l4.2-3.8v12.4l-4.2-3.8H4Z" />
    <path d="m16.1 9.5 4 4" />
    <path d="m20.1 9.5-4 4" />
  </svg>
)

const SoundGlyph = (props: GlyphProps) => (
  <svg {...base} {...props}>
    <path d="M4 14.4V9.6h3.5l4.2-3.8v12.4l-4.2-3.8H4Z" />
    <path d="M15.5 8.4a5.2 5.2 0 0 1 0 7.2" />
    <path d="M18.2 5.8a8.8 8.8 0 0 1 0 12.4" />
  </svg>
)

export const IconSearch = make(SearchGlyph, 20)
export const IconHome = make(HomeGlyph, 26)
export const IconCompass = make(CompassGlyph, 26)
export const IconFollowing = make(FollowingGlyph, 26)
export const IconLive = make(LiveGlyph, 26)
export const IconUpload = make(UploadGlyph, 26)
export const IconProfile = make(ProfileGlyph, 26)
export const IconMore = make(MoreGlyph, 26)
export const IconHeart = make(HeartGlyph, 26)
export const IconComment = make(CommentGlyph, 26)
export const IconBookmark = make(BookmarkGlyph, 26)
export const IconShare = make(ShareGlyph, 26)
export const IconChevronUp = make(ChevronUpGlyph, 22)
export const IconChevronDown = make(ChevronDownGlyph, 22)
export const IconMusic = make(MusicGlyph, 16)
export const IconPlus = make(PlusGlyph, 14)
export const IconDevice = make(DeviceGlyph, 20)
export const IconKebab = make(MoreGlyph, 18)
export const IconInbox = make(InboxGlyph, 24)

export const IconMuted = make(MutedGlyph, 22)
export const IconSound = make(SoundGlyph, 22)

/** Verified tick keeps its brand-blue fill, so it is not stroke-driven. */
export const IconVerified = ({ size = 15, className }: IconProps) => (
  <AstryxIcon
    icon={({ ...props }: SVGProps<SVGSVGElement>) => (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
        <path
          d="M12 2.6 14.3 5l3.3-.2.9 3.1 2.7 1.9-1.5 2.9.6 3.2-3.1 1.2-1.6 2.9-3.1-.9-3.1.9-1.6-2.9-3.1-1.2.6-3.2-1.5-2.9 2.7-1.9.9-3.1 3.3.2L12 2.6Z"
          fill="#20D5EC"
        />
        <path d="m8.3 12.1 2.3 2.3 5.2-5.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
    size={toAstryxSize(size)}
    color="inherit"
    className={className}
    style={fixedSizeStyle(size)}
    width={size}
    height={size}
  />
)

/** Clutch mark — our own, deliberately not a third-party logo. */
export const ClutchMark = ({ size = 30, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="#0f1720" />
    <path
      d="M8.2 20.2 13.2 10l4.6 7.1 3.1-4.8 2.9 4.1"
      stroke="#20D5EC"
      strokeWidth="2.45"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M8.2 20.2h15.6" stroke="#FE2C55" strokeWidth="2.45" strokeLinecap="round" />
  </svg>
)
