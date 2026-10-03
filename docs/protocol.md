# Protocol economics and limitations

The MVP creates bounded synthetic exposure collateralized against isolated LP capital. It does not buy or sell the reference asset. Positive trader outcomes reduce LP assets; negative outcomes increase them. Reservations guarantee enough assets for each position's maximum gain under the accounting model. Directional netting is not used.

For 1,000 devUSD collateral at 5× and entry 2,000, exposure is 5,000 and maximum gain reserve is 1,000. A close at 2,200 realizes +500, payout 1,500 and decreases an initially 10,000 LP book to 9,500. A long close at 1,800 realizes −500 and increases that book to 10,500. In this configuration gains above 1,000 are capped, and losses cannot exceed the 1,000 collateral. A short reverses the price direction. These are engineering examples, not guarantees from the original overview.

No ongoing funding, approved fee schedule, liquidation incentive or treasury charge exists. LP value changes only with settled trader PnL and donations. Historical share previews do not promise APY or immediate liquidity. Unsettled price moves do not change LP NAV; entry and exit lock until all positions have reached terminal state.

An admin pause is the available drain control: stop new positions, then users/keepers settle, expire or invoke delayed outage refunds before LP redemption. The oracle-outage recovery restores principal and forgives PnL; adversarial publishers can manipulate this tradeoff. Liquidation and maturity execution are transaction-triggered, potentially delayed and unrewarded. This model requires substantial economic/liveness work before a continuously open public venue would be appropriate.

No governance token is implemented. Existing website tokenomics proposals are not imported as approved protocol economics. The vault share symbol `dvLP` and fixture `devUSD` denote accounting/development assets, not the project's unspecified native ticker.
