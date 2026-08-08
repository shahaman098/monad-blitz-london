# Monad Integration Prompt

```text
Read AGENTS.md, docs/product.md, docs/architecture.md, docs/monad-reference.md, and docs/tasks.md.

Implement the smallest Monad integration needed for the MVP.

Possible integration types:
- wallet connect
- Monad testnet transaction send
- MonadScan explorer deep links
- MonadScan or Etherscan-style API reads
- contract deploy plus verification

Rules:
- Keep the onchain footprint minimal.
- Prefer real Monad testnet data over fake placeholders when it improves the demo.
- Update docs/tasks.md as you work.
- Add any required env vars to .env.example.
- Run the relevant checks.
```
