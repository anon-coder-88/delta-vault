# DeltaVault

A runnable, open-source testnet MVP for market-specific liquidity and leveraged long/short trading, with the **complete existing DeltaVault website**. The original contracts and website are reused; the website now has a contract execution mode backed by a shared TypeScript SDK. The simulated demo remains separately available.

## Repository

| Path | Purpose |
| --- | --- |
| `website/` | Complete React website, styling, animations, wallet brand assets and execution views |
| `contracts/` | Solidity escrow, market accounting, positions, settlement, liquidation and lens |
| `sdk/` | Public export of the website's shared contract client |
| `scripts/` | Hardhat deployment, test-price updates and interaction CLI |
| `helpers/` | Python chain inspection and source-language measurement |
| `test/` | Contract scenarios and shared SDK integration journey |
| `web/` | Independent HTML/CSS/JavaScript contract client retained from the earlier MVP |
| `deployments/` | Deployment instructions; generated local configuration is ignored |
| `docs/` | Architecture, contract rules and limitations |

Solidity ^0.8.20 with OpenZeppelin, TypeScript, Python, HTML, CSS and JavaScript are all included. The website's existing framework, package manifest and pnpm lockfile are preserved.

## Run a complete local journey

Requires Node 22.13+ and Python 3.10+; pnpm 11.25.0 is specified by the website. Use a disposable test wallet and development chain only.

```sh
npm install
cp .env.example .env
npm run compile
npm test
npm run languages
npm run node
```

Keep the node running. In another terminal:

```sh
npm run deploy:local
cd website
pnpm install
pnpm dev
```

Open the local URL printed by the website server (normally http://localhost:5173). Deploying generates public configuration in `website/public/deltavault-deployment.json`. Choose a wallet through **Connect Wallet**, add/switch to local chain 31337 (RPC http://127.0.0.1:8545), and use a disposable Hardhat development account. Its standard development key is public and must never receive real funds; no key is stored in this repository.

1. Open Vaults in **Testnet contracts** mode and claim test dvUSD.
2. Enter 1,000 dvUSD, approve that exact amount, wait for confirmation, then deposit.
3. Open Trade, enter 100 dvUSD, approve, and open a 3× long or short.
4. The confirmed event supplies the actual position ID. Close it at the current test price, or change the test price using the deployer script to explore profit/loss.
5. View contract share value and balances in Portfolio. Withdraw your shares after reserves are released.

The account can be both LP and trader for exploration. Tests use separate accounts. To liquidate, anyone can supply an active position ID whose loss reaches 80% of collateral at a fresh test price. The contract price, pause and capacity checks are authoritative.

The HTML client is also available through `npm run web` at http://localhost:8080 and uses the same deployed contracts; it imports pinned ethers from a CDN. Its wallet chooser is the minimal utility client, while the complete website retains branded wallet options.

## Developer interaction tools

Run from the repository root. Reads use `ACCOUNT_ADDRESS` without a private key. Writes require a disposable `RH_PRIVATE_KEY` in the ignored `.env`; set `RH_RPC_URL` to the deployment's RPC.

```sh
RH_RPC_URL=http://127.0.0.1:8545 ACCOUNT_ADDRESS=0xYOUR_TEST_ADDRESS npm run interact -- status
npm run interact -- position 1
npm run interact -- faucet
npm run interact -- approve 100
npm run interact -- deposit 100
npm run interact -- openPosition 10 2 long
npm run interact -- closePosition 1
npm run interact -- withdraw 100
npm run interact -- liquidate 1
```

Amounts are six-decimal dvUSD; `withdraw` takes six-decimal shares. `MARKET` selects BTC-USD or ETH-USD. The CLI simulates actions and prints successful receipt hashes, not fabricated success.

SDK entry: `sdk/index.ts`, exporting `DeltaVaultClient`, `parseDeployment`, `marketId`, and the ABIs. It requires viem public and optional wallet clients. See `test/DeltaVaultClient.ts` for an end-to-end integration.

## Robinhood testnet and website publication

Set a funded disposable test key and the testnet RPC in `.env`, then run `npm run deploy:testnet`. The deployment script writes addresses for chain 46630. Obtain test ETH for gas separately. Rebuild/publish the website with its generated public deployment JSON; these are addresses, not secrets. Do not publish local chain configuration to the public hosted website.

No testnet or mainnet contract deployment is claimed by this source publication. Without deployment configuration the website explains that contracts are not configured and retains the selectable simulated demo.

The existing website is hosted through Sites. Its hosting manifest remains intact; GitHub source publication alone does not deploy the website. The public standalone configuration requires no private key.

Refresh owner-set prices:

```sh
DELTAVAULT_ADDRESS=0xYOUR_VAULT MARKET=BTC-USD TEST_PRICE=66000 npx hardhat run scripts/price.ts --network localhost
# Testnet:
npm run price:testnet
```

Python helper:

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
RH_RPC_URL=http://127.0.0.1:8545 python helpers/inspect.py
```

## Verification, scope and language target

Run `npm test`, `npx tsc --noEmit`, and `npm run website:check`. Website build: `pnpm --dir website build`. Verification results are in `VALIDATION.md`; architecture and test rules are in `docs/`.

The PRD's core vault/trading flow is implemented experimentally. Native token, governance, production oracle, automated keeper, production fee economics, and real-fund readiness are not implemented. Prices remain centrally controlled; contracts are unaudited. The onchain rules differ from the clearly labelled simulated website rules.

**The requested 50% Solidity target is not met when the complete website is included.** `LANGUAGES.json` reports the actual byte proportions, including TSX and JavaScript module files, excluding dependencies and generated builds. The original complete website is preserved instead of being omitted to satisfy a percentage. No filler contracts or language classification overrides are used. Reaching 50% requires a separately defined, substantially larger protocol scope; it is not a property of this MVP integration.

Never commit `.env`, signing keys, dependency folders or build output. Deployment files contain public configuration only. No software license is granted here beyond licenses already attached to reused components; wallet asset attribution remains in the website source.
