# Architecture

## Status

Chosen for the hackathon MVP.

## Default Direction For Monad

If there is no strong reason otherwise, choose the simplest stack that supports a polished demo and Monad integration:

- Frontend: Next.js
- Styling: Tailwind CSS
- Wallet/onchain client: `wagmi` + `viem`
- Explorer/API integration: MonadScan links and Etherscan-compatible API patterns where useful
- Smart contracts when needed: Solidity + Foundry
- Backend: Next.js route handlers or a minimal Node service
- Database: Supabase or Postgres only if persistence is truly required
- Hosting: Vercel

This is a default, not a mandate. If the product idea is mostly offchain, reduce the onchain footprint.

## Proposed Stack

- Frontend: React + Vite + TypeScript
- Backend: none for MVP, browser-first demo with optional relayer stub later
- Database: none for MVP, local session state only
- Auth: MetaMask for the sponsor/creator wallet path only
- Hosting: Vercel or local network demo server
- AI providers: none required for the core demo

## Why This Stack

This stack keeps the critical path short. Vite gives a fast frontend loop, React is enough for the demo orchestration UI, and Foundry is the quickest path to a clean Monad-compatible contract. Avoiding a backend and database removes operational risk for the live demo.

## System Components

- Client: one React app with two primary views, a room-facing control/dashboard screen and a viewer session screen
- API: none in the first cut; watcher heartbeats are simulated in local state and later can map to onchain settlement calls
- Data layer: contract state on Monad testnet plus browser-local mock session state for the room demo
- Third-party integrations: MetaMask, Monad testnet RPC, MonadScan explorer links

## Data Model

- Campaign: sponsor-funded budget, creator address, sponsor segment start/end, price per watched second
- Session: viewer participation record, watched seconds, active status, last heartbeat
- Settlement: cumulative watched seconds and claimable creator payout

## Critical Flows

1. Main user action: audience joins the session, watches the sponsor segment, and drives real-time payout counters
2. Onchain flow: sponsor funds campaign, watched seconds are settled against the funded budget, creator withdraws
3. Persistence: contract stores campaign and settlement state, frontend stores temporary demo session state locally

## Environment Variables

- `VITE_WALLETCONNECT_PROJECT_ID=` optional if WalletConnect is added
- `VITE_MONAD_RPC_URL=` optional override for Monad testnet RPC
- `PRIVATE_KEY=` deployer key for Foundry scripts
- `MONAD_RPC_URL=` Monad testnet RPC URL for deployment
- `MONADSCAN_API_KEY=` optional, only if explorer API reads are added

## Commands

Document the standard commands after scaffolding:

```bash
pnpm install

pnpm dev

pnpm build
pnpm contract:test

forge build --root contracts
forge script contracts/script/DeployMidrollEscrow.s.sol:DeployMidrollEscrowScript \
  --rpc-url $MONAD_RPC_URL \
  --broadcast
```
