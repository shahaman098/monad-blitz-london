export type ClutchReel = {
  id: string
  creator: string
  displayName: string
  avatar: string
  avatarSrc?: string
  bio: string
  category: string
  followers: string
  caption: string
  marketQuestion: string
  minutes: string
  platform: 'TikTok'
  tiktokVideoId: string
  profileUrl: string
  sourceLabel: string
  sourceUrl: string
  licenseUrl: string
  videoSrc: string
  commentsPreview: Array<{
    author: string
    text: string
  }>
}

const TIKTOK_TERMS = 'https://www.tiktok.com/legal/page/global/terms-of-service/en'

const tiktokUrl = (creator: string, path = '') => {
  const handle = creator.startsWith('@') ? creator.slice(1) : creator
  return `https://www.tiktok.com/@${handle}${path}`
}

const tiktokSource = (creator: string, videoId: string, videoSrc: string) => ({
  creator,
  platform: 'TikTok' as const,
  tiktokVideoId: videoId,
  profileUrl: tiktokUrl(creator),
  sourceLabel: 'TikTok',
  sourceUrl: tiktokUrl(creator, `/video/${videoId}`),
  licenseUrl: TIKTOK_TERMS,
  videoSrc,
})

/**
 * Built-in TikTok feed. Every post/account pair links to the verified TikTok
 * source, while the in-app product UI uses local playable clips so deployment
 * never depends on third-party iframe playback.
 */
const CATALOG: ClutchReel[] = [
  {
    id: 'tt-zachking-glass',
    ...tiktokSource('@zachking', '6749520869598481669', '/media/reel-1.mp4'),
    displayName: 'Zach King',
    avatar: 'ZK',
    avatarSrc: '/media/tiktok-avatars/zachking.jpeg',
    bio: 'Creator momentum market seed.',
    category: 'Magic',
    followers: 'TikTok',
    caption: 'Do you see the glass as half full or half empty?? #perspective #magic',
    marketQuestion: 'Will Zach King\'s glass illusion gain 10,000 views before the clock runs out?',
    minutes: '25',
    commentsPreview: [
      { author: '@clutch.room', text: 'Known creator, strong replay value.' },
      { author: '@clutch.alpha', text: 'Magic clips are made for quick trading.' },
    ],
  },
  {
    id: 'tt-scout-suki',
    ...tiktokSource('@scout2015', '6718335390845095173', '/media/reel-2.mp4'),
    displayName: 'Scout, Suki & Stella',
    avatar: 'SS',
    avatarSrc: '/media/tiktok-avatars/scout2015.jpeg',
    bio: 'Creator momentum market seed.',
    category: 'Pets',
    followers: 'TikTok',
    caption: "Scramble up ur name & I'll try to guess it #foryoupage #petsoftiktok #aesthetic",
    marketQuestion: 'Will Scout\'s name-scramble challenge gain 5,000 likes before the clock runs out?',
    minutes: '30',
    commentsPreview: [
      { author: '@clutch.beta', text: 'Easy for the room to judge live.' },
      { author: '@clutch.host', text: 'Strong second market after the opener.' },
    ],
  },
  {
    id: 'tt-jerryrig',
    ...tiktokSource('@zacksjerryrig', '6828268207359413509', '/media/reel-3.mp4'),
    displayName: 'Jerry Rig Everything',
    avatar: 'JR',
    avatarSrc: '/media/tiktok-avatars/zacksjerryrig.jpeg',
    bio: 'Creator momentum market seed.',
    category: 'Tech',
    followers: 'TikTok',
    caption: 'Buy a case for your iPad or else... #ipad #teardown #jerryrigeverything',
    marketQuestion: 'Will this iPad teardown clip gain 500 comments before the clock runs out?',
    minutes: '20',
    commentsPreview: [
      { author: '@clutch.room', text: 'Tech audience trades conviction fast.' },
      { author: '@clutch.alpha', text: 'Good projector opener.' },
    ],
  },
  {
    id: 'tt-nickthetutor',
    ...tiktokSource('@nickthetutor', '6904353203454856454', '/media/reel-4.mp4'),
    displayName: 'Curvebreakers Test Prep',
    avatar: 'NT',
    avatarSrc: '/media/tiktok-avatars/nickthetutor.jpeg',
    bio: 'Creator momentum market seed.',
    category: 'Education',
    followers: 'TikTok',
    caption: '#ThisOrThat #collegeadmissions Edition! #collegehumor #nickthetutor',
    marketQuestion: 'Will this college-admissions clip gain 10,000 views before the clock runs out?',
    minutes: '40',
    commentsPreview: [
      { author: '@clutch.beta', text: 'Question format maps well to YES/NO.' },
      { author: '@clutch.host', text: 'Good backup market.' },
    ],
  },
  {
    id: 'tt-loveisland',
    ...tiktokSource('@loveisland', '6976695645679668485', '/media/reel-5.mp4'),
    displayName: 'Love Island',
    avatar: 'LI',
    avatarSrc: '/media/tiktok-avatars/loveisland.jpeg',
    bio: 'Creator momentum market seed.',
    category: 'Entertainment',
    followers: 'TikTok',
    caption: "Savage AND outrageous? Sharon's going to fit in perfectly #LoveIsland",
    marketQuestion: 'Will Sharon\'s Love Island entrance gain 500 comments before the clock runs out?',
    minutes: '30',
    commentsPreview: [
      { author: '@clutch.room', text: 'High energy for the live vote.' },
      { author: '@clutch.alpha', text: 'Odds should move when the room piles in.' },
    ],
  },
  {
    id: 'tt-cucumber',
    ...tiktokSource('@logagm', '7394126805550058758', '/media/reel-6.mp4'),
    displayName: 'Logan',
    avatar: 'LG',
    avatarSrc: '/media/tiktok-avatars/logagm.jpeg',
    bio: 'Creator momentum market seed.',
    category: 'Food',
    followers: 'TikTok',
    caption: 'The og best way to eat a whole cucumber',
    marketQuestion: 'Will Logan\'s whole-cucumber recipe gain 5,000 likes before the clock runs out?',
    minutes: '25',
    commentsPreview: [
      { author: '@clutch.host', text: 'Food clips are easy for the room to read.' },
      { author: '@clutch.beta', text: 'Clean yes/no momentum line.' },
    ],
  },
  {
    id: 'tt-blaise',
    ...tiktokSource('@blaiseeeeeeeeeeeee', '6893593227308322054', '/media/reel-7.mp4'),
    displayName: 'Blaseeeeeeeeeeeeee',
    avatar: 'BL',
    avatarSrc: '/media/tiktok-avatars/blaiseeeeeeeeeeeee.jpeg',
    bio: 'Creator momentum market seed.',
    category: 'Creator',
    followers: 'TikTok',
    caption: 'Can i have both? #foryou #couples #blaiseeeeeeeeeeee',
    marketQuestion: 'Will this couples clip gain 10,000 views before the clock runs out?',
    minutes: '45',
    commentsPreview: [
      { author: '@clutch.alpha', text: 'Stable enough for a backup pitch moment.' },
      { author: '@clutch.room', text: 'Video plays inside Clutch, not as a handoff.' },
    ],
  },
  {
    id: 'tt-littleqb',
    ...tiktokSource('@4brett', '6933443770679610629', '/media/reel-8.mp4'),
    displayName: 'Brett',
    avatar: 'BT',
    avatarSrc: '/media/tiktok-avatars/4brett.jpeg',
    bio: 'Creator momentum market seed.',
    category: 'Nature',
    followers: 'TikTok',
    caption: 'The loudest bird ever! #qbfax #TodayILearned #bird #nature #littleqb',
    marketQuestion: 'Will the loudest-bird clip gain 500 comments before the clock runs out?',
    minutes: '35',
    commentsPreview: [
      { author: '@clutch.room', text: 'Keeps the playable feed deep.' },
      { author: '@clutch.alpha', text: 'Good secondary market.' },
    ],
  },
]

export const REELS: ClutchReel[] = CATALOG

export function getReelById(id?: string | null): ClutchReel | null {
  if (!id) return null
  return REELS.find((reel) => reel.id === id) ?? null
}
