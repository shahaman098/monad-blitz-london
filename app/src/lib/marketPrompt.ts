import { getReelById, REELS, type ClutchReel } from './reels'

const META_MARKER = '\n---CLUTCH-META---\n'
const LEGACY_DEMO_QUESTION = /^will this demo win the room\??$/i

export type MarketPromptMeta = {
  reelId?: string
}

export type ParsedMarketPrompt = {
  question: string
  reelId: string | null
  reel: ClutchReel | null
}

export function buildMarketPrompt(question: string, meta: MarketPromptMeta = {}): string {
  const reelId = meta.reelId?.trim()
  if (!reelId) return question.trim()
  return `${question.trim()}${META_MARKER}${JSON.stringify({ v: 2, reelId })}`
}

export function parseMarketPrompt(raw: string): ParsedMarketPrompt {
  const [questionPart, metaPart] = raw.split(META_MARKER)
  const reelId = readReelId(metaPart)
  const reel = getReelById(reelId)
  const question = questionPart.trim()
  return {
    // Market #0 was deployed before the creator-market pivot and cannot be
    // edited on-chain. Keep that internal seed copy out of every UI surface.
    question: LEGACY_DEMO_QUESTION.test(question)
      ? (reel ?? REELS[0])?.marketQuestion ?? 'Live creator momentum market'
      : question,
    reelId,
    reel,
  }
}

function readReelId(metaPart?: string): string | null {
  if (!metaPart) return null
  try {
    const meta = JSON.parse(metaPart) as MarketPromptMeta
    return meta.reelId?.trim() || null
  } catch {
    return null
  }
}
