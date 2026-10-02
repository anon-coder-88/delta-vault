import 'dotenv/config';
import {readFileSync} from 'node:fs';
import {createPublicClient,createWalletClient,http,parseUnits,defineChain,type PublicClient,type WalletClient} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {hardhat} from 'viem/chains';
import {DeltaVaultClient,parseDeployment,marketId,type Action} from '../sdk/index.js';

const deployment=parseDeployment(JSON.parse(readFileSync('deployments/current.json','utf8')));
const chain=deployment.chainId===31337?hardhat:defineChain({id:46630,name:'Robinhood Chain Testnet',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:['https://rpc.testnet.chain.robinhood.com']}}});
const transport=http(process.env.RH_RPC_URL||chain.rpcUrls.default.http[0]);
const publicClient=createPublicClient({chain,transport});
const [command='status',value='100',extra='2',direction='long']=process.argv.slice(2);
const key=process.env.RH_PRIVATE_KEY;
if(command!=='status'&&command!=='position'&&!key)throw Error('A disposable test key is required in the ignored .env for writes');
const account=key?privateKeyToAccount(key as `0x${string}`):undefined;
const wallet=account?createWalletClient({chain,transport,account}):undefined;
const client=new DeltaVaultClient(deployment,publicClient as PublicClient,wallet as WalletClient|undefined);
const address=account?.address||process.env.ACCOUNT_ADDRESS as `0x${string}`|undefined;
const name=process.env.MARKET||'BTC-USD';if(name!=='BTC-USD'&&name!=='ETH-USD')throw Error('Unsupported MVP market');
const id=marketId(name);
const print=(result:unknown)=>console.log(JSON.stringify(result,(_,v)=>typeof v==='bigint'?v.toString():v,2));
if(command==='position'){print(await client.position(BigInt(value)))}
else if(command==='status'){if(!address)throw Error('Set ACCOUNT_ADDRESS for reads without a key');print(await client.snapshot(id,address))}
else{
 if(!['faucet','approve','deposit','withdraw','openPosition','closePosition','liquidate'].includes(command))throw Error('Unknown action');
 const action=command as Action;
 let args:readonly unknown[]=[];
 if(action==='approve')args=[deployment.vault,parseUnits(value,6)];
 if(action==='deposit'||action==='withdraw')args=[id,parseUnits(value,6)];
 if(action==='openPosition'){if(!['long','short'].includes(direction))throw Error('Use long or short');args=[id,parseUnits(value,6),Number(extra),direction==='long']}
 if(action==='closePosition'||action==='liquidate')args=[BigInt(value)];
 const result=await client.transact(action,account!.address,args,(phase,hash)=>console.log(phase,hash||''));
 print({transactionHash:result.receipt.transactionHash,positionId:result.openedId});
}
