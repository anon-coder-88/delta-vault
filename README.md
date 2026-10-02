# DeltaVault

A runnable, open-source testnet MVP for market-specific liquidity and leveraged long/short trading, with the **complete existing DeltaVault website**. The original contracts and website are reused; the SDK and standalone HTML client execute the experimental contracts. The existing website remains a clearly labelled demo.

## Repository

| Path | Purpose |
| --- | --- |
| `website/` | Complete React website, styling, animations, wallet brand assets and simulated product views |
| `contracts/` | Solidity escrow, market accounting, positions, settlement, liquidation and lens |
| `sdk/` | Independent typed protocol client |
| `scripts/` | Hardhat deployment, test-price updates and interaction CLI |
| `helpers/` | Python chain inspection and source-language measurement |
| `test/` | Contract scenarios and shared SDK integration journey |
| `web/` | Independent HTML/CSS/JavaScript contract client retained from the earlier MVP |
| `deployments/` | Deployment instructions; generated local configuration is ignored |
| `docs/` | Architecture, contract rules and limitations |

Solidity ^0.8.20 with OpenZeppelin, TypeScript, Python, HTML, CSS and JavaScript are all included. The website's existing framework, package manifest and pnpm lockfile are preserved.

## Run locally

Requires Node 22.13+ and Python 3.10+. The website uses pnpm 11.25.0.

```sh
npm install
cp .env.example .env
npm run compile
npm test
npm run node
```

In another terminal:

```sh
npm run deploy:local
npm run web
```

Open http://localhost:8080 for the experimental contract client. Use a disposable wallet on local chain 31337, claim mock collateral, approve, deposit liquidity, then open and close a position. Never fund development accounts with real assets. Deployment creates public address/ABI configuration for the HTML client and SDK.

The complete existing website is independently runnable:

```sh
cd website
pnpm install --frozen-lockfile
pnpm dev
```

The preserved website retains its branded wallet chooser, animations, Tokenomics page and simulated trading/vault flows. Those demos remain separate from contract execution. Use `web/` or the SDK/CLI for real test-chain actions. No hosted website changes are made by this repository publication.

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

## Robinhood testnet

Set a funded disposable test key and testnet RPC in the ignored `.env`, then run `npm run deploy:testnet`. Contracts accept chain 46630 and development chain 31337 only. Obtain test ETH for gas separately. No public contract deployment is claimed.

The existing website is hosted through Sites; publishing GitHub source does not deploy it. A future website execution integration requires a separate reviewed change. Generated deployment addresses are public configuration, never signing keys.

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

GitHub Linguist measured **5.16% Solidity** for the full monorepo ([executed report](https://github.com/anon-coder-88/delta-vault/actions/runs/37070115120)). This confirms that the 50% threshold is not met.
