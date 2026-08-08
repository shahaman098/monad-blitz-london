# Architecture — Clutch

## Status

Live on Monad testnet and Google Cloud Run. End to end flow is verified locally, and the public deploy has passed desktop and mobile browser smoke tests against production.

> The previous Midroll architecture is preserved at [`docs/archive/midroll-architecture.md`](./archive/midroll-architecture.md).

## Stack

- Contract: Solidity 0.8.24 + Foundry (`contracts/`)
- Frontend: React 19 + Vite + TypeScript + Tailwind v4 (`app/`)
- Chain client: `viem` (no wagmi — the burner path needs a raw local signer)
- Server: `app/server.ts` serves the built SPA and mounts `app/api/fund.ts`; Vite mounts the same handler in development
- Hosting: Google Cloud Run service `clutch` in `europe-west2`; Monad testnet for the contract

## System Components

| Piece | Path | Role |
|---|---|---|
| `Clutch.sol` | `contracts/src/` | All markets, CPMM pricing, settlement |
| Sponsor drip | `app/api/fund.ts` | Funds a burner so the room can trade in seconds |
| Join | `app/src/pages/Join.tsx` | QR landing: create burner, fund, route to live market |
| Reels catalog | `app/src/lib/reels.ts` | Built-in public TikTok posts with exact post URLs, matching creator profiles, and locally cached verified profile photos |
| Social embeds | `app/src/components/SocialEmbed.tsx` | Official TikTok player iframe for the catalog's verified post IDs |
| Trade | `app/src/pages/Trade.tsx` | Phone UI: vertical scroll mode, Tinder-style swipe mode, creator stories, local follows/likes/saves/comments, one-tap YES/NO, position, P&L, cash out, redeem |
| Screen | `app/src/pages/Screen.tsx` | Projector: active reel, odds, chart, trade feed, trades/sec, QR |
| Admin | `app/src/pages/Admin.tsx` | Owner console via injected wallet: select a built-in reel, open time-boxed metric markets, resolve, cancel |

## Market Mechanism

Binary YES/NO markets over **complete sets**, priced by a constant product AMM.

- Seeding with `s` MON mints `s` YES and `s` NO into the pool, so markets open at 50/50.
- Buying with `c` MON mints `c` complete sets into the pool, then removes shares of the chosen side to restore `resYes * resNo = k`.
- Selling adds shares back and burns the complete sets that restore `k` (smaller root of the resulting quadratic).
- YES price = `resNo / (resYes + resNo)`.
- Resolution pays the winning side 1:1. The pool's own winning shares belong to the seeder via `redeemPool`.

**Solvency invariant:** total complete sets outstanding always equals collateral held, so redemption is exactly funded. This is covered by a 256-run fuzz test (`testFuzz_AlwaysSolvent`) asserting payouts never exceed backing and the market drains to rounding dust.

Rounding always favours the pool (`_ceilDiv` on buys, floor on sells), so no trade can mint value.

## Why A Burner Wallet, Not MetaMask

The demo dies if the room has to install an extension and clear a faucet. On join the client generates a key into `localStorage` and `POST /api/fund` drips testnet MON from a sponsor wallet. Eligibility is gated on the recipient's **on-chain balance**, which survives cold starts and multiple serverless instances where an in-memory set would not. Sends are serialised through a promise queue with pending-nonce reads and three retries, because a room joining at once will otherwise race the sponsor's nonce.

Admin uses the injected wallet instead, so the resolver key never touches the page. For the creator-metric MVP, the host resolves from public platform numbers; there is no automated platform oracle yet.

## Data Flow

No database. The chain is the state.

- Market state: polled via `marketCount()` plus `Multicall3 getMarket(...)` reads, which keeps screen refreshes under public RPC limits even when several markets exist
- Reel metadata: the selected reel id is encoded into the market question string with a small JSON marker, then parsed client-side so projector/admin/phone can show the clean question and same TikTok-sourced clip without adding a database or changing the deployed contract. The catalog stores TikTok-verified post IDs, exact public post URLs, and matching creator profile links; every surface renders the official TikTok player.
- Social state: follows, likes, saves, and comment taps are local demo state in `localStorage`; market trades and settlement remain on Monad testnet
- Trade feed: explicit `getLogs` polling from a tracked cursor — deliberately **not** `eth_newFilter`, since filter support varies by RPC and a dead feed would kill the demo
- Price history: sampled client-side per poll into a rolling window for the chart
- Cost basis for P&L: `localStorage` per wallet per market

## Environment Variables

See [`.env.example`](../.env.example). Frontend vars need the `VITE_` prefix; Vite reads the repo-root `.env` via `envDir: '..'`. The root scripts `pnpm env:check` and `pnpm deploy:testnet` now load the same repo-root `.env` directly, so deploys do not depend on manually sourcing shell variables first.

`VITE_MONAD_RPC_URLS` and `MONAD_RPC_URLS` accept comma-separated fallback endpoints. Use them for the public app and sponsor flow so the demo does not depend on a single rate-limited RPC.

Keep `SPONSOR_PRIVATE_KEY` distinct from `PRIVATE_KEY` so a drained sponsor cannot block market resolution.

Production stores `SPONSOR_PRIVATE_KEY` in Google Secret Manager as `clutch-sponsor-private-key`. Cloud Run is capped at one instance so sponsor sends remain nonce-serialised within one process.

Vite 8's optional peer requires `esbuild ^0.27 || ^0.28`. Keep the direct dependency inside that range so Cloud Build uses a compatible server bundler.

## Commands

```bash
pnpm install
pnpm env:check
pnpm abi                 # regenerate the ABI after any contract change
pnpm contract:test
pnpm dev                 # vite dev, host:true so phones on the venue wifi can reach it
pnpm build
```

Deploy:

```bash
pnpm deploy:testnet
gcloud run deploy clutch --source . \
  --project project-ced3b331-e814-4d72-8bc \
  --region europe-west2 \
  --allow-unauthenticated \
  --set-secrets=SPONSOR_PRIVATE_KEY=clutch-sponsor-private-key:latest \
  --max-instances=1
```

## Monad Gas Gotcha (demo-critical)

Monad reserves — and **charges** — `gasLimit * maxFeePerGas`, not gas used.

With no explicit `gas` on a write, viem lets the node fall back to the block gas
limit (150,000,000). The pre-flight balance check then demands roughly
`150M * 122 gwei ≈ 18 MON`, so every burner funded with 0.2 MON failed with
`Signer had insufficient balance` — surfaced as a `buy` revert. Anvil does not
reserve this way, which is why the local end-to-end run passed and testnet did not.

Fix: every burner write passes an explicit limit (`BUY_GAS = 200_000n` in
`Trade.tsx`). Because the full limit is charged, that number directly sets how
many bets a funded burner gets: a measured bet cost `200,000 * 102 gwei =
0.0204 MON`, so 0.2 MON is roughly 7 bets. Lower the limit to stretch it, but
keep headroom over the ~125k `buy` actually uses.

Verified live on `0x194bd79723fC1C6BC6Cf635349f0190EbCFf59AD`: a phone bet moved
`resYes` 0.4902 → 0.4854 and volume 0.010 → 0.015 MON.

## Known Limitations

- Resolution is a single owner key. Deliberate, and stated in the pitch.
- Burner keys live in `localStorage`; testnet play money only.
- The sponsor wallet is a single point of failure for onboarding. Cap via `FUND_MAX_WALLETS`.
- Social metrics are manually verified by the host in the MVP.
