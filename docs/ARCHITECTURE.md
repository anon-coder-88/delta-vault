# Architecture

The monorepo contains the complete website (`website/`), Solidity protocol (`contracts/`), typed viem SDK (`sdk/`), deployment and interaction scripts (`scripts/`), Python read helper (`helpers/`), and an independent contract UI (`web/`). The preserved website is a demo; its balances and rules are separate from chain execution.

`DeltaVaultMVP` holds collateral. Per-market liquidity backs proportional LP shares. Active trader collateral is separately accounted for. Each position reserves its capped maximum profit; settlement transfers trader payout and adds losses to or subtracts profits from that market's LP assets. Withdrawals can consume only unreserved assets. Pause blocks entries and deposits; exits remain available subject to fresh prices and liquidity.

`DeltaVaultLens` computes read-only quotes and status. `MockUSD` is a mock faucet collateral token. Deployment writes public addresses/ABIs to `web/config.json` and `deployments/current.json`. A website deployment JSON is also generated for future integration; the preserved website does not consume it.

The SDK checks deployment chain, signer account and RPC, simulates exact writes, waits for successful receipts, and extracts actual position IDs from events. The HTML client provides wallet-driven test-chain execution. Python inspections require only a public RPC and addresses. Signing keys belong only in the ignored `.env` for disposable local/testnet use.

There is no production oracle, funding system, automated keeper, native token or governance. Owner-set prices expire after one hour. An owner can manipulate prices; stale prices can strand settlement until refreshed. No user price bound or transaction deadline is implemented. See MVP-SCOPE.md and MVP-RULES.md before changing this model.
