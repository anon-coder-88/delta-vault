# Reproducible local deployment

Required: Node 22.13+ (verified with 24.19.0), npm, Foundry 1.7.1 (forge/anvil), Solidity 0.8.30, curl/tar/sha256sum. OpenZeppelin 5.4.0 is integrity-pinned by package-lock; forge-std 1.9.7 is pinned by checksum in the installer.

```bash
npm ci
bash scripts/install-forge-std.sh
forge build
forge fmt --check
forge test
npm run build
npm run test:sdk
```

Start a disposable node in another terminal. Accounts are provided by Anvil; never fund these public development accounts on a public chain.

```bash
anvil --host 127.0.0.1 --port 8545 --chain-id 31337
npm run journey
```

The journey deploys genuine local contracts, mints development tokens, runs the SDK and asserts final balances. `docs/local-journey.json` records actual ephemeral local addresses/receipts and is replaced on each run. It is not a public deployment registry. The script refuses non-loopback RPC URLs or chain IDs other than 31337. For script-only deployment with an unlocked Anvil deployer:

```bash
LOCAL_DEPLOYER=<anvil-account-address> forge script contracts/script/DeployLocal.s.sol:DeployLocal \
  --rpc-url http://127.0.0.1:8545 --broadcast --unlocked --sender <anvil-account-address>
```

The script refuses nonlocal chains. Fill genuine local addresses from its output, never imagined ones. `npm run dev` starts the separate static console. Add Anvil's chain/RPC to an injected development wallet, connect, and enter a locally deployed vault address. The journey fully redeems its market; new console users must mint development collateral via the fixture and seed liquidity again. Price publisher is the real local deployer account. Publishing new values is a development action, not verified external market data.

No public deployment was performed. Robinhood Chain is the intended eventual environment; official IDs 4663/46630 and public endpoints were verified in documentation on 3 October 2026, but not exercised here. A future testnet deployment needs approved collateral, oracle/market mappings, reviewed risk parameters and operational ownership. Mainnet is outside this authorization.

The hosted website remains unchanged. To integrate later, supply a deployment registry with actual chain ID, address, bytecode/ABI verification, asset units and validated source. Build an adapter for each enabled action, add allowance/slippage/receipt/failure handling and preserve the existing demonstration mode. No runtime application backend is required by this MVP.
