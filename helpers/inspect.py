"""Read DeltaVault MVP market state with web3.py; never needs a private key."""
import json
import os
from web3 import Web3

RPC = os.getenv('RH_RPC_URL', 'https://rpc.testnet.chain.robinhood.com')
ADDRESS = os.getenv('DELTAVAULT_ADDRESS')
MARKET = os.getenv('MARKET', 'BTC-USD')
ABI = json.loads('[{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"markets","outputs":[{"internalType":"uint256","name":"liquidity","type":"uint256"},{"internalType":"uint256","name":"totalShares","type":"uint256"},{"internalType":"uint256","name":"reserved","type":"uint256"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"uint64","name":"updatedAt","type":"uint64"},{"internalType":"bool","name":"enabled","type":"bool"}],"stateMutability":"view","type":"function"}]')

def main():
    if not ADDRESS or not Web3.is_address(ADDRESS):
        raise SystemExit('Set DELTAVAULT_ADDRESS to the deployed testnet contract')
    w3 = Web3(Web3.HTTPProvider(RPC, request_kwargs={'timeout': 12}))
    if w3.eth.chain_id != 46630:
        raise SystemExit('Expected Robinhood Chain testnet (46630)')
    contract = w3.eth.contract(address=Web3.to_checksum_address(ADDRESS), abi=ABI)
    values = contract.functions.markets(Web3.keccak(text=MARKET)).call()
    print(json.dumps(dict(market=MARKET, liquidity_dvUSD=values[0]/1e6,
                          shares=values[1], reserved_dvUSD=values[2]/1e6,
                          test_price=values[3]/1e8, updated_at=values[4], enabled=values[5]), indent=2))

if __name__ == '__main__':
    main()
