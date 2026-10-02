import {test} from 'node:test';
import assert from 'node:assert/strict';
import {network} from 'hardhat';

// Deterministic state-machine test: real transfers and transactions, no mocked ledger.
test('randomized two-market accounting preserves solvency, isolation and terminal states',async()=>{
 const {ethers}=await network.create();
 const [admin,lp,trader,keeper]=await ethers.getSigners();
 const token=await ethers.deployContract('MockUSD');
 const vault=await ethers.deployContract('DeltaVaultMVP',[await token.getAddress(),admin.address]);
 const ids=['BTC-USD','ETH-USD'].map(s=>ethers.keccak256(ethers.toUtf8Bytes(s)));
 for(const a of [lp,trader]){
  await (await token.connect(a).getFunction('faucet')()).wait();
  await (await token.connect(a).getFunction('approve')(await vault.getAddress(),10_000n*10n**6n)).wait();
 }
 for(const id of ids){
  await (await vault.createMarket(id,100n*10n**8n)).wait();
  await (await vault.connect(lp).getFunction('deposit')(id,2_000n*10n**6n)).wait();
 }
 let seed=0xD311A;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>8;};
 const active=new Set<bigint>();
 const check=async()=>{
  let liabilities=0n;
  const reserves=new Map(ids.map(id=>[id,0n]));
  for(const positionId of active){
   const p=await vault.positions(positionId);assert.equal(p.active,true);
   liabilities+=p.collateralAmount;
   reserves.set(p.marketId,reserves.get(p.marketId)!+p.notional);
  }
  for(const id of ids){
   const m=await vault.markets(id);
   assert.equal(m.reserved,reserves.get(id));
   assert.ok(m.reserved<=m.liquidity,'all capped profits remain collateralized');
   assert.equal(await vault.shares(id,lp.address),m.totalShares);
   liabilities+=m.liquidity;
  }
  assert.equal(await token.balanceOf(await vault.getAddress()),liabilities,'token escrow equals LP assets plus posted collateral');
 };
 for(let step=0;step<120;step++){
  const id=ids[random()%2];const action=random()%4;
  if(action===0||active.size===0){
   const collateral=(1n+BigInt(random()%20))*10n**6n;
   const leverage=1+random()%5;const m=await vault.markets(id);
   if(m.reserved+collateral*BigInt(leverage)<=m.liquidity*80n/100n){
    const positionId=await vault.nextPositionId();
    await (await vault.connect(trader).getFunction('openPosition')(id,collateral,leverage,Boolean(random()%2))).wait();active.add(positionId);
   }
  }else if(action===1){
   const price=(10n+BigInt(random()%291))*10n**8n;
   const other=ids.find(x=>x!==id)!;const before=await vault.markets(other);
   await (await vault.setPrice(id,price)).wait();
   assert.deepEqual(Array.from(await vault.markets(other)),Array.from(before),'price update cannot mutate another market');
  }else{
   const positionId=[...active][random()%active.size];const p=await vault.positions(positionId);
   const pnl=await vault.pnl(positionId);
   if(action===3&&pnl<=-(p.collateralAmount*80n/100n)){
    await (await vault.connect(keeper).getFunction('liquidate')(positionId)).wait();
   }else{
    await (await vault.connect(trader).getFunction('closePosition')(positionId)).wait();
   }
   active.delete(positionId);
   await assert.rejects(vault.connect(trader).getFunction('closePosition')(positionId));
  }
  await check();
 }
 for(const positionId of active){await (await vault.connect(trader).getFunction('closePosition')(positionId)).wait();}
 active.clear();await check();
 // Pausing prevents new risk but cannot strand otherwise-unreserved LP funds.
 await (await vault.pause()).wait();
 for(const id of ids){
  await (await vault.connect(lp).getFunction('withdraw')(id,await vault.shares(id,lp.address))).wait();
 }
 assert.equal(await token.balanceOf(await vault.getAddress()),0n);
});
