# Architecture — Clutch

## Status

Live on Monad testnet and Google Cloud Run. End to end flow is verified locally, and the public deploy has passed desktop and mobile browser smoke tests against production.

> The previous Midroll architecture is preserved at [`docs/archive/midroll-architecture.md`](./archive/midroll-architecture.md).

## Stack

- Contract: Solidity 0.8.24 + Foundry (`contracts/`)
- Frontend: React 19 + Vite + TypeScript + Tailwind v4 (`app/`)
- Chain client: `viem` (no wagmi — the burner path needs a raw local signer)
- Server: `app/server.ts` serves the built SPA and mounts `app/api/fund.ts` plus the allow-listed `app/api/rpc.ts` relay; Vite mounts both handlers in development
- Hosting: Google Cloud Run service `clutch` in `europe-west2`; Monad testnet for the contract

## System Components

| Piece | Path | Role |
|---|---|---|
| `Clutch.sol` | `contracts/src/` | All markets, CPMM pricing, settlement |
| Sponsor drip | `app/api/fund.ts` | Funds a burner so the room can trade in seconds |
| Market history | `app/api/history.ts` | Rebuilds dated trade history from MonadScan's indexed contract transactions and cached receipts |
| RPC relay | `app/api/rpc.ts` | Coalesces and briefly caches public-chain reads so a room of phones does not exhaust public RPC quotas |
| Frontend routes | `app/src/main.tsx` | Routes `/`, `/frontend`, `/m`, and `/screen` to the shared feed; `/join` auto-provisions an audience burner; `/admin` exposes owner-only timed-market controls |
| Reels catalog | `app/src/lib/reels.ts` | Built-in public TikTok posts with exact post URLs, matching creator profiles, and locally cached verified profile photos |
| Social media | `app/src/components/SocialEmbed.tsx` | Local playable MP4 feed clips with verified TikTok source links, avoiding iframe/cookie/player failures |
| Trade | `app/src/pages/Trade.tsx` | Current TikTok-style product UI: creator feed, social actions, in-feed funding, one-tap YES/NO, receipt-backed transaction history, position value/P&L chart, cash out, and explicit win/loss/refund settlement |

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

For the creator-metric MVP, resolution remains owner-controlled at the contract layer; there is no automated platform oracle yet.

## Data Flow

No database. The chain is the state.

- Market state: polled via `marketCount()` plus `Multicall3 getMarket(...)` reads, which keeps screen refreshes under public RPC limits even when several markets exist
- Reel metadata: the selected reel id is encoded into the market question string with a small JSON marker, then parsed client-side so the feed can show the clean question and same TikTok-sourced clip without adding a database or changing the deployed contract. The catalog stores TikTok-verified post IDs, exact public post URLs, matching creator profile links, and local MP4 playback fallbacks.
- Social state: follows, likes, saves, and comment taps are local demo state in `localStorage`; market trades and settlement remain on Monad testnet
- Upcoming reels: clips without an open on-chain market are clearly labeled watch-only with “Market coming soon”; the UI shows no fake odds, fake voting, or redirect to another reel
- Trade feed: MonadScan supplies the indexed historical transaction set, the server decodes and caches each receipt, and a short explicit `getLogs` window follows new blocks. This avoids the public RPC's narrow log-range cap without relying on `eth_newFilter`.
- Price history: rebuilt from the real post-trade reserves emitted in every `Trade` event, with each point dated from its Monad block. The current contract state is used only as a labelled live snapshot when it is newer than indexed history.
- Cost basis for P&L: `localStorage` per wallet per market
- Wallet portfolio: every broadcast hash is persisted immediately with pending/confirmed/failed status, then reconciled against Monad receipts; confirmed historical trades are also recovered from contract logs
- Position journey: the bet panel advances through placed → portfolio → result, derives the wallet's value curve from real market odds and its YES/NO exposure, and values resolved shares at the contract's actual 1:1 payout rules. Cancelled markets are shown as refunds rather than NO outcomes, and losing positions never expose a redeem action.

## Environment Variables

See [`.env.example`](../.env.example). Frontend vars need the `VITE_` prefix; Vite reads the repo-root `.env` via `envDir: '..'`. The root scripts `pnpm env:check` and `pnpm deploy:testnet` now load the same repo-root `.env` directly, so deploys do not depend on manually sourcing shell variables first.

Browser chain traffic uses the same-origin `/api/rpc` relay first. The relay only permits the read, fee, receipt, and raw-transaction methods the burner flow needs; it coalesces identical in-flight reads and uses sub-two-second caches for fast-changing data. This prevents each audience phone from multiplying the same market polls against the public 15 req/sec quota.

The projector feed generates its QR from the current deployment origin plus `/join`. A scan creates a local testnet burner, asks the sponsor drip for MON, waits for the balance to land, and redirects to `/m`. The host console is deliberately separate at `/admin`: it verifies the connected address against `owner()`, embeds the selected catalog clip, creates an expiring market with the exact visible question, and exposes resolve/cancel/pool-redeem actions.

`VITE_MONAD_RPC_URLS` and `MONAD_RPC_URLS` accept comma-separated fallback endpoints. The former supplies direct browser emergency fallbacks; the latter supplies the server relay and sponsor flow.

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

Fix: every burner write passes an explicit limit (`TX_GAS = 300_000n` in
`Trade.tsx`). Because Monad reserves against the configured fee ceiling and
charges the full gas limit, the UI's Max action also keeps 0.06 MON aside for
gas. Without that reserve, a 0.20 MON wallet could submit a 0.18 MON vote that
mined as failed after gas consumed the wallet's remaining capacity.

Receipt propagation is handled separately from execution status. Clutch stores
the transaction hash as soon as the node accepts it, shows a confirming state,
and keeps polling in the wallet portfolio. A temporary "receipt not found"
response is no longer shown as a transaction failure; only a mined receipt with
reverted status is marked failed.

Verified live on `0x194bd79723fC1C6BC6Cf635349f0190EbCFf59AD`: a phone bet moved
`resYes` 0.4902 → 0.4854 and volume 0.010 → 0.015 MON.

## Known Limitations

- Resolution is a single owner key. Deliberate, and stated in the pitch.
- Burner keys live in `localStorage`; testnet play money only.
- The sponsor wallet is a single point of failure for onboarding. Cap via `FUND_MAX_WALLETS`.
- Social metrics are manually verified by the host in the MVP.
