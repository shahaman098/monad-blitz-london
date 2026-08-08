import { getReelById, type ClutchReel } from './reels'

const META_MARKER = '\n---CLUTCH-META---\n'

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
  return {
    question: questionPart.trim(),
    reelId,
    reel: getReelById(reelId),
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
