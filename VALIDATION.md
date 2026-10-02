# Verification — 2 October 2026

## Passed locally

- Solidity compiled with compiler 0.8.24 and OpenZeppelin 5.6.1. The reused contracts retain pragma ^0.8.20. No contract source was padded or rewritten for a language percentage.
- Ten automated tests passed: long/short settlement, capacity and pause, ownership and liquidation, market isolation, transfer-tax rejection, lens quotes, stale/unauthorized prices, deployment-file validation, and the shared SDK journey.
- The SDK journey uses the same client as the website: faucet, exact approval, LP deposit, trader entry, receipt-derived ID, account mismatch rejection, unauthorized close rejection, changed-price profit, settlement, withdrawal and repeat-close rejection. Bounded portfolio history is checked against account ownership.
- Root TypeScript and website TypeScript checks passed.
- All 16 preserved website demo/data tests passed.
- Production website build passed and pre-rendered all routes, including the new contract execution route.
- Local Hardhat RPC deployment succeeded; generated website deployment chain and all three contract bytecodes were verified. Local chain configuration remains ignored and is not installed on the public hosted website.
- Standalone JavaScript syntax and Python helper syntax passed.

## Limits

- No funded Robinhood testnet signer was available, so no public testnet contract deployment or real browser wallet transaction is claimed.
- The public website displays a deployment setup state and provides a separate simulated demo until public testnet addresses are configured.
- Python web3 dependencies were not installed in the execution environment; the helper's web3 runtime was not exercised.
- The browser's signer integration uses the existing wagmi wallet chooser, but automated contract tests do not prove extension-specific signing behavior.
- CI configuration is included; GitHub CI results must be checked separately after publication. Clean dependency installation was not independently repeated; local verification used existing installed dependencies.
- Solidity remains below 50% of the combined authored source. `LANGUAGES.json` includes the full website and reports both overall and non-test proportions honestly.
- Centralized test prices, missing slippage bounds, lack of an audit, and the experimental liquidation rule make this unsuitable for real funds.
