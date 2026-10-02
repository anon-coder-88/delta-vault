import {test} from 'node:test';
import assert from 'node:assert/strict';
import {network} from 'hardhat';
import {createPublicClient,createWalletClient,custom,type PublicClient,type WalletClient} from 'viem';
import {hardhat} from 'viem/chains';
import {DeltaVaultClient,parseDeployment,marketId,type Phase} from '../sdk/index.js';

test('deployment validation rejects unsupported networks and zero addresses',()=>{
 assert.throws(()=>parseDeployment({version:1,chainId:1,vault:'0x0000000000000000000000000000000000000001',token:'0x0000000000000000000000000000000000000002'}));
 assert.throws(()=>parseDeployment({version:1,chainId:31337,vault:'0x0000000000000000000000000000000000000000',token:'0x0000000000000000000000000000000000000002'}));
});

test('shared website SDK completes LP and trader journey with receipt-derived position ID',async()=>{
 const {ethers}=await network.create();const [admin,lp,trader]=await ethers.getSigners();
 const token=await ethers.deployContract('MockUSD');await token.waitForDeployment();
 const vault=await ethers.deployContract('DeltaVaultMVP',[await token.getAddress(),admin.address]);await vault.waitForDeployment();
 const id=marketId('BTC-USD');await (await vault.createMarket(id,60_000n*10n**8n)).wait();
 const deployment=parseDeployment({version:1,chainId:31337,token:await token.getAddress(),vault:await vault.getAddress()});
 const transport=custom({request:async({method,params})=>ethers.provider.send(method,(params??[]) as unknown[])});
 const reader=createPublicClient({chain:hardhat,transport}) as PublicClient;
 const make=(address:`0x${string}`)=>new DeltaVaultClient(deployment,reader,createWalletClient({chain:hardhat,transport,account:address}) as WalletClient);
 const lender=make(lp.address as `0x${string}`),buyer=make(trader.address as `0x${string}`);
 const phases:Phase[]=[];
 for(const [client,account] of [[lender,lp.address],[buyer,trader.address]] as const){
  await client.transact('faucet',account as `0x${string}`,[]);
  await client.transact('approve',account as `0x${string}`,[deployment.vault,1_000n*10n**6n]);
 }
 await lender.transact('deposit',lp.address as `0x${string}`,[id,1_000n*10n**6n]);
 const opened=await buyer.transact('openPosition',trader.address as `0x${string}`,[id,100n*10n**6n,3,true],phase=>phases.push(phase));
 assert.deepEqual(phases,['signature','submitted','confirmed']);assert.equal(opened.openedId,1n);
 assert.equal((await buyer.position(1n)).position[6],true);
 assert.equal((await buyer.recentPositions(trader.address as `0x${string}`))[0].id,1n);
 assert.equal((await lender.recentPositions(lp.address as `0x${string}`)).length,0);
 await assert.rejects(buyer.recentPositions(trader.address as `0x${string}`,101));
 await assert.rejects(lender.transact('closePosition',lp.address as `0x${string}`,[1n]));
 await assert.rejects(buyer.transact('deposit',lp.address as `0x${string}`,[id,1n]));
 await (await vault.setPrice(id,66_000n*10n**8n)).wait();
 assert.equal((await buyer.position(1n)).pnl,30n*10n**6n);
 await buyer.transact('closePosition',trader.address as `0x${string}`,[1n]);
 const snapshot=await lender.snapshot(id,lp.address as `0x${string}`);
 assert.equal(snapshot.shareValue,970n*10n**6n);assert.equal(snapshot.market[2],0n);
 await lender.transact('withdraw',lp.address as `0x${string}`,[id,snapshot.shares]);
 assert.equal((await lender.snapshot(id,lp.address as `0x${string}`)).shares,0n);
 assert.equal((await buyer.snapshot(id,trader.address as `0x${string}`)).balance,10_030n*10n**6n);
 await assert.rejects(buyer.transact('closePosition',trader.address as `0x${string}`,[1n]));
});
