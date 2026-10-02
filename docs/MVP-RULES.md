# Testnet MVP rules

| Rule | Value |
| --- | --- |
| Collateral | dvUSD, 6 decimals, one faucet claim per address |
| Price | Owner-set test price, 8 decimals, valid for one hour |
| Leverage | Whole numbers, 1–5× |
| Maximum deposit or position collateral | 1,000,000 dvUSD |
| Position reserve | Full notional, covering the capped maximum profit |
| New-position capacity | Total reserves at most 80% of market LP assets |
| Profit cap | Position notional |
| Loss cap | Posted collateral |
| Liquidation eligibility | Mark loss reaches 80% of collateral |
| LP accounting | Proportional shares; integer rounding down |
| Withdrawal | Positive shares owned by caller, backed by unreserved market liquidity |
| Pause | Blocks deposits and new positions; exits remain subject to liquidity and price checks |
| Settlement | Once only, close by trader or liquidation by anyone when eligible |

These are the existing experimental contract rules, not a final production economic design. Liquidation refunds remaining collateral to the trader, has no keeper bounty, and requires an external caller. The native project token and a decentralized price feed are not implemented. Only local chain 31337 and Robinhood testnet 46630 are allowed. Never supply real assets.
