# MVP decision and evidence

The PRD (DeltaVault Website PRD, draft v1.0, 2 October 2026) establishes market-specific vaults, collateralized long/short positions, capacity limits, settlement and liquidation. It explicitly says deployment addresses, real oracle integration and approved risk parameters are missing. This repository makes those flows executable on a development chain or Robinhood testnet, not production-ready.

## Traceability

| Product requirement | Protocol implementation | Verification |
| --- | --- | --- |
| VLT-002 / VLT-003 | Proportional LP shares; withdrawals limited by reserved liquidity | Solidity scenarios and randomized accounting test |
| TRD-001 / TRD-003 / TRD-004 | Collateralized positions; bounded leverage; trader-only single settlement | Long/short scenarios, SDK receipt journey |
| RSK-001 | Market-specific reserve ceiling and isolated accounting | Capacity and isolation scenarios, randomized invariant |
| RSK-002 | Permissionless liquidation of unhealthy positions at fresh prices | Liquidation and stale-price tests |
| WAL-001 / WAL-002 | Existing branded frontend wallet connection; SDK chain/account validation | SDK validation tests; live wallet UI not tested here |
| DAT-001 / DOC-001 | Separate simulated website and experimental contract utility | Preserved frontend, scope and accounting documentation |

## Deliberate experimental choices

Use six-decimal mock collateral; 1–5× leverage; reserve each position's full notional; entry reserves cannot exceed 80% of LP liquidity; cap positive PnL at notional and negative PnL at posted collateral; liquidate at 80% collateral loss; owner-supplied eight-decimal prices expire after one hour. These are engineering assumptions, not approved financial policy. There are no funding payments or protocol fees.

The product is a **capped synthetic exposure sandbox**, not a production perpetual exchange. Reserve accounting bounds worst-case payouts. An owner can still choose arbitrary prices and extract LP value through favorable trades; central pricing is a material trust assumption. Stale prices block settlement, so availability depends on the owner. Permissionless liquidation requires someone to submit a transaction; there is no running keeper service.

No token issuance, governance, oracle decentralization, real-fund deployment or audit is claimed. The frontend's illustrative leverage/margin rules remain distinct and do not describe these contracts. The hosted website is preserved; this source publication does not redeploy it.

## Repository and language decision

The user selected a full monorepo after being informed that the complete frontend prevents the 50% Solidity target for this MVP. Preserve authored frontend code and report the actual composition. Do not inflate contracts or classify authored frontend as generated or vendored. The local byte report is an estimate, not GitHub Linguist verification. GitHub's own language output is the authoritative repository result.
