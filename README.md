# DeltaVault Protocol

An isolated market vault for liquidity-backed, bounded long and short positions. LPs fund a market, traders post collateral, and contracts enforce exposure limits, reserve maximum profits, settle positions and return withdrawable claims.

**Local MVP · Not publicly deployed · Not audited.** This is an engineering extension of the DeltaVault Website PRD, not an integration into the existing hosted website. It is intended for review and reproducible local development. Robinhood Chain is the intended eventual network; no public protocol addresses or approved economic parameters are supplied.

## Implemented utility

- Market-specific ERC-4626 LP shares with exact-transfer collateral checks and virtual-share rounding.
- Collateral-funded long/short positions, leverage/position/exposure/count limits, bounded price/deadline execution and reserved maximum profits.
- Freshness/identity validation through an immutable price-source interface.
- Trader close, permissionless threshold liquidation, maturity settlement and delayed oracle-failure principal refund.
- Pull claims, exactly-once terminal states, pause that preserves exits and two-step administrative ownership.
- Genuine Foundry unit/fuzz/invariant tests, generated ABIs, viem SDK, static local console and executable SDK journey.

This first version caps profits and freezes all LP entry/exit while positions are open. It uses realized book value, not marked-to-market share pricing. Continuous trader activity can prolong the lock; an owner pause and externally submitted settlements are the drain mechanism. The supplied manually controlled development oracle and mintable collateral are fixtures, not production integrations. No automatic keeper, funding, hedging venue, token/governance or treasury fee mechanism is included.

## Local workflow

LP approves and deposits → trader approves collateral and opens a bounded long/short → trader or keeper submits a qualifying settlement → trader withdraws the claim → LP redeems after all positions terminate. Contracts enforce the rules; the interface alone cannot grant permissions or override limits.

```bash
npm ci
bash scripts/install-forge-std.sh
forge build
forge fmt --check
forge test
npm run build
npm run test:sdk
```

Use Node 22.13+ and Foundry 1.7.1. Solidity 0.8.30, OpenZeppelin 5.4.0, forge-std 1.9.7 and JavaScript dependencies are pinned. Start `anvil --host 127.0.0.1 --port 8545 --chain-id 31337` in another terminal, then run `npm run journey`. The journey deploys local contracts and verifies LP/trader balances and conservation of assets. `npm run dev` serves the focused local contract console; connect an injected development wallet and enter an actual local vault address. Read [deployment instructions](docs/deployment.md) for fixture funding and local script deployment.

## Repository

| Path | Content |
|---|---|
| contracts/src | MarketVault, price interface and bounded accounting library |
| contracts/test | Unit/fuzz/stateful invariants and clearly separated development fixtures |
| contracts/script | Local-only deployment |
| apps/web | Static local protocol interaction console |
| packages/sdk | viem transaction/read helpers with local-chain guards |
| packages/abi | Compiler-generated interfaces |
| docs | Source analysis, MVP specification, architecture, accounting, deployment, security, validation and language report |
| .github/workflows | Build, format, test, ABI drift, local journey and language checks |

The original website source was found and inspected at its existing project location. It remains in that separate repository without changes; its demo trading/vault actions remain distinct from contract writes. `apps/web` is a new focused protocol console, not an imported or replaced website. Combining the full website here later would require a new language measurement. See [source analysis](docs/source-analysis.md).

## Evidence and boundaries

[MVP specification](docs/mvp-spec.md) records proposals and PRD links. [Validation](docs/validation.md) records executed commands and actual results; [language report](docs/language-report.md) records eligible byte distribution for this repository. Neither test results nor a Solidity majority establishes production readiness.

Admin can pause openings/deposits and change risk parameters only without open positions. It cannot sweep funds, replace the immutable source/asset or upgrade contracts. Oracle publisher and collateral implementation remain external trust boundaries. LPs can lose capital; traders can lose all collateral; outage refunds forgive unrealized PnL. No live oracle, approved collateral, deployed keeper, security audit, public testnet evidence or production readiness is claimed. See [security model](docs/security.md) and [SECURITY.md](SECURITY.md).

No token ticker, supply or allocation is invented. `dvLP` is a vault accounting share and `devUSD` is a local fixture, not DeltaVault's governance/economic token. No Robinhood endorsement or partnership is implied.

MIT applies to newly authored code. Dependencies retain their own licenses and are not committed to inflate language statistics; see [dependency attribution](docs/dependencies.md).
