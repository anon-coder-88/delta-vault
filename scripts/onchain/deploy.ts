import {network} from 'hardhat';
import {keccak256,toUtf8Bytes,parseUnits} from 'ethers';

const {ethers}=await network.create();
const chain=await ethers.provider.getNetwork();
if(chain.chainId!==46630n&&chain.chainId!==31337n)throw Error('Use Robinhood testnet or local Hardhat only');
const [deployer]=await ethers.getSigners();
const token=await ethers.deployContract('MockUSD');
await token.waitForDeployment();
const vault=await ethers.deployContract('DeltaVaultMVP',[await token.getAddress(),deployer.address]);
await vault.waitForDeployment();
const btc=keccak256(toUtf8Bytes('BTC-USD'));
const eth=keccak256(toUtf8Bytes('ETH-USD'));
await (await vault.createMarket(btc,parseUnits('60000',8))).wait();
await (await vault.createMarket(eth,parseUnits('3000',8))).wait();
console.log(JSON.stringify({chainId:Number(chain.chainId),token:await token.getAddress(),vault:await vault.getAddress(),markets:{'BTC-USD':btc,'ETH-USD':eth}},null,2));
console.log('Set NEXT_PUBLIC_TEST_TOKEN_ADDRESS and NEXT_PUBLIC_DELTAVAULT_ADDRESS in .env. No private key belongs in client variables.');
