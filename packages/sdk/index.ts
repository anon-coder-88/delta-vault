import {
  type Address, type PublicClient, type WalletClient, type Hash,
  decodeEventLog, getAddress, parseUnits,
} from 'viem';
import {MarketVaultAbi, DevelopmentAssetAbi} from '../abi/index';

export {MarketVaultAbi};
export const NETWORKS = {
  local: {chainId: 31337, rpc: 'http://127.0.0.1:8545', mode: 'local'} as const,
  robinhoodTestnet: {chainId: 46630, rpc: 'https://rpc.testnet.chain.robinhood.com', mode: 'unavailable'} as const,
};

/** Exact integer parsing. Asset decimals must come from the selected token. No floating point inputs. */
export function assetUnits(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw Error('Invalid decimals');
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) throw Error('Enter a nonnegative decimal amount');
  if ((value.split('.')[1]?.length ?? 0) > decimals) throw Error('Excess precision');
  const amount = parseUnits(value, decimals);
  if (amount <= 0n) throw Error('Amount must be positive');
  return amount;
}

export function positionIdFromReceipt(logs: readonly {data: `0x${string}`; topics: readonly `0x${string}`[]; address: string}[], vault: Address): bigint {
  for (const log of logs) {
    if (log.address.toLowerCase() !== vault.toLowerCase()) continue;
    try {
      const event = decodeEventLog({abi: MarketVaultAbi, data: log.data, topics: [...log.topics] as [`0x${string}`, ...`0x${string}`[]]});
      if (event.eventName === 'PositionOpened') return event.args.id;
    } catch { /* Other token/contract events are not position IDs. */ }
  }
  throw Error('PositionOpened event missing from confirmed receipt');
}

/** Local MVP client: all writes simulate first and await successful receipts. No public deployment registry exists. */
export function marketClient(publicClient: PublicClient, wallet: WalletClient, vaultAddress: Address) {
  const vault = getAddress(vaultAddress);
  async function account() {
    const selected = wallet.account ?? (await wallet.getAddresses())[0];
    if (!selected) throw Error('Connect an account');
    const walletChain = await wallet.getChainId();
    const readChain = await publicClient.getChainId();
    if (walletChain !== readChain || readChain !== 31337) throw Error('Local chain 31337 required');
    return selected;
  }
  async function confirmed(hash: Hash) {
    const receipt = await publicClient.waitForTransactionReceipt({hash});
    if (receipt.status !== 'success') throw Error(`Transaction reverted: ${hash}`);
    return receipt;
  }
  async function write(functionName: string, args: readonly unknown[], address = vault, abi: readonly unknown[] = MarketVaultAbi) {
    // The internal helper dispatches generated ABI methods; simulation validates the runtime argument shapes.
    const simulation = await publicClient.simulateContract({address, abi, functionName, args, account: await account()});
    return confirmed(await wallet.writeContract({...simulation.request, chain: wallet.chain ?? null}));
  }
  async function bounds() {
    const price = await publicClient.readContract({address: vault, abi: MarketVaultAbi, functionName: 'validatedPrice'});
    const block = await publicClient.getBlock();
    return {price, deadline: block.timestamp + 120n};
  }
  return {
    vault,
    async snapshot(owner: Address) {
      const read = <T extends 'totalAssets' | 'reservedProfit' | 'escrowedCollateral' | 'totalClaims' | 'openExposure' | 'openCount'>(functionName: T) =>
        publicClient.readContract({address: vault, abi: MarketVaultAbi, functionName});
      const [assets, reserve, escrow, totalClaims, exposure, count, claim, shares, price] = await Promise.all([
        read('totalAssets'), read('reservedProfit'), read('escrowedCollateral'), read('totalClaims'), read('openExposure'), read('openCount'),
        publicClient.readContract({address: vault, abi: MarketVaultAbi, functionName: 'claims', args: [owner]}),
        publicClient.readContract({address: vault, abi: MarketVaultAbi, functionName: 'balanceOf', args: [owner]}),
        publicClient.readContract({address: vault, abi: MarketVaultAbi, functionName: 'validatedPrice'}),
      ]);
      return {assets, reserve, escrow, totalClaims, exposure, count, claim, shares, price};
    },
    async approveAsset(amount: bigint) {
      const asset = await publicClient.readContract({address: vault, abi: MarketVaultAbi, functionName: 'asset'});
      return write('approve', [vault, amount], asset, DevelopmentAssetAbi);
    },
    deposit: (assets: bigint, receiver: Address) => write('deposit', [assets, receiver]),
    redeem: (shares: bigint, receiver: Address, owner: Address) => write('redeem', [shares, receiver, owner]),
    async open(collateral: bigint, leverageBps: number, isLong: boolean) {
      const {price, deadline} = await bounds();
      const receipt = await write('openPosition', [collateral, leverageBps, isLong, price, price, deadline]);
      return {receipt, id: positionIdFromReceipt(receipt.logs, vault)};
    },
    async close(id: bigint) {
      const {price, deadline} = await bounds();
      return write('closePosition', [id, price, price, deadline]);
    },
    liquidate: (id: bigint) => write('liquidate', [id]),
    expire: (id: bigint) => write('expire', [id]),
    recover: (id: bigint) => write('refundAfterOracleFailure', [id]),
    withdrawClaim: (receiver: Address) => write('withdrawClaim', [receiver]),
  };
}
