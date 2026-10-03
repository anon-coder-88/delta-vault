import {readFile, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPublicClient, createWalletClient, http, keccak256, stringToHex, type Address, type Abi, type Hash} from 'viem';
import {foundry} from 'viem/chains';
import {DevelopmentAssetAbi, DevelopmentPriceSourceAbi, MarketVaultAbi} from '../packages/abi/index';
import {marketClient, assetUnits} from '../packages/sdk/index';

const url = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
if (!['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname)) throw Error('Loopback RPC required');
const publicClient = createPublicClient({chain: foundry, transport: http(url)});
assert.equal(await publicClient.getChainId(), 31337, 'Local chain only');
const [admin, lp, trader] = await createWalletClient({chain:foundry,transport:http(url)}).getAddresses();
if (!trader) throw Error('Three unlocked local Anvil accounts required');
const wallet = (account: Address) => createWalletClient({account, chain: foundry, transport: http(url)});
const txs: {step:string;hash:Hash}[] = [];
async function mined(step: string, hash: Hash) {
  const receipt = await publicClient.waitForTransactionReceipt({hash});
  assert.equal(receipt.status, 'success', step);
  txs.push({step, hash});
  return receipt;
}
async function deploy(name: string, abi: Abi, args: readonly unknown[]) {
  const artifact = JSON.parse(await readFile(`out/${name}.sol/${name}.json`, 'utf8'));
  const receipt = await mined(`deploy ${name}`, await wallet(admin).deployContract({abi, bytecode: artifact.bytecode.object, args}));
  assert.ok(receipt.contractAddress);
  return receipt.contractAddress;
}
const id = keccak256(stringToHex('DEVELOPMENT:ETH-USD'));
const token = await deploy('DevelopmentAsset', DevelopmentAssetAbi, []);
const oracle = await deploy('DevelopmentPriceSource', DevelopmentPriceSourceAbi, [id, admin]);
const config = {
  depositCap: assetUnits('1000000',6), maxPosition:assetUnits('10000',6), maxExposure:assetUnits('100000',6), minCollateral:assetUnits('1',6),
  maxLeverageBps:50000, maintenanceBps:500, profitCapBps:2000, maxUtilizationBps:8000, priceMaxAge:300, positionDuration:3600, refundDelay:3600,
};
const vault = await deploy('MarketVault', MarketVaultAbi, [token, oracle, id, admin, config]);
const mint = async (receiver: Address, amount: bigint) => mined('mint development collateral', await wallet(admin).writeContract({address:token,abi:DevelopmentAssetAbi,functionName:'mint',args:[receiver,amount]}));
const publish = async (price: bigint) => mined('publish development quote', await wallet(admin).writeContract({address:oracle,abi:DevelopmentPriceSourceAbi,functionName:'publish',args:[price,(await publicClient.getBlock()).timestamp]}));
await publish(2_000n * 10n ** 8n);
await mint(lp, assetUnits('10000',6));
await mint(trader, assetUnits('1000',6));
const provider = marketClient(publicClient, wallet(lp), vault);
const trading = marketClient(publicClient, wallet(trader), vault);
const approval = await provider.approveAsset(assetUnits('10000',6));
txs.push({step:'LP approval via SDK',hash:approval.transactionHash});
const deposit = await provider.deposit(assetUnits('10000',6), lp);
txs.push({step:'LP deposit via SDK',hash:deposit.transactionHash});
const traderApproval = await trading.approveAsset(assetUnits('1000',6));
txs.push({step:'trader approval via SDK',hash:traderApproval.transactionHash});
const opened = await trading.open(assetUnits('1000',6), 50000, true);
txs.push({step:'open long via SDK',hash:opened.receipt.transactionHash});
const openState = await provider.snapshot(lp);
assert.equal(openState.escrow, assetUnits('1000',6));
assert.equal(openState.reserve, assetUnits('1000',6));
assert.equal(openState.assets, assetUnits('10000',6));
await assert.rejects(() => provider.redeem(openState.shares, lp, lp), /ERC4626ExceededMaxRedeem/);
await assert.rejects(() => provider.close(opened.id), /NotTrader/);
assert.equal((await provider.snapshot(lp)).count, 1n);
await publish(2_200n * 10n ** 8n);
const closed = await trading.close(opened.id);
txs.push({step:'close long via SDK',hash:closed.transactionHash});
const settled = await trading.snapshot(trader);
assert.equal(settled.claim, assetUnits('1500',6));
assert.equal(settled.assets, assetUnits('9500',6));
assert.equal(settled.count, 0n);
const claim = await trading.withdrawClaim(trader);
txs.push({step:'trader withdraws claim via SDK',hash:claim.transactionHash});
const lpState = await provider.snapshot(lp);
const redemption = await provider.redeem(lpState.shares, lp, lp);
txs.push({step:'LP redemption via SDK',hash:redemption.transactionHash});
const balance = (owner: Address) => publicClient.readContract({address:token,abi:DevelopmentAssetAbi,functionName:'balanceOf',args:[owner]});
const [lpBalance,traderBalance,vaultBalance] = await Promise.all([balance(lp),balance(trader),balance(vault)]);
assert.equal(lpBalance + traderBalance + vaultBalance, assetUnits('11000',6));
assert.equal(traderBalance, assetUnits('1500',6));
assert.ok(lpBalance >= assetUnits('9500',6) - 1n);
const final = await provider.snapshot(lp);
assert.equal(final.shares, 0n);
assert.equal(final.escrow + final.reserve + final.totalClaims + final.exposure + final.count, 0n);
const result = {mode:'local-chain integration',chainId:31337, token,oracle,vault,admin,lp,trader,positionId:opened.id,lpBalance,traderBalance,vaultBalance,final,transactions:txs};
await writeFile('docs/local-journey.json', JSON.stringify(result,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');
console.log(JSON.stringify({result:'PASS',chainId:31337,positionId:String(opened.id),lpBalance:String(lpBalance),traderBalance:String(traderBalance),vaultBalance:String(vaultBalance),vault}));
