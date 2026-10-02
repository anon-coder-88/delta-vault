import type {HardhatUserConfig} from 'hardhat/config';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatNodeTestRunner from '@nomicfoundation/hardhat-node-test-runner';
import 'dotenv/config';

const key=process.env.RH_PRIVATE_KEY;
const config:HardhatUserConfig={
 plugins:[hardhatEthers,hardhatNodeTestRunner],
 solidity:{version:'0.8.24',settings:{optimizer:{enabled:true,runs:200}}},
 networks:{
  hardhatMainnet:{type:'edr-simulated',chainType:'l1'},
  localhost:{type:'http',chainType:'l1',url:'http://127.0.0.1:8545',chainId:31337},
  robinhoodTestnet:{type:'http',chainType:'generic',url:process.env.RH_RPC_URL||'https://rpc.testnet.chain.robinhood.com',chainId:46630,accounts:key?[key]:[]}
 }
};
export default config;
