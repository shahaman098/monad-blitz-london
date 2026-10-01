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
- [x] Recreate the TikTok-style cookie consent screenshot as a standalone reference route
- [x] Build a submission deck with the live QR, deployed link, and current product screenshots

## Now

- [x] Make the desktop sidebar navigation and creator search functional
- [x] Connect the betting journey end to end: bet confirmation → portfolio position → transaction receipt → clear win/loss settlement, with position-aware demo charts
- [x] Keep the deployed Clutch logo splash visible long enough to perceive on returning wallets
- [x] Replace fake demo voting with three real reel-specific Monad markets and watch-only upcoming clips
- [x] Replace unrelated reel media and verify all eight video/question pairs one-to-one
- [x] Audit the 3-minute audience script against production and restore demo-critical QR, timed-market, and host controls
- [x] Turn non-live reel questions into clearly labeled, interactive demo polls
- [x] Add an on-video market question and a direct return from reel previews to the graph-backed live market
- [x] Add reliable transaction confirmations and a wallet transaction portfolio
- [x] Keep the betting question aligned with the visible reel and block cross-reel votes
- [x] Replace the synthetic odds graph with a dated, on-chain market tracker and deploy it
- [x] Fix the mobile funding CTA so success opens voting and failures remain visible
- [x] Fix the live `/m` betting regression and verify a real bet end to end
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
- [x] Fix black reel player and Cloud Run media packaging so local MP4 assets render on the public deployment
- [x] Delete stale old-UI submission screenshots and capture the current feed UI product image
- [x] Remove old frontend routes/components and point every public route to the TikTok-style feed
- [ ] Smoke test the QR join flow from an actual phone on the venue wifi

## Before The Pitch

- [x] Open 2–3 markets on the demo lineup early in the day so the room is trading before we present
- [x] **Record a 30s fallback screen capture the moment it first works live** — non-negotiable
- [ ] Rehearse `docs/pitch.md` against the deployed app with one phone and the projector screen
- [x] Verify the contract on MonadScan (`https://testnet.monadscan.com/verifyContract`)
- [ ] Rehearse the 30-second open: latency claim first, category name never

## Nice To Have

- [x] Multiple simultaneous markets on the big screen
- [ ] Leaderboard of room P&L — strong audience-vote hook
- [ ] Sound on trade
- [ ] Platform metric ingestion for YouTube, TikTok, or X

## Working Notes

- Judging is a **live audience vote of fellow builders**, not a panel. Optimise for the room having traded before the pitch starts.
- Use `docs/pitch.md` as the pitch source of truth: latency claim first, audience participation second, MonadScan proof third.
- Public app URL: `https://clutch-597773359205.europe-west2.run.app/frontend`
- Live Monad testnet contract: `0x194bd79723fC1C6BC6Cf635349f0190EbCFf59AD`
- Verified MonadScan page: `https://testnet.monadscan.com/address/0x194bd79723fC1C6BC6Cf635349f0190EbCFf59AD`
- Public desktop and 390×844 mobile betting smoke tests passed against Cloud Run revision `clutch-00025-zng`. The `/join` logo splash is guaranteed for at least 1.8 seconds and measured at about 2.3 seconds on production before redirecting a funded wallet to `/m`. All eight creator handles, exact TikTok post IDs, bundled videos, captions, and visible questions are matched one-to-one; unrelated stock and duplicate footage was replaced, and the live feed now plays the bundled files so venue Wi-Fi cannot break TikTok playback. Zach, Scout, and JerryRig each switch to their own simultaneous on-chain market (`#1`, `#2`, and `#3`); Scout creation confirmed in `0x5f3815a0a9017fae6e38f9a31701359b24dc559e8b2b2340c6fc6ff46338dcab`, JerryRig creation in `0xe5681837c3d8db31ec9db45559e0e4488ca8a6382128a01d2e3eb16f88b0d536`, and a real 0.005 MON Scout YES trade moved its price from 50.0% to 52.4% in `0x5206df6dfe4e2b8e6b8b1bf69792573dad1d93b5dc53cb9a9e7d35f8f3671a18`. Market `#1` was opened with an eight-hour deadline (`0x53fea30ac03dadb28d17fb6ed4d34106408b4afa38f6e56855f80deada6d91e2`); a real NO moved YES from 50.0% to 47.6% (`0x664cecf01b723f9d623fe8908b7afd684d062112392705537db390d176a3a296`), then a real YES moved it to 50.1% (`0x58595d4580f2961a4bb42005ab4e060876ebbccbf82c209f04ab9987c7aca1aa`). The remaining five reels are watch-only with “Market coming soon”; fake odds, fake voting, and cross-reel redirects are gone. A fresh production sponsor request funded a random burner to exactly 0.200 MON. The remaining unchecked item is a real physical-phone pass on venue wifi.
- Direct `esbuild` is pinned at 0.28 so Vite 8's peer requirement is satisfied in Cloud Build.
- Fallback recording: `artifacts/clutch-gcp-submission-demo.mp4` (30 seconds, 1440x900, H.264).
- Submission product image: `output/submission/clutch-product-current-feed.jpg` (current `/m` feed UI, 1280x720, under 4 MB).
- The `marketCount()` failure was not a bad contract deploy: direct `eth_call` succeeded between throttle windows, while both public endpoints returned HTTP 429 under polling load. Browsers now prefer the same-origin, allow-listed `/api/rpc` relay, which coalesces identical reads and briefly caches them across the room; 30 concurrent production market reads passed after deployment.
- Regenerate the ABI with `pnpm abi` after any contract change, or the frontend silently drifts.
- Midroll is archived, not deleted: `docs/archive/`, `contracts/src/MidrollEscrow.sol`.
