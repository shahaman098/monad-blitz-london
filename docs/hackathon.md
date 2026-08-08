# Monad Blitz London

## Facts

- Event: Monad Blitz London Hackathon
- Date: August 8, 2026
- Location: London, United Kingdom
- Format: one-day IRL hackathon
- Ecosystem: Monad

## What Matters For This Repo

- Build for a fast demo, not for long-term production complexity.
- Treat this as a vibe-coding sprint: fast iteration, clear MVP, minimal ceremony.
- Keep the build path compatible with Monad if the app needs wallet, contract, or testnet support.
- MonadScan is available on testnet and should be treated as part of the default demo surface for links, verification, and transaction proof.
- The winning Clutch angle is not "prediction markets"; it is "creator momentum becomes tradeable when Monad makes latency low enough for the room to reprice views, likes, and comments live."

## Submission Notes

From the public submission repo instructions:

1. Fork `monad-developers/monad-blitz-london`.
2. Rename the fork to your project name and add a one-line description.
3. Build your project in that fork or move this repo into that submission flow.
4. Continue submission steps in the Blitz portal.

## Recommended Build Strategy

Choose one of these and stay disciplined:

- Pure consumer app on Monad data or wallet flows
- Thin smart contract plus strong frontend demo
- Offchain AI workflow with a small onchain proof, payment, or credential step

For Clutch, stay in the second lane: one contract, one QR-to-trade path, one projector screen, and one admin resolve flow.

## Pitch Assets

- Use [`docs/pitch.md`](./pitch.md) for the live demo script, setup checklist, and submission summary.
- Lead with the latency claim before explaining AMMs or prediction markets.
- Make the audience part of the proof: QR scans and real trades are stronger than a solo click-through.

## Avoid

- Large protocol designs
- Heavy custom infra
- Multi-contract systems unless the product absolutely depends on them
- Features that are hard to explain in a two-minute demo
- Generic "AI" or "prediction market" framing that does not make Monad necessary

## Useful Links

- Monad events: https://www.monad.xyz/events
- Developer portal: https://developers.monad.xyz/events
- Monad docs: https://docs.monad.xyz
- Testnet hub: https://testnet.monad.xyz
- Faucet: https://faucet.monad.xyz
- MonadScan explorer: https://testnet.monadscan.com/
- MonadScan API: https://monadscan.com/api
- Etherscan API docs: https://docs.etherscan.io/
- Blitz portal: https://blitz.devnads.com/events/monad-blitz-london
- Submission repo: https://github.com/monad-developers/monad-blitz-london
