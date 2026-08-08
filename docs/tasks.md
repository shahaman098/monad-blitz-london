# Tasks — Clutch

## Done

- [x] Pick the idea: Clutch, in-play prediction markets (see `docs/product.md`)
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

## Now — blocked on a funded testnet wallet

- [ ] Put a real `PRIVATE_KEY` and `SPONSOR_PRIVATE_KEY` in `.env` (from https://faucet.monad.xyz)
- [ ] Deploy to Monad testnet and set `VITE_CLUTCH_ADDRESS`
- [ ] Fund the sponsor wallet with enough MON for the room (~0.2 MON per phone)
- [ ] Deploy to Vercel with project root `app`, env vars set in the dashboard
- [ ] Smoke test the QR join flow from an actual phone on the venue wifi

## Before The Pitch

- [ ] Open 2–3 markets on the demo lineup early in the day so the room is trading before we present
- [ ] **Record a 30s fallback screen capture the moment it first works live** — non-negotiable
- [ ] Rehearse `docs/pitch.md` against the deployed app with one phone and the projector screen
- [ ] Verify the contract on MonadScan (`https://testnet.monadscan.com/verifyContract`)
- [ ] Rehearse the 30-second open: latency claim first, category name never

## Nice To Have

- [ ] Multiple simultaneous markets on the big screen
- [ ] Leaderboard of room P&L — strong audience-vote hook
- [ ] Sound on trade
- [ ] Real feed integration (PandaScore / API-Football) for the "this is a real product" slide

## Working Notes

- Judging is a **live audience vote of fellow builders**, not a panel. Optimise for the room having traded before the pitch starts.
- Use `docs/pitch.md` as the pitch source of truth: latency claim first, audience participation second, MonadScan proof third.
- Regenerate the ABI with `pnpm abi` after any contract change, or the frontend silently drifts.
- Midroll is archived, not deleted: `docs/archive/`, `contracts/src/MidrollEscrow.sol`.
