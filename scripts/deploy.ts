import {network} from 'hardhat';
import {keccak256,toUtf8Bytes,parseUnits} from 'ethers';
import {writeFileSync} from 'node:fs';

const {ethers}=await network.create();
const chain=await ethers.provider.getNetwork();
if(![31337n,46630n].includes(chain.chainId))throw Error('Local or Robinhood testnet only');
const [admin]=await ethers.getSigners();
const token=await ethers.deployContract('MockUSD');await token.waitForDeployment();
const vault=await ethers.deployContract('DeltaVaultMVP',[await token.getAddress(),admin.address]);await vault.waitForDeployment();
const lens=await ethers.deployContract('DeltaVaultLens');await lens.waitForDeployment();
const markets={'BTC-USD':keccak256(toUtf8Bytes('BTC-USD')),'ETH-USD':keccak256(toUtf8Bytes('ETH-USD'))};
await (await vault.createMarket(markets['BTC-USD'],parseUnits('60000',8))).wait();
await (await vault.createMarket(markets['ETH-USD'],parseUnits('3000',8))).wait();
const config={chainId:Number(chain.chainId),token:await token.getAddress(),vault:await vault.getAddress(),lens:await lens.getAddress(),markets,
 tokenAbi:JSON.parse(token.interface.formatJson()),vaultAbi:JSON.parse(vault.interface.formatJson()),lensAbi:JSON.parse(lens.interface.formatJson())};
writeFileSync('web/config.json',JSON.stringify(config,null,2));
console.log(JSON.stringify({chainId:config.chainId,token:config.token,vault:config.vault,lens:config.lens,markets},null,2));
console.log('web/config.json contains public addresses and ABIs; no private key.');
