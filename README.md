# DeltaVault MVP utility

A focused, executable **testnet utility** derived from the DeltaVault Website PRD (draft v1.0, 2 October 2026). Liquidity providers fund separate BTC-USD and ETH-USD vault ledgers; traders use test collateral to open leveraged long/short positions against that market's liquidity. Positions close or liquidate onchain, and LP shares reflect trader outcomes.

The previously created `DeltaVaultMVP.sol` and `MockUSD.sol` are reused unchanged. This repository extracts that utility instead of restoring the full marketing website. A small browser client connects to the contracts. The existing hosted website is a separate project.

## Scope and PRD derivation

| PRD area | Implemented utility |
| --- | --- |
| VLT 002 / VLT 003 | Six-decimal test collateral, market-specific LP shares, deposit and reserve-aware withdrawal |
| TRD 001 / TRD 003 / TRD 004 | Collateral × leverage exposure, long/short entry and one-time settlement |
| RSK 001 / RSK 002 | Capacity checks, bounded PnL, permissionless unhealthy-position liquidation |
| WAL 001 / WAL 002 | Browser wallet discovery, account connection, deployment-network gating |
| DAT 001 / DOC 001 | Contract events, timestamped test prices, read-only lens and documented assumptions |

The PRD specifies a demonstration website and leaves live execution interfaces and production risk policies unresolved. The new source utility is a testnet extension requested here, **not an approved production protocol**. No native project token, staking, governance, funding payments, production oracle, or mainnet deployment is implemented.

## Contracts and accounting

- `DeltaVaultMVP`: reused escrow and market ledgers. Deposits mint proportional shares; withdrawals burn them and cannot spend reserved liquidity. Fee-on-transfer collateral is rejected.
- `MockUSD`: one 10,000 dvUSD faucet claim per address. This is a test asset, not a stablecoin or native DeltaVault token.
- `DeltaVaultLens`: read-only market/account snapshots, deposit/withdraw/open quotes, and position payout/liquidation status. Quotes can change before transaction execution.
- `contracts/test`: local scenario actors and transfer-tax fixtures. They are not deployed by the utility deployment script.

Illustrative rules: leverage 1–5×; open-position notional reserves its maximum profit; total reserves may not exceed 80% of current market liquidity; profit capped at notional; loss capped at posted collateral; liquidation permitted at an 80% collateral loss. Price precision is 8 decimals, collateral/share precision 6 decimals. Owner-set prices expire after one hour. These fixed rules are MVP assumptions, not the PRD's unresolved production maintenance-margin formula. Trader profits reduce that market's LP assets; trader losses increase them. Withdrawal shares round down to assets; deposits round down to shares. The lens uses matching rounding.

Pausing blocks new deposits and positions; funded withdrawals and closes remain available subject to reserve and fresh-price checks. Disabling a market blocks new entries but permits exits. An owner can delay settlement by failing to refresh prices. This centralized test-price dependency is intentional and makes the utility unsuitable for real capital.

## Run locally

Requires Node.js 22.13+ and Python 3.10+ (Python is optional unless using the helper).

```sh
npm install
npm run compile
npm test
npm run languages
cp .env.example .env
npm run node
```

Keep the local node running. In another terminal:

```sh
npm run deploy:local
npm run web
```

Open `http://localhost:8080`. Add local chain ID **31337** to a test wallet and use a disposable local development account supplied by Hardhat. The deploy script writes `web/config.json` with public addresses and ABIs. Choose a wallet, connect, claim dvUSD, approve an amount, deposit liquidity, then open and close a position. Approvals and utility actions are separate transactions; only receipts establish confirmation. The UI reports the actual position ID from the emitted event.

## Robinhood Chain testnet

Set `RH_RPC_URL` and a disposable, funded `RH_PRIVATE_KEY` in your ignored `.env`, then run:

```sh
npm run deploy:testnet
npm run web
```

Connect a wallet on chain **46630**. Obtain test ETH separately from the network faucet; the dvUSD faucet does not supply gas. Local and Robinhood testnet are enforced by the deployed contracts. No testnet contract deployment is claimed merely by publishing this repository.

Refresh a test price with the deployer account:

```sh
DELTAVAULT_ADDRESS=0xYOUR_DEPLOYED_VAULT MARKET=BTC-USD TEST_PRICE=66000 npm run price:testnet
```

For local price changes use `npx hardhat run scripts/price.ts --network localhost` with the same variables. Default market examples are BTC-USD at 60,000 and ETH-USD at 3,000; they are not live price feeds.

Optional read helper:

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
RH_RPC_URL=http://127.0.0.1:8545 python helpers/inspect.py
```

Use the configured testnet RPC instead for testnet reads. No private key is used by the helper. Browser ethers imports from a pinned public CDN, so that client needs internet access. The npm/contract tests run independently of the browser client.

## Verification and language composition

The test suite exercises long/short settlement, LP loss and accounting conservation, exact capacity boundaries, pause exits, position ownership, liquidation terminal states, market isolation, transfer-tax rejection, lens quotes, and stale-price/unauthorized-price rejection. CI compiles contracts, runs tests, checks TypeScript and JavaScript, and enforces the Solidity ratio.

`npm run languages` measures authored source bytes across Solidity, TypeScript, Python, HTML, CSS, and JavaScript. It excludes installed dependencies, generated artifacts, deployment config, and documentation; it does not vendor OpenZeppelin or manipulate GitHub language classification. The measured results are in `LANGUAGES.json`. Solidity remains above 50% even when Solidity test contracts are excluded. GitHub may refresh its language bar asynchronously.

No private keys are committed. Keep `.env`, dependencies, artifacts, and generated `web/config.json` out of source control. The contracts are not audited.

Official network configuration: https://docs.robinhood.com/chain/connecting/ and https://docs.robinhood.com/chain/add-network-to-wallet/ (checked 2 October 2026). OpenZeppelin dependency: https://docs.openzeppelin.com/contracts/5.x/.
