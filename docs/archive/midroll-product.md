# Product Brief

## One-Line Idea

Midroll lets brands pay creators only for sponsor-segment seconds that viewers actually watch.

## Problem

Creator sponsorships are usually paid as flat fees agreed in advance, even when viewers skip the sponsored segment. Brands want proof of real watched time, creators want transparent payout logic, and neither side has a simple real-time settlement mechanism.

## Target Users

- Primary user: creators running sponsored video content
- Secondary user: brands or agencies funding creator campaigns

## Core User Journey

1. The audience scans a QR code and opens a shared video session on their phones.
2. They watch a short video with a clearly marked sponsor segment while the app emits watch heartbeats.
3. The big-screen dashboard shows brand escrow draining and creator earnings rising only during watched sponsor seconds.

## MVP Scope

- Must have: a video player with a marked sponsor segment and visible payment-active window
- Must have: a live demo dashboard showing escrow spent, creator earned, viewer count, and per-session activity
- Must have: a Monad-compatible smart contract that models campaign funding, watched-second settlement, and creator withdrawal

## Nice To Have

- Stretch: a QR join flow for room-scale participation with audience swarm visualization
- Stretch: MonadScan deep links and a real testnet deployment

## Non-Goals

- Not building: YouTube integration or creator OAuth during the hackathon build
- Not building: production-grade anti-fraud or independent watch attestation

## Success Criteria

- Demo success looks like: the room scans a QR code, watches the sponsor segment, and sees the on-screen balances move only while the segment is actually being watched
- By the end of the hackathon we can: deploy the contract on Monad testnet, fund a sample campaign, and run a compelling live or fallback-recorded demo

## Constraints

- Deadline: August 8, 2026 hackathon demo
- Team size: hackathon-sized, optimize for 1 to 3 builders
- Required APIs or partners: Monad testnet, MetaMask, and optionally MonadScan for explorer proof
- Deployment target: Vercel for the frontend, Monad testnet for the contract
