import {getAddress,isAddress,keccak256,toHex,parseAbi,decodeEventLog,type Abi,type Address,type PublicClient,type WalletClient} from 'viem';

export const vaultAbi=parseAbi([
 'function markets(bytes32) view returns (uint256 liquidity,uint256 totalShares,uint256 reserved,uint256 price,uint64 updatedAt,bool enabled)',
 'function shares(bytes32,address) view returns (uint256)',
 'function positions(uint256) view returns (address trader,bytes32 marketId,uint256 collateralAmount,uint256 notional,uint256 entryPrice,bool isLong,bool active)',
 'function paused() view returns (bool)',
 'function pnl(uint256) view returns (int256)',
 'function nextPositionId() view returns (uint256)',
 'function deposit(bytes32,uint256) returns (uint256)',
 'function withdraw(bytes32,uint256) returns (uint256)',
 'function openPosition(bytes32,uint256,uint8,bool) returns (uint256)',
 'function closePosition(uint256)',
 'function liquidate(uint256)',
 'event PositionOpened(uint256 indexed positionId,address indexed trader,bytes32 indexed marketId,bool isLong,uint256 collateralAmount,uint256 notional)',
]);
export const tokenAbi=parseAbi([
 'function balanceOf(address) view returns (uint256)',
 'function allowance(address,address) view returns (uint256)',
 'function approve(address,uint256) returns (bool)',
 'function faucet()'
]);
export type Deployment={version:1;chainId:31337|46630;vault:Address;token:Address;lens?:Address};
export const marketId=(name:'BTC-USD'|'ETH-USD')=>keccak256(toHex(name));
// Deployment files contain public addresses only. Never accept keys or arbitrary chains.
export function parseDeployment(input:unknown):Deployment {
 if(!input||typeof input!=='object')throw Error('Invalid deployment file');
 const d=input as Record<string,unknown>;
 if(d.version!==1||![31337,46630].includes(Number(d.chainId)))throw Error('Only local and Robinhood testnet deployments are supported');
 for(const key of ['vault','token',...(d.lens?['lens']:[])]){
  if(typeof d[key]!=='string'||!isAddress(d[key] as string)||/^0x0{40}$/i.test(d[key] as string))throw Error(`Invalid ${key} address`);
 }
 return {version:1,chainId:Number(d.chainId) as Deployment['chainId'],vault:getAddress(d.vault as string),token:getAddress(d.token as string),...(d.lens?{lens:getAddress(d.lens as string)}:{})};
}
export type Action='approve'|'faucet'|'deposit'|'withdraw'|'openPosition'|'closePosition'|'liquidate';
export type Phase='signature'|'submitted'|'confirmed';
export class DeltaVaultClient {
 constructor(readonly deployment:Deployment,readonly publicClient:PublicClient,readonly walletClient?:WalletClient){}
 async snapshot(id:`0x${string}`,account:Address){
  const {vault,token}=this.deployment;
  if(await this.publicClient.getChainId()!==this.deployment.chainId)throw Error('RPC is on the wrong network');
  const [market,shares,balance,allowance,paused]=await Promise.all([
   this.publicClient.readContract({address:vault,abi:vaultAbi,functionName:'markets',args:[id]}),
   this.publicClient.readContract({address:vault,abi:vaultAbi,functionName:'shares',args:[id,account]}),
   this.publicClient.readContract({address:token,abi:tokenAbi,functionName:'balanceOf',args:[account]}),
   this.publicClient.readContract({address:token,abi:tokenAbi,functionName:'allowance',args:[account,vault]}),
   this.publicClient.readContract({address:vault,abi:vaultAbi,functionName:'paused'})
  ]);
  const capacity=market[0]*80n/100n;
  const latest=await this.publicClient.getBlock();
  return {market,shares,balance,allowance,paused,available:market[0]-market[2],capacity:capacity>market[2]?capacity-market[2]:0n,shareValue:market[1]?shares*market[0]/market[1]:0n,fresh:market[4]>0n&&latest.timestamp-market[4]<=3600n};
 }
 // Bounded enumeration avoids unbounded RPC work; the UI states the history limit.
 async recentPositions(account:Address,limit=30){
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('History limit must be 1–100');
  const next=await this.publicClient.readContract({address:this.deployment.vault,abi:vaultAbi,functionName:'nextPositionId'});
  const start=next>BigInt(limit)?next-BigInt(limit):1n;
  const rows=[];
  for(let first=start;first<next;first+=5n){
   const ids=Array.from({length:Number(next-first<5n?next-first:5n)},(_,i)=>first+BigInt(i));
   const batch=await Promise.all(ids.map(async id=>({id,position:await this.publicClient.readContract({address:this.deployment.vault,abi:vaultAbi,functionName:'positions',args:[id]})})));
   rows.push(...batch.filter(row=>row.position[0].toLowerCase()===account.toLowerCase()));
  }
  return rows.reverse();
 }
 async position(id:bigint){
  const position=await this.publicClient.readContract({address:this.deployment.vault,abi:vaultAbi,functionName:'positions',args:[id]});
  const pnl=position[6]?await this.publicClient.readContract({address:this.deployment.vault,abi:vaultAbi,functionName:'pnl',args:[id]}):0n;
  return {position,pnl,payout:position[6]?position[2]+pnl:0n,liquidatable:position[6]&&pnl<=-(position[2]*80n/100n)};
 }
 async transact(action:Action,account:Address,args:readonly unknown[],onPhase:(phase:Phase,hash?:`0x${string}`)=>void=()=>{}){
  const wallet=this.walletClient;if(!wallet)throw Error('Connect a wallet first');
  if(await wallet.getChainId()!==this.deployment.chainId||await this.publicClient.getChainId()!==this.deployment.chainId)throw Error('Switch to the deployment network');
  const accounts=await wallet.getAddresses();if(!accounts.some(a=>a.toLowerCase()===account.toLowerCase()))throw Error('Wallet account changed; reconnect');
  const tokenAction=action==='approve'||action==='faucet';
  // Simulate every write before asking the wallet to sign. Approvals are explicit and exact.
  const call={address:tokenAction?this.deployment.token:this.deployment.vault,abi:(tokenAction?tokenAbi:vaultAbi) as Abi,functionName:action,args,account};
  const simulation=await this.publicClient.simulateContract(call);
  onPhase('signature');
  const hash=await wallet.writeContract({...simulation.request,account,chain:wallet.chain});onPhase('submitted',hash);
  const receipt=await this.publicClient.waitForTransactionReceipt({hash});
  if(receipt.status!=='success')throw Error('Transaction reverted');
  let openedId:bigint|undefined;
  if(action==='openPosition')for(const log of receipt.logs){
   if(log.address.toLowerCase()!==this.deployment.vault.toLowerCase())continue;
   try{const event=decodeEventLog({abi:vaultAbi,data:log.data,topics:log.topics});if(event.eventName==='PositionOpened')openedId=event.args.positionId}catch{/* Other contract events. */}
  }
  onPhase('confirmed',receipt.transactionHash);return {receipt,openedId};
 }
}
