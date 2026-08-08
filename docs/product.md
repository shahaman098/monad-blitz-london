# Product Brief — Clutch

> The previous Midroll brief is preserved at [`docs/archive/midroll-product.md`](./archive/midroll-product.md).

## One-Line Idea

Clutch is a social network for creator momentum markets that only works on a fast chain: scroll reels inside Clutch, follow creators, react to posts, and trade YES/NO on whether a video will hit a view, like, or comment target before a deadline.

## Problem

Creator growth is volatile and public, but the market around it is opaque. Fans, creators, and sponsors can see views, likes, and comments move in real time, yet there is no lightweight way to price that momentum as it happens. On a slow chain, a market on whether a clip crosses a threshold is stale before the next wave of engagement arrives.

## Target Users

- Primary user: fans and creator communities who want to trade live content momentum
- Secondary user: creators, streamers, and launch teams who want an interactive market around a post
- Decision maker: the host who opens a metric market and resolves it from public platform numbers
- Beneficiary: traders who want transparent odds instead of opaque virality claims

## Why Monad

Strip Monad out and the product ceases to exist:

- ~400ms blocks and ~800ms finality let a market reprice while views, likes, and comments are moving
- Parallel execution lets a whole room trade the same viral moment without serialising into a queue
- Cheap gas makes small testnet trades rational for a fast audience demo

On a 12-second chain this is not a worse Clutch, it is not Clutch.

## Core User Journey

1. The host picks one of the built-in TikTok-sourced clips and opens a market such as "Will this clip hit 10,000 views in 30 minutes?"
2. The room scans a QR code, gets a funded burner wallet in seconds, browses in scroll mode or swipe mode, watches the official platform player inside Clutch, and trades YES/NO from their phones.
3. The big screen shows the same in-app TikTok-sourced clip beside live odds, every trade a real Monad transaction with a MonadScan link.
4. The host checks the public platform metric and resolves. Winning shares redeem 1:1 while the demo is still running.

## MVP Scope

- Must have: CPMM binary markets in a single contract, collateralised in native MON
- Must have: QR → funded burner wallet → first trade with no MetaMask and no faucet
- Must have: phone social feed with vertical scroll mode, Tinder-style swipe mode, creator profiles, follows, likes, saves, comments, live prices, position, and P&L
- Must have: big-screen dashboard with the active reel, live odds chart, trade feed, trades/sec, and QR
- Must have: owner console to open time-boxed creator metric markets from the built-in reel catalog and resolve them live

## Nice To Have

- Stretch: MonadScan contract verification
- Stretch: multiple simultaneous markets on the big screen
- Stretch: platform metric ingestion for YouTube, TikTok, or X

## Non-Goals

- Not building: trustless oracle resolution. The host key resolves; this is stated plainly.
- Not building: order book, limit orders, or cross-market portfolio margin
- Not building: real-money rails. Testnet MON only.

## Success Criteria

- Demo success looks like: the room scans, trades on whether a clip hits a visible metric target, watches the odds move on the big screen, and sees payouts land before the pitch ends
- By the end of the hackathon: contract deployed and seeded on Monad testnet, app on Vercel, one recorded fallback capture

## Constraints

- Deadline: August 8, 2026, one-day Blitz
- Team size: 1 to 3 builders
- Required: Monad testnet, MonadScan, a funded sponsor wallet for the drip
- Deployment target: Vercel (project root `app`), Monad testnet for the contract

## Judging Context

Monad Blitz is decided by **live audience vote of fellow builders**, not a judging panel. Every product decision here optimises for the room having traded on the contract before the pitch begins.
