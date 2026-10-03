# Security model

Status: local engineering MVP, no audit or independent review. Passing tests establish exercised behavior only.

## Trust and powers

- Collateral implementation must be standard exact-transfer, nonrebasing ERC-20. Transfer-delta checks reject taxed assets; they do not certify adversarial assets.
- Immutable oracle adapter can influence entries, liquidations and payouts. The supplied manual development source is entirely controlled by its owner. No multisource check, deviation protection or validated public feed exists.
- Vault owner can pause openings/deposits and change risk config only with no open positions. It cannot take escrow/claims, replace asset/source or upgrade code. Ownership handover is two step. Inherited ownership renunciation is possible and can permanently remove operational controls.
- Any keeper can trigger eligible liquidation/expiry/recovery, but cannot direct the resulting trader claim to itself. No keeper is deployed, paid or scheduled.
- LP share transfers remain enabled while redemption is locked. Share buyers must understand current book value and contingent trader outcomes.

## Protections implemented

SafeERC20, OpenZeppelin ReentrancyGuard and ERC-4626 virtual-share conversions; checked casts; guarded shared LP hooks; exact token transfer deltas; source identity/freshness/bounds; initial margin and reserved-gain constraints; trader-only close; claim-only withdrawal; immutable terminal states; paused-entry drain path; delayed source-failure refund. No admin sweep, delegatecall, arbitrary transaction executor or upgrade authority.

## Material limitations

Book-value liquidity locks can be prolonged by repeated new positions. Minimum collateral and 64 open-position cap bound individual dust/record creation but do not guarantee an exit deadline. Operators must pause openings to drain a continuously used market. Price-source failure refund deliberately forgives unrealized PnL and can be gamed by a dishonest publisher. Unrewarded settlement requires external operators, and maturity uses the quote at execution rather than historical expiry. Reserve capacity is checked at opening; later settled trader gains can reduce book assets, so reported utilization may exceed the opening threshold even though outstanding reserved payouts remain fully backed.

Share previews have donation/front-run sensitivity and no caller-specified minimum shares in standard ERC-4626 methods. The virtual offset reduces classic inflation attacks; it does not establish fair market share valuation. No slippage-protected deposit router is included. Token implementation risks, network timestamps/ordering, oracle manipulation, delayed execution and economic attacks remain review subjects. Liquidation losses are bounded, there is no bad-debt socialization model or unlimited perpetual profit.

Foundry reports timestamp-use lints on freshness/deadline checks; timestamps are explicit trust assumptions and are not randomness. No lint suppression is used to imply a review pass. No Slither/formal verification, fork, production RPC, real wallet/browser, mobile QA or external penetration testing has been performed.

Do not deploy funded public markets until oracle/economic review, source adapter validation, asset review, liveness, permissions, production chain checks and independent security assessment are complete. See SECURITY.md for reporting handling and validation.md for exact evidence.
