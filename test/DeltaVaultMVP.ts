import {test} from 'node:test';
import {network} from 'hardhat';

for(const scenario of ['LongSettlement','ShortSettlement','CapacityAndPause','LiquidationAndOwnership','MarketIsolation','FeeTokenRejection','LensQuotes']){
 test(scenario,async()=>{
  const {ethers}=await network.create();
  const suite=await ethers.deployContract('DeltaVaultScenarioTest');
  await suite.waitForDeployment();
  const args=[];
  if(scenario==='LensQuotes'){
   const lens=await ethers.deployContract('DeltaVaultLens');await lens.waitForDeployment();args.push(await lens.getAddress());
  }
  if(scenario==='FeeTokenRejection'){
   const token=await ethers.deployContract('FeeToken');await token.waitForDeployment();
   await (await token.transfer(await suite.getAddress(),10_000n*10n**6n)).wait();args.push(await token.getAddress());
  }
  await (await suite[`test${scenario}`](...args)).wait();
 });
}

test('stale prices block entries, closes, and liquidation until refreshed',async()=>{
 const {ethers}=await network.create();const [admin,lp,trader]=await ethers.getSigners();
 const token=await ethers.deployContract('MockUSD');await token.waitForDeployment();
 const vault=await ethers.deployContract('DeltaVaultMVP',[await token.getAddress(),admin.address]);await vault.waitForDeployment();
 const market=ethers.keccak256(ethers.toUtf8Bytes('BTC-USD'));
 await (await vault.createMarket(market,60_000n*10n**8n)).wait();
 for(const account of [lp,trader]){await (await token.connect(account).getFunction('faucet')()).wait();await (await token.connect(account).getFunction('approve')(await vault.getAddress(),1_000n*10n**6n)).wait()}
 await (await vault.connect(lp).getFunction('deposit')(market,1_000n*10n**6n)).wait();
 await (await vault.connect(trader).getFunction('openPosition')(market,100n*10n**6n,3,true)).wait();
 await ethers.provider.send('evm_increaseTime',[3601]);await ethers.provider.send('evm_mine',[]);
 const {default:assert}=await import('node:assert/strict');
 await assert.rejects(vault.connect(trader).getFunction('openPosition')(market,10n*10n**6n,1,true));
 await assert.rejects(vault.connect(trader).getFunction('closePosition')(1));await assert.rejects(vault.liquidate(1));
 await assert.rejects(vault.connect(trader).getFunction('setPrice')(market,60_000n*10n**8n));
 await (await vault.setPrice(market,60_000n*10n**8n)).wait();await (await vault.connect(trader).getFunction('closePosition')(1)).wait();
});
