import {test} from 'node:test';
import assert from 'node:assert/strict';
import {network} from 'hardhat';
import {keccak256,toUtf8Bytes,parseUnits} from 'ethers';

const BTC=keccak256(toUtf8Bytes('BTC-USD'));
const U=(value:string)=>parseUnits(value,6);
const P=(value:string)=>parseUnits(value,8);

test('market shares, reserved exposure, trade settlement and LP loss',async()=>{
 const {ethers}=await network.create();
 const [admin,lp,trader]=await ethers.getSigners();
 const token=await ethers.deployContract('MockUSD');await token.waitForDeployment();
 const vault=await ethers.deployContract('DeltaVaultMVP',[await token.getAddress(),admin.address]);await vault.waitForDeployment();
 await (await vault.createMarket(BTC,P('60000'))).wait();
 await (await token.connect(lp).faucet()).wait();
 await (await token.connect(trader).faucet()).wait();
 await (await token.connect(lp).approve(await vault.getAddress(),U('1000'))).wait();
 await (await vault.connect(lp).deposit(BTC,U('1000'))).wait();
 assert.equal(await vault.shares(BTC,lp.address),U('1000'));
 await (await token.connect(trader).approve(await vault.getAddress(),U('100'))).wait();
 await (await vault.connect(trader).openPosition(BTC,U('100'),3,true)).wait();
 assert.equal((await vault.markets(BTC)).reserved,U('300'));
 await (await vault.setPrice(BTC,P('66000'))).wait();
 assert.equal(await vault.pnl(1),U('30'));
 await (await vault.connect(trader).closePosition(1)).wait();
 assert.equal(await token.balanceOf(trader.address),U('10030'));
 assert.equal((await vault.markets(BTC)).liquidity,U('970'));
 assert.equal((await vault.markets(BTC)).reserved,0n);
 await (await vault.connect(lp).withdraw(BTC,U('1000'))).wait();
 assert.equal(await token.balanceOf(lp.address),U('9970'));
});

test('capacity, liquidation, and pause guard',async()=>{
 const {ethers}=await network.create();
 const [admin,lp,trader,keeper]=await ethers.getSigners();
 const token=await ethers.deployContract('MockUSD');await token.waitForDeployment();
 const vault=await ethers.deployContract('DeltaVaultMVP',[await token.getAddress(),admin.address]);await vault.waitForDeployment();
 await (await vault.createMarket(BTC,P('60000'))).wait();
 for(const s of [lp,trader])await (await token.connect(s).faucet()).wait();
 await (await token.connect(lp).approve(await vault.getAddress(),U('1000'))).wait();
 await (await vault.connect(lp).deposit(BTC,U('1000'))).wait();
 await (await token.connect(trader).approve(await vault.getAddress(),U('1000'))).wait();
 await assert.rejects(vault.connect(trader).openPosition(BTC,U('200'),5,true));
 await (await vault.connect(trader).openPosition(BTC,U('100'),5,true)).wait();
 await assert.rejects(vault.connect(keeper).liquidate(1));
 await (await vault.setPrice(BTC,P('48000'))).wait();
 await (await vault.connect(keeper).liquidate(1)).wait();
 assert.equal((await vault.positions(1)).active,false);
 assert.equal((await vault.markets(BTC)).liquidity,U('1100'));
 await (await vault.pause()).wait();
 await assert.rejects(vault.connect(trader).openPosition(BTC,U('10'),1,true));
 await (await vault.connect(lp).withdraw(BTC,U('1000'))).wait();
});
