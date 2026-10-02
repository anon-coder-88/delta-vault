import {network} from 'hardhat';
import {keccak256,toUtf8Bytes,parseUnits,isAddress} from 'ethers';

const address=process.env.DELTAVAULT_ADDRESS;
const market=process.env.MARKET||'BTC-USD';
const price=process.env.TEST_PRICE;
if(!address||!isAddress(address)||!price)throw Error('Set DELTAVAULT_ADDRESS and TEST_PRICE');
if(!['BTC-USD','ETH-USD'].includes(market))throw Error('Unsupported market');
const {ethers}=await network.create();
const chain=await ethers.provider.getNetwork();
if(chain.chainId!==46630n&&chain.chainId!==31337n)throw Error('Testnet only');
const vault=await ethers.getContractAt('DeltaVaultMVP',address);
const tx=await vault.setPrice(keccak256(toUtf8Bytes(market)),parseUnits(price,8));
await tx.wait();
console.log(`Test price updated: ${market} ${price}; tx ${tx.hash}`);
