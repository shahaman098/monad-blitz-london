# Clutch

Clutch is an in-play prediction market built for Monad testnet. The pitch is simple: this product only works on a fast chain. A host opens a live YES/NO market, the room scans a QR code, receives testnet MON automatically, trades from their phones, and watches the odds move on the projector in real time.

## Why Monad

In-play markets are a latency product.

- Slow chains make live odds stale before they fill.
- Monad's fast blocks make room-scale repricing believable.
- Cheap testnet transactions let a live audience trade without the demo collapsing under friction.

## Product Surface

- `/` join flow: create a burner wallet, request sponsor-funded testnet MON, route into the live market
- `/m` phone trading UI: one-tap YES/NO, live price, position, P&L, cash out, redeem
- `/screen` projector dashboard: price chart, trade feed, trades/sec, QR code, MonadScan links
- `/admin` host console: create, resolve, cancel, and redeem markets with an injected wallet

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
- `VITE_CLUTCH_ADDRESS` after deployment

## Submission Status

Working locally:

- Contract and tests are in place, including the solvency fuzz suite
- Join, trade, screen, and admin flows are implemented
- Local Anvil cycle has been verified: join -> fund -> buy -> resolve -> redeem

Still required for Monad Blitz submission:

- Deploy the contract to Monad testnet
- Fund the sponsor wallet
- Deploy the app to Vercel so the QR code resolves to a public URL
- Smoke test the phone flow on venue wifi
- Record the fallback demo clip

## Docs

- Product: [`docs/product.md`](./docs/product.md)
- Architecture: [`docs/architecture.md`](./docs/architecture.md)
- Tasks: [`docs/tasks.md`](./docs/tasks.md)
- Pitch runbook: [`docs/pitch.md`](./docs/pitch.md)
- Hackathon notes: [`docs/hackathon.md`](./docs/hackathon.md)
