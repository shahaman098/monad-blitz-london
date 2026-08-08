# Tasks — Clutch

## Done

- [x] Pick the idea: Clutch, creator momentum markets (see `docs/product.md`)
- [x] `Clutch.sol` — CPMM binary markets, buy/sell/resolve/redeem, native MON collateral
- [x] 19 Foundry tests green, including a 256-run fuzz on the solvency invariant
- [x] `DeployClutch.s.sol` with optional seeded first market
- [x] Vite + React + Tailwind + viem app wired to the contract
- [x] Sponsor drip (`app/api/fund.ts`), nonce-serialised, balance-gated
- [x] Join flow: QR → burner wallet → funded → live market
- [x] Phone trade UI: one-tap YES/NO, position, P&L, cash out, redeem
- [x] Big-screen dashboard: odds, chart, trade feed, trades/sec, QR, MonadScan links
- [x] Admin console: open / resolve / cancel / redeem pool via injected wallet
- [x] Full cycle verified on local Anvil: join → fund → buy → resolve → redeem
- [x] Pitch and demo runbook added at `docs/pitch.md`
- [x] Submission hygiene pass: Clutch README, root gitignore, and initial local git history
- [x] UI polish pass across join, trade, screen, and admin for the live pitch
- [x] Replace demo-specific seeded market copy with neutral default wording

## Now

- [x] Repair the current app deployment and verify the public build end to end
- [x] Remove the stale market question from the mobile bet dock and fix its bottom layout
- [x] Finalize, commit, deploy, and record the submission-ready TikTok build
- [x] Add the verified TikTok profile photo for every creator in the built-in feed
- [x] Replace mismatched local reel files with verified official TikTok embeds for every catalog account
- [x] Replace external handoff cards with verified TikTok official players
- [x] Put a real `PRIVATE_KEY` and `SPONSOR_PRIVATE_KEY` in `.env`
- [x] Deploy to Monad testnet and set `VITE_CLUTCH_ADDRESS`
- [x] Fund the sponsor wallet with enough MON for the room starter flow
- [x] Deploy to Google Cloud Run in `europe-west2` with the sponsor key in Secret Manager
- [x] Investigate public Monad RPC failures on `marketCount()` / market polling and harden the app against the public RPC rate limit
- [x] Pivot the MVP framing to creator metric markets for Reels and YouTube views, likes, and comments
- [x] Show the live Reel / YouTube source on the projector while the room votes YES/NO
- [x] Replace pasted media URLs with a built-in TikTok-sourced feed rendered by the official player
- [x] Add social-network surfaces around the reel feed: creator stories, profiles, follows, likes, saves, comments, and feed tabs
- [x] Final readiness pass: social-betting copy, build, lint, env check, and contract tests
- [x] Harden reel playback: every mounted reel force-plays muted inline with tap-to-play retry
- [x] Make the phone feed resilient to Monad RPC rate limits so reel playback never gets replaced by raw errors
- [x] Add phone feed modes: vertical scroll and Tinder-style swipe deck over playable reel cards
- [x] Reduce betting friction with a sticky instant-bet dock and swipe-mode YES/NO actions
- [x] Validate TikTok source links in the built-in feed (no scrape, no paste-URL)
- [x] Make the live feed TikTok-only so videos actually play in-app
- [x] Remove local MP4 playback and render each verified TikTok account/post pair with the official player
- [x] Make `/m` use Claude's DesktopFeed UI only; remove the old mobile social-feed shell
- [x] Correct the built-in feed to TikTok-only source/profile pairs with exact post links
- [x] Fix demo-blocking Monad gas bug: writes now pass an explicit gas limit (see `docs/architecture.md`)
- [x] Make tx errors readable (viem's multi-line revert text was being truncated to a dangling header)
- [x] Verify a real bet end to end against the deployed testnet contract from the app
- [x] Replace the social-feed icon set with Meta Astryx-rendered app SVG glyphs
- [x] Restore desktop feed wheel and swipe gestures for changing reels
- [ ] Smoke test the QR join flow from an actual phone on the venue wifi

## Before The Pitch

- [ ] Open 2–3 markets on the demo lineup early in the day so the room is trading before we present
- [x] **Record a 30s fallback screen capture the moment it first works live** — non-negotiable
- [ ] Rehearse `docs/pitch.md` against the deployed app with one phone and the projector screen
- [x] Verify the contract on MonadScan (`https://testnet.monadscan.com/verifyContract`)
- [ ] Rehearse the 30-second open: latency claim first, category name never

## Nice To Have

- [ ] Multiple simultaneous markets on the big screen
- [ ] Leaderboard of room P&L — strong audience-vote hook
- [ ] Sound on trade
- [ ] Platform metric ingestion for YouTube, TikTok, or X

## Working Notes

- Judging is a **live audience vote of fellow builders**, not a panel. Optimise for the room having traded before the pitch starts.
- Use `docs/pitch.md` as the pitch source of truth: latency claim first, audience participation second, MonadScan proof third.
- Public app URL: `https://clutch-597773359205.europe-west2.run.app/frontend`
- Live Monad testnet contract: `0x194bd79723fC1C6BC6Cf635349f0190EbCFf59AD`
- Verified MonadScan page: `https://testnet.monadscan.com/address/0x194bd79723fC1C6BC6Cf635349f0190EbCFf59AD`
- Public desktop and mobile browser smoke tests passed against the production Cloud Run service `clutch`; the remaining unchecked item is a real physical-phone pass on venue wifi.
- Direct `esbuild` is pinned at 0.28 so Vite 8's peer requirement is satisfied in Cloud Build.
- Fallback recording: `artifacts/clutch-gcp-submission-demo.mp4` (30 seconds, 1440x900, H.264).
- The `marketCount()` failure was not a bad contract deploy: the direct `eth_call` succeeded, but the old market loader did `1 + marketCount` reads per tick, which could exceed public RPC limits once several markets or devices were active. The frontend/server now use RPC failover, and market snapshots now collapse into a single Multicall3 read.
- Regenerate the ABI with `pnpm abi` after any contract change, or the frontend silently drifts.
- Midroll is archived, not deleted: `docs/archive/`, `contracts/src/MidrollEscrow.sol`.
