# DeltaVault architecture

The existing website is preserved in `website/`: pages, animations, local demo engine, assets, fonts and branded wallet discovery. The contract execution view is integrated into `/trade`, `/vaults`, `/vaults/btc`, `/vaults/eth`, `/portfolio` and `/onchain`. Demo mode remains separately selectable. Demo balances never become wallet collateral.

`website/lib/onchain/client.ts` is the canonical shared viem client. `sdk/index.ts` exports that same implementation to the CLI and tests; there are no divergent handwritten write paths. The browser obtains a signer from wagmi, while the CLI obtains a disposable test signer from the ignored environment. Reads require no key. The client validates deployment chain and addresses, checks signer accounts and RPC network, simulates writes, waits for successful receipts, and decodes position IDs from contract events.

`DeltaVaultMVP` escrows six-decimal collateral. Each market maintains separate LP assets, shares and capped-profit reserves. Trader collateral is separate from LP assets until settlement. Profits reduce the corresponding LP assets; losses increase them. `DeltaVaultLens` provides read-only quotes. `MockUSD` is a test faucet token, not the native DeltaVault token.

The deployment script creates BTC-USD and ETH-USD example markets and writes public addresses to `website/public/deltavault-deployment.json`, `deployments/current.json` and `web/config.json`. Generated local addresses are ignored. The public website has a clear setup state when no real deployment configuration is installed. A hosted website cannot connect to somebody else's localhost RPC; local contracts require the locally running website and node.

No production oracle, price automation, native token, governance or production funding fees are claimed. The deployer manually supplies test prices, which expire after one hour. Existing illustrative demo rules (fees, ten-times leverage and sample margin) are intentionally not represented as contract rules.

## Transaction states

1. Validate configuration and user input.
2. Check the wallet and RPC networks and signer account.
3. Simulate the exact contract operation.
4. Request wallet approval; rejection is an error, not success.
5. Show submitted transaction hash while awaiting its receipt.
6. Confirm only a successful receipt, then refresh chain balances.

A failed read after confirmation does not undo a confirmed transaction. The UI shows a separate read error; approvals and spending are separate user actions. Quotes and displayed balances can change before execution; the contract remains authoritative. This MVP does not implement user-defined slippage limits or an execution-price deadline.
