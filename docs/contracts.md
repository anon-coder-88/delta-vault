# Contract interfaces

| Contract / method | Responsibility / caller |
|---|---|
| MarketVault `deposit`, `mint` | Approving LP funds immutable asset and receives ERC-4626 shares; no open positions, cap and pause checked |
| `withdraw`, `redeem` | LP or allowance-approved caller burns shares and receives collateral; no open positions |
| `openPosition(collateral, leverageBps, isLong, minPrice, maxPrice, validUntil)` | Trader approves/funds self; returns unique ID; reserves capped profit |
| `closePosition(id, minPrice, maxPrice, validUntil)` | Position trader settles into a pull claim |
| `liquidate(id)` | Any caller submits a fresh-price maintenance breach |
| `expire(id)` | Any caller settles at current fresh price after position deadline |
| `refundAfterOracleFailure(id)` | Any caller restores principal when source unavailable after deadline + grace |
| `withdrawClaim(receiver)` | Claim owner withdraws entire claim to valid receiver; token failure reverts the withdrawal |
| `quotePosition`, `validatedPrice` | Read current fresh-price equity/liquidatability; failure is explicit |
| `totalAssets`, `reservedProfit`, `openExposure`, `escrowedCollateral`, `totalClaims`, `claims` | Observable book assets and obligations in integer collateral units |
| `setConfig`, `setOpeningsPaused` | Owner-only; config frozen with open positions; pause never blocks exits/settlement |
| PositionMath | Integer arithmetic; loss ceil, gain floor and bounded payoff |
| IPriceSource | Immutable market identity and 8-decimal quote/timestamp interface |

Compiler-generated ABIs are in `packages/abi/index.ts`. Run `npm run abi` after every build; CI regenerates and rejects drift. DevelopmentAsset/DevelopmentPriceSource live under test fixtures and are used only by the local deployment/journey. There are no live oracle or collateral addresses in a deployment registry.
