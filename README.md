# Clutch

Clutch is a social network for creator-momentum markets built for Monad testnet. The app now presents one TikTok-style feed everywhere: users browse creator clips, react to creators, receive testnet MON from the in-feed funding button, trade YES/NO, and watch the odds move in real time.

## Why Monad

Creator traction markets are a latency product.

- Slow chains make live odds stale while views, likes, and comments are still moving.
- Monad's fast blocks make room-scale repricing believable.
- Cheap testnet transactions let a live audience trade without the demo collapsing under friction.

## Product Surface

- `/`, `/frontend`, `/m`, `/screen`, and unknown frontend paths render the TikTok-style Clutch feed.
- `/join` creates and funds an audience burner before redirecting to `/m`; `/admin` is the owner-only timed-market and resolution console.
- The feed includes creator navigation, playable TikTok-sourced clips via local MP4 fallback, social actions, in-feed testnet MON funding, one-tap YES/NO trading, live price, receipt-backed transactions, a position/P&L chart, cash out, and clear win/loss/refund settlement.

## Stack

- Frontend: React 19 + Vite + TypeScript + Tailwind v4
- Contract: Solidity 0.8.24 + Foundry
- Chain client: `viem`
- App runtime: `app/server.ts` serves the Vite build, sponsor drip, and shared Monad RPC relay
- Deployment target: Google Cloud Run in `europe-west2`, Monad testnet for the contract

## Local Development

```bash
pnpm install
pnpm contract:test
pnpm dev
```

Useful commands:

```bash
pnpm env:check
pnpm abi
pnpm build
pnpm contract:build
pnpm deploy:testnet
```

## Environment

Copy from `.env.example`.

Required for a real submission:

- `PRIVATE_KEY` for contract deployment
- `SPONSOR_PRIVATE_KEY` for the burner wallet drip
- `MONAD_RPC_URL` pointing at Monad testnet
- `VITE_MONAD_RPC_URLS` and `MONAD_RPC_URLS` if you want frontend/server failover across public RPCs
- `VITE_CLUTCH_ADDRESS` after deployment

## Submission Status

Live now:

- App: `https://clutch-597773359205.europe-west2.run.app`
- Contract: `0x194bd79723fC1C6BC6Cf635349f0190EbCFf59AD`
- MonadScan: `https://testnet.monadscan.com/address/0x194bd79723fC1C6BC6Cf635349f0190EbCFf59AD`

Shipped:

- Contract and tests are in place, including the solvency fuzz suite
- All public frontend routes point to the current TikTok-style trading feed
- Local Anvil cycle has been verified: join -> fund -> buy -> resolve -> redeem
- Contract is deployed to Monad testnet and verified on MonadScan
- App is deployed to Google Cloud Run with the sponsor key mounted from Secret Manager
- A 30-second fallback demo is saved at `artifacts/clutch-gcp-submission-demo.mp4`
- The projector QR, funded burner handoff, timed market clock, bidirectional repricing, dated graph, and MonadScan receipt links have been verified together on market `#1`

Still required for Monad Blitz submission:

- Smoke test the phone flow on an actual phone over venue wifi

## Docs

- Product: [`docs/product.md`](./docs/product.md)
- Architecture: [`docs/architecture.md`](./docs/architecture.md)
- Tasks: [`docs/tasks.md`](./docs/tasks.md)
- Pitch runbook: [`docs/pitch.md`](./docs/pitch.md)
- Hackathon notes: [`docs/hackathon.md`](./docs/hackathon.md)
