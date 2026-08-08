/* eslint-disable react/only-export-components -- icon barrel: many small components by design */
/**
 * Icon set for the Clutch social surfaces.
 *
 * Rendered through Astryx, Meta's open-source design system. Astryx's icon
 * contract accepts semantic registry names or direct SVG components; this file
 * keeps the app's existing icon names while routing every glyph through that
 * contract.
 */
import { Icon as AstryxIcon, type IconSize, type IconType } from '@astryxdesign/core/Icon'
import {
  BadgeCheck,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Compass,
  Ellipsis,
  Heart,
  House,
  Inbox,
  MessageCircle,
  Music,
  Plus,
  Search,
  Send,
  SquarePlus,
  Smartphone,
  Tv,
  User,
  UserRoundCheck,
  Volume2,
  VolumeX,
  type LucideProps,
} from 'lucide-react'
import type { CSSProperties } from 'react'

type IconProps = {
  size?: number
  className?: string
  /** Renders the solid variant by filling the glyph with currentColor. */
  filled?: boolean
}

const STROKE = 1.5

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

function make(Glyph: React.ComponentType<LucideProps>, defaultSize: number, fillable = false) {
  return function Wrapped({ size = defaultSize, className, filled }: IconProps) {
    return (
      <AstryxIcon
        icon={Glyph as IconType}
        size={toAstryxSize(size)}
        color="inherit"
        className={className}
        style={fixedSizeStyle(size)}
        width={size}
        height={size}
        strokeWidth={STROKE}
        fill={fillable && filled ? 'currentColor' : 'none'}
      />
    )
  }
}

export const IconSearch = make(Search, 20)
export const IconHome = make(House, 26, true)
export const IconCompass = make(Compass, 26)
export const IconFollowing = make(UserRoundCheck, 26)
export const IconLive = make(Tv, 26)
export const IconUpload = make(SquarePlus, 26)
export const IconProfile = make(User, 26, true)
export const IconMore = make(Ellipsis, 26)
export const IconHeart = make(Heart, 26, true)
export const IconComment = make(MessageCircle, 26, true)
export const IconBookmark = make(Bookmark, 26, true)
export const IconShare = make(Send, 26)
export const IconChevronUp = make(ChevronUp, 22)
export const IconChevronDown = make(ChevronDown, 22)
export const IconMusic = make(Music, 16, true)
export const IconPlus = make(Plus, 14)
export const IconDevice = make(Smartphone, 20)
export const IconKebab = make(Ellipsis, 18)
export const IconInbox = make(Inbox, 24)

export const IconMuted = make(VolumeX, 22)
export const IconSound = make(Volume2, 22)

/** Verified tick keeps its brand-blue fill, so it is not stroke-driven. */
export const IconVerified = ({ size = 15, className }: IconProps) => (
  <BadgeCheck
    size={size}
    className={className}
    fill="#20D5EC"
    color="#fff"
    strokeWidth={2}
    aria-hidden="true"
  />
)

/** Clutch mark — our own, deliberately not a third-party logo. */
export const ClutchMark = ({ size = 30, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#161823" />
    <path
      d="M9 20.5 14 11l4 6.2L21.6 12"
      stroke="#FE2C55"
      strokeWidth="2.8"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="22.4" cy="11.2" r="2.3" fill="#20D5EC" />
  </svg>
)
