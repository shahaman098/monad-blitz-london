# Monad Reference

This file captures concrete Monad testnet details already identified for the hackathon workspace.

## Explorer

- Explorer: `https://testnet.monadscan.com/`
- Transactions: `https://testnet.monadscan.com/txs`
- Blocks: `https://testnet.monadscan.com/blocks`
- Accounts: `https://testnet.monadscan.com/accounts`
- Verified contracts: `https://testnet.monadscan.com/contractsVerified`

## APIs And Tooling

- MonadScan multichain API: `https://monadscan.com/api`
- API documentation: `https://docs.etherscan.io/`
- Contract verification: `https://testnet.monadscan.com/verifyContract`
- Broadcast transaction: `https://testnet.monadscan.com/pushTx`

## Important Implication

MonadScan exposes an Etherscan-style surface. For hackathon speed, agents should prefer libraries and tooling that already work with EVM chains and Etherscan-compatible explorer patterns.

## Sample Testnet Transaction

Use this as a known-good example when testing explorer links or parsing transaction data:

- Tx hash: `0xaf5e06375697aae325b58fb7c485abc06d053ac81e4cf3a944e48467c25f544e`
- Status: success
- Block: `51941121`
- Value: `50 MON`
- Fee: `0.00215883 MON`
- Gas price: `102 Gwei`
- From: `0xF2bD4Aaa1065d7C44CdFe0537308d41793Abe167`
- To: `0x74Eb232eF2f67C8fF8a5b67055d11012734CCE51`

Explorer URL:

- `https://testnet.monadscan.com/tx/0xaf5e06375697aae325b58fb7c485abc06d053ac81e4cf3a944e48467c25f544e`

## Build Guidance

- If the app needs proof of onchain activity, use a real Monad testnet transaction in the demo path.
- If the app needs explorer deep links, generate links to MonadScan directly.
- If contracts are deployed, plan for MonadScan verification as part of the shipping checklist.
