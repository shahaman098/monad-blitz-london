# Architecture — Clutch

## Status

Implemented and verified end to end against a local Anvil chain.

> The previous Midroll architecture is preserved at [`docs/archive/midroll-architecture.md`](./archive/midroll-architecture.md).

## Stack

- Contract: Solidity 0.8.24 + Foundry (`contracts/`)
- Frontend: React 19 + Vite + TypeScript + Tailwind v4 (`app/`)
- Chain client: `viem` (no wagmi — the burner path needs a raw local signer)
- Serverless: one Vercel Node function (`app/api/fund.ts`), also mounted into `vite dev`
- Hosting: Vercel with project root `app`; Monad testnet for the contract

## System Components

| Piece | Path | Role |
|---|---|---|
| `Clutch.sol` | `contracts/src/` | All markets, CPMM pricing, settlement |
| Sponsor drip | `app/api/fund.ts` | Funds a burner so the room can trade in seconds |
| Join | `app/src/pages/Join.tsx` | QR landing: create burner, fund, route to live market |
| Trade | `app/src/pages/Trade.tsx` | Phone UI: one-tap YES/NO, position, P&L, cash out, redeem |
| Screen | `app/src/pages/Screen.tsx` | Projector: odds, chart, trade feed, trades/sec, QR |
| Admin | `app/src/pages/Admin.tsx` | Owner console via injected wallet: open, resolve, cancel |

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

Admin uses the injected wallet instead, so the resolver key never touches the page.

## Data Flow

No database. The chain is the state.

- Market state: polled every 500–600ms (close to block cadence) via `readContract`
- Trade feed: explicit `getLogs` polling from a tracked cursor — deliberately **not** `eth_newFilter`, since filter support varies by RPC and a dead feed would kill the demo
- Price history: sampled client-side per poll into a rolling window for the chart
- Cost basis for P&L: `localStorage` per wallet per market

## Environment Variables

See [`.env.example`](../.env.example). Frontend vars need the `VITE_` prefix; Vite reads the repo-root `.env` via `envDir: '..'`.

Keep `SPONSOR_PRIVATE_KEY` distinct from `PRIVATE_KEY` so a drained sponsor cannot block market resolution.

## Commands

```bash
pnpm install
pnpm abi                 # regenerate the ABI after any contract change
pnpm contract:test
pnpm dev                 # vite dev, host:true so phones on the venue wifi can reach it
pnpm build
```

Deploy:

```bash
forge script contracts/script/DeployClutch.s.sol:DeployClutchScript --root contracts --rpc-url $MONAD_RPC_URL --broadcast
```

## Known Limitations

- Resolution is a single owner key. Deliberate, and stated in the pitch.
- Burner keys live in `localStorage`; testnet play money only.
- The sponsor wallet is a single point of failure for onboarding. Cap via `FUND_MAX_WALLETS`.
