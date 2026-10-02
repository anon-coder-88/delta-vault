"""Read market state; no private key required."""
import json
import os
from pathlib import Path
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()
root = Path(__file__).resolve().parents[1]
config = json.loads((root / 'web/config.json').read_text())
w3 = Web3(Web3.HTTPProvider(os.getenv('RH_RPC_URL', 'http://127.0.0.1:8545'), request_kwargs={'timeout': 15}))
if w3.eth.chain_id != config['chainId'] or w3.eth.chain_id not in (31337, 46630):
    raise SystemExit('Wrong network; use the deployment network')
vault = w3.eth.contract(address=config['vault'], abi=config['vaultAbi'])
market = os.getenv('MARKET', 'BTC-USD')
state = vault.functions.markets(Web3.keccak(text=market)).call()
print(json.dumps(dict(market=market, liquidity=state[0], shares=state[1], reserved=state[2],
                      price=state[3], updated_at=state[4], enabled=state[5]), indent=2))
