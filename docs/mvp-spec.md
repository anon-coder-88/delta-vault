# MVP: isolated liquidity-backed directional positions

Status: engineering proposal implemented and tested locally. Extends the frontend PRD; does not change its initial release fidelity or priorities.

## Candidate selection

| Candidate | Relevance | Coherent workflow | Dependencies | Risk / decision |
|---|---|---|---|---|
| Deposit/redeem vault only | Core LP theme, but no trading outcome | Complete custody/share loop | Standard token only | Lowest implementation risk; insufficient to show the trading/liquidity relationship |
| Isolated vault plus bounded directional positions | Directly combines the overview's markets, vaults, positions and risk engine | LP funding → long/short → settlement → claim → LP redemption | Standard collateral and explicit price interface; development substitutes available | Selected: fully reservable payout, manageable accounting and honest local utility |
| Full perpetual venue with funding, oracle network, netting and dynamic capacity | Broad product relevance | Incomplete without live integrations and authoritative economics | Missing oracle mapping, venue, assets, keepers and funding policy | Deferred; high engineering/economic risk and excessive first-version scope |

## Problem and users

Traders need observable rules for collateral-backed directional exposure. LPs need isolated market accounting and a clear relationship between their liquidity and trader outcomes. A developer or reviewer needs an executable contract workflow rather than a marketing-only repository.

One non-upgradeable `MarketVault` is bound to one market ID, collateral token and price source. LP shares represent the realized book value of that market. Traders fund their own positions; no delegated spend, offchain custody or external trade venue is implied. This is a bounded synthetic position MVP, not a full perpetual exchange.

## Complete workflow and PRD links

1. A local deployer configures a development market and seeds its explicitly manual price source. Developers mint development-only collateral.
2. LP approves collateral, deposits and receives ERC-4626 shares. VLT 002 and section 8 inform the share/accounting model.
3. Trader approves exact collateral, chooses direction/leverage, price bounds and deadline. Contract validates source freshness, initial margin, position/exposure and liquidity reservation limits. TRD 001–003 and RSK 001 inform this step.
4. Trader closes using a fresh bounded quote; alternatively any caller liquidates an eligible position, or settles after maturity using the current quote. TRD 004, RSK 002, section 8 and overview Settlement inform terminal states.
5. Settlement moves collateral and capped PnL into a pull claim; only its trader can withdraw to a valid recipient. A failed transfer leaves that claim intact.
6. When all positions terminate, LP entry/exit resumes. LP redeems at realized vault value, which can be lower or higher than deposit value. VLT 003 and DSC 001 inform withdrawal and loss disclosure.
7. After maturity plus a grace delay, unavailable pricing permits permissionless principal refund and reserve release. This is an explicit recovery proposal, not a whitepaper-approved settlement policy.

The website's P0 DEMO acceptances are not reclassified as live by these local tests. Wallet/site data, charts, persistence, motion and accessibility remain the website's separate scope.

## Units and accounting

| Quantity | Rule |
|---|---|
| Collateral, exposure, payout, reserves | Integer base units of the vault's immutable ERC-20 asset; local devUSD uses 6 decimals |
| Price | Positive 8-decimal quote, bounded to `1e18`; same quote convention at entry/settlement |
| Leverage and rates | Basis points, denominator 10,000; 50,000 means 5× |
| Exposure | `floor(collateral × leverageBps / 10000)` |
| Profit reserve | `ceil(exposure × profitCapBps / 10000)`; independently reserved for every position, no directional netting |
| Raw PnL magnitude | `exposure × abs(currentPrice − entryPrice) / entryPrice`; profit floors, loss ceils |
| Realized PnL | Profit ≤ reserved profit; loss ≤ collateral. No debt, uncapped gain, external hedge or funding assumed |
| Equity / payout | Collateral plus signed bounded PnL; never negative |
| Maintenance | `ceil(ceil(exposure × currentPrice / entryPrice) × maintenanceBps / 10000)`; equity at or below this boundary is liquidatable |
| LP assets | Actual collateral balance minus all open trader collateral and all settled unwithdrawn claims |
| Reservation capacity | `floor(LP assets × maxUtilizationBps / 10000)` at opening; open reservations must fit it |
| Available liquidity | LP assets minus reserved profit; utilization measures reserved profit / LP book assets, not open exposure / deposits |
| Shares | OpenZeppelin virtual asset + virtual shares, offset 6; devUSD shares have 12 decimals. Preview conversions use standard ERC-4626 floor/ceil rules |
| Fees | Zero in this MVP. No assumed treasury routing, liquidation reward, vault APY or approved token economy |

LP deposits, mints, withdrawals and redemptions are **all frozen while any position is open**. Book value is not marked-to-market. Freezing avoids letting LPs exit ahead of unrealized trader profits or enter ahead of trader losses at stale share prices. Standard share transfers remain possible, but confer no withdrawal exemption. This lock is intentionally conservative and can be prolonged by continuing trader activity; there is no unconditional immediate withdrawal promise. Admin pause prevents new entries and enables draining existing positions, but needs an operator to submit transactions.

Collateral must be non-rebasing and transfer exactly the requested amount. Balance-delta checks reject taxed/fee transfers in both directions. Malicious token implementations and rebases cannot be made compatible by these checks; asset selection is a trust boundary. Donations accrue to LP assets. ERC-4626 previews are not transaction slippage guarantees; integrations should simulate and evaluate expected shares close to submission.

## Contract responsibility and permissions

- `MarketVault`: custody, shares, isolated risk limits, validated-price use, lifecycle, reserve release and claims. Immutable asset/source/market; no arbitrary calls, withdrawals by admin, proxy or cross-vault exposure.
- `PositionMath`: bounded integer payout and maintenance calculation with explicit rounding and checked signed casts.
- `IPriceSource`: market ID plus price/timestamp. Adapter implementation is responsible for trustworthy quote construction. No production adapter is supplied.
- Admin: two-step ownership; pause new deposits/positions; update config only when no positions are open. Cannot change asset/source or take assets. Can renounce ownership through inherited Ownable; doing so forfeits pause/config control and is operationally risky.
- Traders: fund themselves; close own positions; withdraw own claims to chosen recipients. No contract-side idempotency key for repeated opening: each distinct valid transaction intentionally opens a new position. The local UI prevents concurrent clicks but users/SDK callers must manage retries and receipts.
- Any caller: liquidate if threshold met; expire at maturity; refund principal if unavailable source after maturity + delay. No caller reward; production liveness is unresolved.
- Manual development publisher: controls prices and can induce any local outcome. Not an independent oracle or attestation service.

Contracts do not schedule themselves. User, keeper or operator submits every transaction. SDK and console use generated ABIs, real receipts and local-chain guards. No offchain computation or attested execution is being sold as onchain proof.

## States, events and failures

Position `Missing → Open → Closed | Liquidated | Expired | Refunded`. Terminal states are immutable. Each successful open increases exposure, escrow, reserved profit and open count once. Each terminal action releases those quantities once and credits the trader. Withdrawn claims are separate from terminal position state.

`PositionOpened`, `PositionSettled`, `ClaimWithdrawn`, `ConfigChanged`, `OpeningsPauseChanged`, and inherited ERC-20/ERC-4626/ownership events support observability. Refunded settlements use price zero as an explicit unavailable-price sentinel with PnL zero, not a zero market quote.

Reject zero/unsupported amounts, leverage outside bounds, untrusted receivers (zero or vault itself), collateral below minimum, exhausted position/count/exposure/reserve capacity, missing/terminal IDs, unauthorized admin or trader, exceeded price bounds/deadlines, invalid/stale/future price, healthy liquidation, premature expiry/refund, and empty claim withdrawal. SafeERC20 failures revert all affected accounting. Mint/deposit caps and withdrawal maxima are enforced by inherited ERC-4626 entry checks plus shared guarded hooks.

## Local configuration and pending production choices

The deployment script uses: deposit cap 1,000,000 devUSD; minimum collateral 1 devUSD; max position exposure 10,000 devUSD; market exposure 100,000 devUSD; leverage 1–5×; maintenance 5% of marked exposure; profit cap 20% of entry exposure; reservation utilization 80%; maximum 64 open positions; source age 300 seconds; position maturity 1 hour; oracle-refund grace 1 hour. These are editable local parameters, **not approved product economics**. Code bounds leverage to 10× and utilization to 90% maximum and enforces positive excess initial margin.

Maturity permits settlement at the **current** quote when someone calls, not a historic quote at the exact expiry second. There is no hard-coded chain restriction in reusable MarketVault bytecode; deployment script, SDK and console enforce local-chain use. Production environment, collateral, reference asset, oracle adapter, source validity, reward/liveness system, fair LP entry/exit model, outage PnL policy, adversarial oracle/economic analysis and legal restrictions require review. No ticker or token allocations are deployed.

Deferred: unlimited perpetuals, funding, partial liquidation, collateral modification, orders/stops, hedging, queues, permissionless market factory, dynamic leverage, multisource/circuit-breaker oracle, governance/token/treasury fees, staking, rewards, indexer and website integration.

## Acceptance evidence required

- Full LP funding → leveraged trade → settlement → claim → LP redemption conserves assets with expected realized balances.
- Long/short signs, profit/loss caps, maintenance and rounding fixtures match independently calculated cases.
- Permissions, capacity inclusivity, stale/future/invalid prices, overdraw, allowance, external-call failures and repeated terminal actions reject without partial mutation.
- Stateful fuzzing preserves token conservation, escrow/claims exclusion and open-ledger/reserve agreement.
- Compile, format, SDK types/tests, static console build and local-chain journey pass; generated ABIs match compiled signatures.
- Separate public-chain, deployed-website and security evidence must remain explicitly unperformed unless actually executed. See validation.md.
