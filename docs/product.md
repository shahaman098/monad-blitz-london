# Product Brief — Clutch

> The previous Midroll brief is preserved at [`docs/archive/midroll-product.md`](./archive/midroll-product.md).

## One-Line Idea

Clutch is the in-play prediction market that only works on a fast chain — sub-second markets that open, trade, and settle between the plays.

## Problem

In-play betting is the majority of live sports wagering and is structurally impossible onchain today. A live market must open, reprice, and resolve inside seconds. On a 12-second-block chain every in-play price is stale before it fills, which is why onchain prediction markets only do long-horizon questions and why all live flow sits with centralised books that can void a bet, restrict a winning account, and never show the book.

## Target Users

- Primary user: live sports and esports in-play traders
- Secondary user: streamers and event hosts who want a market on their own event
- Decision maker: the host who opens and resolves markets
- Beneficiary: traders who currently accept opaque odds from a centralised book

## Why Monad

Strip Monad out and the product ceases to exist:

- ~400ms blocks and ~800ms finality let a market reprice between plays
- Parallel execution lets a whole room trade the same market without serialising into a queue
- Cheap gas makes a sub-penny in-play trade rational

On a 12-second chain this is not a worse Clutch, it is not Clutch.

## Core User Journey

1. A market opens on whatever is happening right now.
2. The room scans a QR code, gets a funded burner wallet in seconds, and trades YES/NO from their phones.
3. The big screen shows the odds repricing live, every trade a real Monad transaction with a MonadScan link.
4. The host resolves. Winning shares redeem 1:1 while the demo is still running.

## MVP Scope

- Must have: CPMM binary markets in a single contract, collateralised in native MON
- Must have: QR → funded burner wallet → first trade with no MetaMask and no faucet
- Must have: phone trading UI with live prices, position, and P&L
- Must have: big-screen dashboard with live odds chart, trade feed, trades/sec, and QR
- Must have: owner console to open and resolve markets live

## Nice To Have

- Stretch: MonadScan contract verification
- Stretch: multiple simultaneous markets on the big screen
- Stretch: a real esports/football feed (PandaScore, API-Football) driving auto-resolution

## Non-Goals

- Not building: trustless oracle resolution. The host key resolves; this is stated plainly.
- Not building: order book, limit orders, or cross-market portfolio margin
- Not building: real-money rails. Testnet MON only.

## Success Criteria

- Demo success looks like: the room scans, trades, watches the odds convulse on the big screen, and sees payouts land before the pitch ends
- By the end of the hackathon: contract deployed and seeded on Monad testnet, app on Vercel, one recorded fallback capture

## Constraints

- Deadline: August 8, 2026, one-day Blitz
- Team size: 1 to 3 builders
- Required: Monad testnet, MonadScan, a funded sponsor wallet for the drip
- Deployment target: Vercel (project root `app`), Monad testnet for the contract

## Judging Context

Monad Blitz is decided by **live audience vote of fellow builders**, not a judging panel. Every product decision here optimises for the room having traded on the contract before the pitch begins.
