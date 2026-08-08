# Clutch

Clutch is a social network for creator-momentum markets built for Monad testnet. A host opens a YES/NO market on one of the built-in TikTok-sourced clips, the projector shows that content, the room scans a QR code, receives testnet MON automatically, browses in scroll mode or swipe mode, reacts to creators, votes from their phones, and watches the odds move in real time.

## Why Monad

Creator traction markets are a latency product.

- Slow chains make live odds stale while views, likes, and comments are still moving.
- Monad's fast blocks make room-scale repricing believable.
- Cheap testnet transactions let a live audience trade without the demo collapsing under friction.

## Product Surface

- `/` join flow: create a burner wallet, request sponsor-funded testnet MON, route into the live market
- `/m` phone trading UI: in-app social feed with scroll and swipe modes, creator stories, follows, likes, saves, comments, one-tap YES/NO, live price, position, P&L, cash out, redeem
- `/screen` projector dashboard: active reel, price chart, trade feed, trades/sec, QR code, MonadScan links
- `/admin` host console: choose a built-in reel, create time-boxed creator metric markets, resolve, cancel, and redeem markets with an injected wallet

## Stack

- Frontend: React 19 + Vite + TypeScript + Tailwind v4
- Contract: Solidity 0.8.24 + Foundry
- Chain client: `viem`
- Serverless onboarding: `app/api/fund.ts`
- Deployment target: Vercel for the app, Monad testnet for the contract

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

- App: `https://app-ten-ashen-86.vercel.app`
- Contract: `0x194bd79723fC1C6BC6Cf635349f0190EbCFf59AD`
- MonadScan: `https://testnet.monadscan.com/address/0x194bd79723fC1C6BC6Cf635349f0190EbCFf59AD`

Shipped:

- Contract and tests are in place, including the solvency fuzz suite
- Join, trade, screen, and admin flows are implemented
- Local Anvil cycle has been verified: join -> fund -> buy -> resolve -> redeem
- Contract is deployed to Monad testnet and verified on MonadScan
- App is deployed to Vercel with the production sponsor flow working

Still required for Monad Blitz submission:

- Smoke test the phone flow on an actual phone over venue wifi
- Record the fallback demo clip

## Docs

- Product: [`docs/product.md`](./docs/product.md)
- Architecture: [`docs/architecture.md`](./docs/architecture.md)
- Tasks: [`docs/tasks.md`](./docs/tasks.md)
- Pitch runbook: [`docs/pitch.md`](./docs/pitch.md)
- Hackathon notes: [`docs/hackathon.md`](./docs/hackathon.md)
