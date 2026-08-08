# Clutch Pitch And Demo Runbook

## Winning Thesis

Clutch should be pitched as a product that only becomes possible on Monad.

The core claim is simple: content momentum is a latency product. If a chain cannot reprice while views, likes, and comments are moving, a market on virality collapses into stale odds. Monad's fast blocks, low fees, and parallel execution make the live room demo credible.

## Why This Fits The Hackathon Pattern

- Specific user: creator communities, streamers, and fans who want to trade whether a post hits a visible traction target.
- Painful problem: social platforms expose public metrics, but there is no transparent market for pricing whether momentum continues.
- Data grounding: every trade, price move, and payout is contract state on Monad testnet.
- Active workflow: scan, receive a funded burner wallet, trade, watch the price move, resolve, redeem.
- Trust layer: MonadScan links prove transactions instead of asking the audience to trust screenshots.
- Memorable demo: the room itself moves the market before the pitch ends.

## One-Line Pitch

Clutch is a real-time market for creator momentum: scroll TikTok-sourced clips inside Clutch and bet on whether a post hits a views, likes, or comments target before the clock runs out.

## 30-Second Opening

Every creator wants to know if a post has real momentum, and everyone can see the public numbers move. Clutch turns that into a Monad-native market: the host picks a reel inside Clutch, opens "Will this Reel hit 10,000 views in 30 minutes?", the room scans a QR code, gets testnet MON automatically, watches the reel in Clutch, and votes YES or NO from their phones. The big screen shows the same video, reprices live, every fill is a real Monad transaction, and winners redeem after the host checks the public metric.

## Two-Minute Demo Script

1. Open with the latency claim: "Markets on virality only work if the chain is fast enough."
2. Show `/screen` on the projector with one live reel market already open.
3. Ask the room to scan the QR code.
4. Narrate the burner path: no MetaMask, no faucet, no account setup.
5. Ask the room to watch the reel inside Clutch and tap YES or NO on the metric target.
6. Point at the chart, trades/sec meter, and live trade feed as the room moves the market.
7. Open one MonadScan transaction from the feed.
8. Show the public metric, then use `/admin` to resolve the market.
9. Show a phone redeeming winnings.
10. Close with: "On a slow chain, the market is stale. On Monad, momentum can be priced live."

## Demo Setup Checklist

- Deploy `Clutch.sol` to Monad testnet.
- Set `VITE_CLUTCH_ADDRESS` in Vercel and local `.env`.
- Fund `SPONSOR_PRIVATE_KEY` with enough MON for the room.
- Open 2 or 3 markets before the pitch so the screen is alive immediately.
- Keep `/screen`, `/admin`, and one joined phone open before walking up.
- Record a 30-second fallback capture as soon as a live cycle works.

## Market Prompts

Use prompts tied to visible public metrics:

- Will this TikTok hit 10,000 views in the next 30 minutes?
- Will this TikTok push YES above 60c before close?
- Will this post get 100 comments before the pitch ends?
- Will this clip break 1,000 views before we resolve live?

## Risks To State Plainly

- Resolution is host-controlled for the hackathon MVP.
- Burner wallets are localStorage testnet wallets, not production custody.
- The sponsor drip is operational demo infrastructure, not a permissionless faucet.
- Production creator markets need trusted platform metric ingestion or oracle verification.

## Submission Summary

Clutch demonstrates Monad's speed as a user-facing primitive. The demo is not a generic prediction market; it is a market for live creator momentum where the audience becomes the order flow, the screen shows live repricing, and MonadScan proves the transactions.
