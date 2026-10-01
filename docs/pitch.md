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

Every creator wants to know if a post has real momentum, and everyone can see the public numbers move. Clutch turns that into a Monad-native market: open the TikTok-style feed, watch a creator clip inside Clutch, get testnet MON from the feed, and vote YES or NO on whether the clip clears a visible momentum target. The same interface shows the live price chart, every fill is a real Monad transaction, and winners redeem after resolution.

## Two-Minute Demo Script

1. Open with the latency claim: "Markets on virality only work if the chain is fast enough."
2. Show `/frontend` on the projector with the TikTok-style Clutch feed already open.
3. Ask the room to open the same link.
4. Narrate the burner path: no MetaMask, no faucet, no account setup; tap Get testnet MON in the feed.
5. Ask the room to watch the reel inside Clutch and tap YES or NO on the metric target.
6. Point at the chart, trades/sec meter, and live trade feed as the room moves the market.
7. Open one MonadScan transaction from the feed.
8. Show the public metric, then resolve from the owner key if needed.
9. Show a phone redeeming winnings.
10. Close with: "On a slow chain, the market is stale. On Monad, momentum can be priced live."

## Verified Three-Minute Audience Script

Keep the projector on `/screen` and the active reel for the entire pitch. Other reels are explicitly labeled demo polls with no MON; the claims below refer to the active on-chain market.

"Quick show of hands: how many of you have watched a clip and thought, 'this is about to blow up'?

That instinct is the product.

We built **Clutch**, a social app where you don't just watch creator momentum, you trade it live.

Here's the bet: will this clip hit a target before the clock runs out? 10,000 views. 5,000 likes. 500 comments. You tap **YES** or **NO**, and every trade in this live market is a real on-chain transaction.

Why does this matter? Because creator momentum is public, emotional, and insanely fast. But on most chains, by the time your transaction lands, the moment is already gone. That makes live prediction feel fake.

On **Monad**, it actually works. Fast blocks, fast finality, cheap transactions. That means a whole room can react to the same viral moment at the same time, and the odds can move while the clip is still spreading.

[Point to the QR.] You scan this QR code. You get a funded burner wallet in seconds. You start trading immediately: no MetaMask setup, no faucet, no friction.

On your phone, it feels like a social feed. On the big screen, everyone sees the live clip, the odds moving, and the transaction proof.

[Ask for NO first.] This live market is not a fake demo with simulated numbers. When someone taps YES, the market reprices. When someone taps NO, the market moves back. The room can literally see sentiment become price.

What I like about this is that it creates a new behavior: not just watching content, not just liking content, but **pricing belief** in real time.

For creators, it turns passive attention into active participation. For fans, it makes intuition tradable. For live events, streams, launches, and internet moments, it turns the audience into the market.

And without Monad, this product does not exist in this form. If the chain is slow, the market is stale. If the gas is expensive, nobody taps. If the room can't all participate at once, the magic dies.

So our thesis is simple: **Virality is a market. Clutch lets people trade it live. And Monad is the first place where that experience actually feels native.**

If you think the future of consumer crypto looks less like spreadsheets and more like live culture, social participation, and instant feedback, vote for **Clutch**.

Thank you."

Do not claim automated TikTok resolution. For this MVP, the host checks the public metric and resolves YES or NO from `/admin`.

## Demo Setup Checklist

- Deploy `Clutch.sol` to Monad testnet.
- Set `VITE_CLUTCH_ADDRESS` in Cloud Run and local `.env`.
- Fund `SPONSOR_PRIVATE_KEY` with enough MON for the room.
- Open `https://clutch-597773359205.europe-west2.run.app/frontend` before walking up.
- Open `/admin` shortly before the pitch, connect the contract-owner wallet, select the exact clip, and open a 20-30 minute market. Do not reuse an expired or `open until host resolves` market.
- Put `/screen` on the projector; confirm the QR says `Scan to trade`, the deadline is counting down, and the question matches the playing reel.
- Keep one joined phone on the same feed before walking up.
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
