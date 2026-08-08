# Clutch Pitch And Demo Runbook

## Winning Thesis

Clutch should be pitched as a product that only becomes possible on Monad.

The core claim is simple: in-play markets are a latency product. If the chain cannot reprice and settle between plays, the product collapses back into stale odds or a centralised book. Monad's fast blocks, low fees, and parallel execution make the live room demo credible.

## Why This Fits The Hackathon Pattern

- Specific user: live sports and esports viewers who want to trade the moment, plus hosts who want an interactive market for their event.
- Painful problem: centralised in-play books are opaque, can void trades, and do not expose the book.
- Data grounding: every trade, price move, and payout is contract state on Monad testnet.
- Active workflow: scan, receive a funded burner wallet, trade, watch the price move, resolve, redeem.
- Trust layer: MonadScan links prove transactions instead of asking the audience to trust screenshots.
- Memorable demo: the room itself moves the market before the pitch ends.

## One-Line Pitch

Clutch is the in-play prediction market that only works on a fast chain: sub-second markets that open, trade, and settle between the plays.

## 30-Second Opening

In-play betting is most of live sports wagering, but it does not work onchain today because a 12-second block makes every price stale before it fills. Clutch turns that into a Monad-native product: the host opens a market, the room scans a QR code, gets testnet MON automatically, and trades YES or NO from their phones. The big screen reprices live, every fill is a real Monad transaction, and winners redeem before the demo is over.

## Two-Minute Demo Script

1. Open with the latency claim: "This category only exists if the chain is fast enough."
2. Show `/screen` on the projector with one live market already open.
3. Ask the room to scan the QR code.
4. Narrate the burner path: no MetaMask, no faucet, no account setup.
5. Ask the room to tap YES or NO as a live prompt changes.
6. Point at the chart, trades/sec meter, and live trade feed as the room moves the market.
7. Open one MonadScan transaction from the feed.
8. Use `/admin` to resolve the market.
9. Show a phone redeeming winnings.
10. Close with: "On a slow chain, this is stale. On Monad, this is a product."

## Demo Setup Checklist

- Deploy `Clutch.sol` to Monad testnet.
- Set `VITE_CLUTCH_ADDRESS` in Vercel and local `.env`.
- Fund `SPONSOR_PRIVATE_KEY` with enough MON for the room.
- Open 2 or 3 markets before the pitch so the screen is alive immediately.
- Keep `/screen`, `/admin`, and one joined phone open before walking up.
- Record a 30-second fallback capture as soon as a live cycle works.

## Market Prompts

Use prompts that the room can judge instantly:

- Will the next speaker say "Monad" in the first 20 seconds?
- Will this demo get more YES taps than NO taps?
- Will the next transaction land before I finish this sentence?
- Will the audience push YES above 70 cents?

## Risks To State Plainly

- Resolution is host-controlled for the hackathon MVP.
- Burner wallets are localStorage testnet wallets, not production custody.
- The sponsor drip is operational demo infrastructure, not a permissionless faucet.
- Real sports production needs a trusted data or oracle path.

## Submission Summary

Clutch demonstrates Monad's speed as a user-facing primitive. The demo is not a generic prediction market; it is an in-play market where the audience becomes the order flow, the screen shows live repricing, and MonadScan proves the transactions.
