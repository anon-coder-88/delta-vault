# DeltaVault MVP

A Robinhood Chain **testnet-only** experiment built from the DeltaVault website source (Sites revision `323355550fda603689f69759e773cc26c0491dba`). The original `/trade`, `/vaults`, and `/portfolio` remain device-local demonstrations. The new `/onchain` route calls `DeltaVaultMVP` with a real wallet.

## What works

- One faucet claim of 10,000 **test dvUSD** per address.
- Separate BTC-USD and ETH-USD market vault accounting; deposit, shares, and withdrawals subject to reserved liquidity.
- Collateralized long/short positions up to 5×, 80% utilization limit, capped profit, collateral-limited loss, close, and permissionless liquidation at 80% collateral loss.
- Owner-set 8-decimal test prices, one-hour freshness check, and emergency pause of new exposure. The owner can change prices and thereby determine outcomes. **No independent oracle, audit, or production token is included. Do not use real funds.**

## Local setup

Requires Node.js 22.13+ and pnpm 11.25+, plus Python 3.10+ for the optional read helper.

```bash
pnpm install
cp .env.example .env
pnpm contracts:compile
pnpm contracts:test
pnpm contracts:deploy:local
```

The local deployment command prints the token and vault addresses and market IDs. For a persistent local chain, run `pnpm hardhat node` in one terminal and `pnpm hardhat run scripts/onchain/deploy.ts --network localhost` in another; the default in-memory deployment resets after the script. For a testnet deployment, put a **throwaway testnet-only** key in the ignored `.env` as `RH_PRIVATE_KEY`, fund it with test ETH, then:

```bash
pnpm contracts:deploy:testnet
```

Copy the printed addresses to `NEXT_PUBLIC_DELTAVAULT_ADDRESS`, `NEXT_PUBLIC_TEST_TOKEN_ADDRESS`, and `DELTAVAULT_ADDRESS` in `.env`. Restart the web app after changing public variables:

```bash
pnpm dev
```

Open `/onchain`. Connect Wallet, switch to Robinhood testnet, claim dvUSD, approve an amount, then deposit or open a position. Approvals and actions are separate transactions. Position IDs are shown by `nextPositionId` and in the `PositionOpened` event. `/mvp.html` is a small plain HTML/CSS/JavaScript entry page for the same app.

The deployer can update a test price with `MARKET=BTC-USD TEST_PRICE=61000 pnpm contracts:price:testnet`. Test prices must be updated at least hourly for trading or settlement. The UI does not set prices.

Optional read-only Python inspection:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python helpers/inspect.py
```

## Boundaries

This prototype uses the original website source without replacing its simulation. The onchain route only works after you deploy contracts and configure addresses. It does not implement production oracle feeds, insurance, token economics, robust market risk, governance, or an audit. It is restricted in code to chain IDs 31337 and 46630. Do not put `RH_PRIVATE_KEY` in any `NEXT_PUBLIC_` variable or commit `.env`.

## Checks

`pnpm contracts:compile`, `pnpm contracts:test`, `npx tsc --noEmit`, and `pnpm build`.
