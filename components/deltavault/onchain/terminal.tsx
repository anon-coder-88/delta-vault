'use client';
import {useMemo,useState} from 'react';
import {useAccount,useReadContract,useSwitchChain,useWaitForTransactionReceipt,useWriteContract} from 'wagmi';
import {formatUnits,isAddress,keccak256,parseAbi,parseUnits,toHex,type Address} from 'viem';
import {Btn,Tag} from '../ui';

const CHAIN=46630;
const ZERO='0x0000000000000000000000000000000000000000' as Address;
const vaultAbi=parseAbi([
 'function markets(bytes32) view returns (uint256 liquidity,uint256 totalShares,uint256 reserved,uint256 price,uint64 updatedAt,bool enabled)',
 'function shares(bytes32,address) view returns (uint256)',
 'function positions(uint256) view returns (address trader,bytes32 marketId,uint256 collateralAmount,uint256 notional,uint256 entryPrice,bool isLong,bool active)',
 'function deposit(bytes32,uint256) returns (uint256)',
 'function withdraw(bytes32,uint256) returns (uint256)',
 'function openPosition(bytes32,uint256,uint8,bool) returns (uint256)',
 'function closePosition(uint256)',
 'function liquidate(uint256)',
 'function nextPositionId() view returns (uint256)'
]);
const tokenAbi=parseAbi([
 'function balanceOf(address) view returns (uint256)',
 'function allowance(address,address) view returns (uint256)',
 'function approve(address,uint256) returns (bool)',
 'function faucet()'
]);
const vaultAddress=process.env.NEXT_PUBLIC_DELTAVAULT_ADDRESS;
const tokenAddress=process.env.NEXT_PUBLIC_TEST_TOKEN_ADDRESS;
const configured=!!vaultAddress&&!!tokenAddress&&isAddress(vaultAddress)&&isAddress(tokenAddress);
const vault=(configured?vaultAddress:ZERO) as Address;
const token=(configured?tokenAddress:ZERO) as Address;
const usd=(v?:bigint)=>v===undefined?'—':`${Number(formatUnits(v,6)).toLocaleString(undefined,{maximumFractionDigits:4})} dvUSD`;

export default function OnchainTerminal(){
 const {address,isConnected,chainId}=useAccount();
 const {switchChain,isPending:switching}=useSwitchChain();
 const {writeContract,data:hash,isPending,error:writeError}=useWriteContract();
 const receipt=useWaitForTransactionReceipt({hash});
 const [marketName,setMarketName]=useState<'BTC-USD'|'ETH-USD'>('BTC-USD');
 const [amount,setAmount]=useState('100');
 const [leverage,setLeverage]=useState(2);
 const [positionId,setPositionId]=useState('1');
 const [message,setMessage]=useState('');
 const marketId=useMemo(()=>keccak256(toHex(marketName)),[marketName]);
 const enabled=configured&&isConnected&&chainId===CHAIN;
 const query={enabled,refetchInterval:10000};
 const market=useReadContract({address:vault,abi:vaultAbi,functionName:'markets',args:[marketId],chainId:CHAIN,query});
 const shares=useReadContract({address:vault,abi:vaultAbi,functionName:'shares',args:[marketId,address||ZERO],chainId:CHAIN,query});
 const balance=useReadContract({address:token,abi:tokenAbi,functionName:'balanceOf',args:[address||ZERO],chainId:CHAIN,query});
 const allowance=useReadContract({address:token,abi:tokenAbi,functionName:'allowance',args:[address||ZERO,vault],chainId:CHAIN,query});
 const nextId=useReadContract({address:vault,abi:vaultAbi,functionName:'nextPositionId',chainId:CHAIN,query});
 const selectedId=/^[1-9]\d*$/.test(positionId)?BigInt(positionId):0n;
 const position=useReadContract({address:vault,abi:vaultAbi,functionName:'positions',args:[selectedId],chainId:CHAIN,query:{...query,enabled:enabled&&selectedId>0n}});
 let raw=0n;let inputError='';try{raw=parseUnits(amount,6);if(raw<=0n||raw>parseUnits('1000000',6))inputError='Enter an amount from 0.000001 to 1,000,000.'}catch{inputError='Enter a valid amount with up to six decimal places.'}
 const ready=enabled&&!isPending&&!receipt.isLoading&&!inputError;
 const action=(name:string,run:()=>void)=>{setMessage(name);run()};
 const approve=()=>action('Confirm approval in your wallet',()=>writeContract({address:token,abi:tokenAbi,functionName:'approve',args:[vault,raw],chainId:CHAIN}));
 const execute=(fn:'deposit'|'withdraw'|'openPosition'|'closePosition'|'faucet',args:readonly unknown[]=[])=>{
  setMessage(`Confirm ${fn} in your wallet`);
  if(fn==='faucet')writeContract({address:token,abi:tokenAbi,functionName:'faucet',chainId:CHAIN});
  else if(fn==='closePosition')writeContract({address:vault,abi:vaultAbi,functionName:'closePosition',args:[selectedId],chainId:CHAIN});
  else if(fn==='deposit')writeContract({address:vault,abi:vaultAbi,functionName:'deposit',args:[marketId,raw],chainId:CHAIN});
  else if(fn==='withdraw')writeContract({address:vault,abi:vaultAbi,functionName:'withdraw',args:[marketId,raw],chainId:CHAIN});
  else writeContract({address:vault,abi:vaultAbi,functionName:'openPosition',args:args as [typeof marketId,bigint,number,boolean],chainId:CHAIN});
 };
 const needsApproval=(allowance.data??0n)<raw;
 const positionOwned=position.data?.[6]&&position.data[0].toLowerCase()===address?.toLowerCase();
 return <div className="wrap onchain-page"><div className="page-head"><div><span className="eyebrow">ROBINHOOD TESTNET / MVP UTILITY</span><h1>Onchain sandbox.</h1><p>Use test dvUSD to supply a market vault or open a bounded long or short. Prices are set by the deployer for this test.</p></div><Tag tone="amber">Testnet only</Tag></div>
 <div className="notice">This is a separate experimental contract flow. The existing trading and vault demo remains simulated. The deployer can change test prices; do not use real assets.</div>
 {!configured?<div className="panel onchain-card"><h2>Contract address needed</h2><p>Deploy the MVP to Robinhood testnet, then set NEXT_PUBLIC_DELTAVAULT_ADDRESS and NEXT_PUBLIC_TEST_TOKEN_ADDRESS before starting the website.</p></div>:!isConnected?<div className="panel onchain-card"><h2>Connect a wallet</h2><p>Use Connect Wallet in the navbar to access testnet contract actions.</p></div>:chainId!==CHAIN?<div className="panel onchain-card"><h2>Switch network</h2><p>This contract is available on Robinhood Chain testnet (46630).</p><Btn onClick={()=>switchChain({chainId:CHAIN})} disabled={switching}>{switching?'Switching…':'Switch to testnet'}</Btn></div>:<>
 <div className="onchain-grid"><section className="panel onchain-card"><h2>Market vault</h2><label htmlFor="live-market">Market</label><select id="live-market" value={marketName} onChange={e=>setMarketName(e.target.value as 'BTC-USD'|'ETH-USD')}><option>BTC-USD</option><option>ETH-USD</option></select><div className="kv"><span>Owner-set test price</span><strong>{market.data?Number(formatUnits(market.data[3],8)).toLocaleString():'—'} USD</strong></div><div className="kv"><span>Market liquidity</span><strong>{usd(market.data?.[0])}</strong></div><div className="kv"><span>Reserved exposure</span><strong>{usd(market.data?.[2])}</strong></div><div className="kv"><span>Your vault shares</span><strong>{usd(shares.data)}</strong></div><p className="meta">Price updated {market.data?.[4]?new Date(Number(market.data[4])*1000).toLocaleString():'—'}. Trades require an update within one hour.</p></section>
 <section className="panel onchain-card"><h2>Your test collateral</h2><div className="kv"><span>Wallet balance</span><strong>{usd(balance.data)}</strong></div><label htmlFor="live-amount">Amount or shares · dvUSD (6 decimals)</label><input id="live-amount" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/>{inputError&&<p className="error" role="status">{inputError}</p>}<div className="onchain-actions"><Btn secondary disabled={!enabled||isPending||receipt.isLoading} onClick={()=>execute('faucet')}>Claim test dvUSD</Btn><Btn secondary disabled={!ready} onClick={approve}>Approve {amount}</Btn><Btn disabled={!ready||needsApproval} onClick={()=>execute('deposit')}>Deposit</Btn><Btn secondary disabled={!ready||raw>(shares.data??0n)} onClick={()=>execute('withdraw')}>Withdraw shares</Btn></div>{needsApproval&&<p className="meta">Approve this amount before depositing or opening a position. Wait for confirmation, then select the action.</p>}</section>
 <section className="panel onchain-card"><h2>Open a test position</h2><label htmlFor="live-leverage">Leverage · {leverage}×</label><input id="live-leverage" type="range" min="1" max="5" value={leverage} onChange={e=>setLeverage(Number(e.target.value))}/><div className="onchain-actions"><Btn disabled={!ready||needsApproval} onClick={()=>execute('openPosition',[marketId,raw,leverage,true])}>Open long</Btn><Btn secondary disabled={!ready||needsApproval} onClick={()=>execute('openPosition',[marketId,raw,leverage,false])}>Open short</Btn></div><p className="meta">Maximum profit is capped at position notional; maximum loss is collateral. The contract has no fee or external oracle.</p></section>
 <section className="panel onchain-card"><h2>Close a position</h2><div className="kv"><span>Next position ID</span><strong>{nextId.data?.toString()??'—'}</strong></div><label htmlFor="live-id">Your position ID</label><input id="live-id" inputMode="numeric" value={positionId} onChange={e=>setPositionId(e.target.value)}/><p className="meta">{positionOwned?`${position.data?.[5]?'Long':'Short'} · ${usd(position.data?.[2])} collateral · active`:'Enter an active position ID owned by this wallet.'}</p><Btn disabled={!enabled||!positionOwned||isPending||receipt.isLoading} onClick={()=>execute('closePosition')}>Close position</Btn></section></div>
 {message&&<p className="notice" role="status">{receipt.isSuccess?'Transaction confirmed. Balances refresh automatically.':receipt.isLoading?'Waiting for testnet confirmation…':message}</p>}{writeError&&<p role="alert" className="error">Wallet action failed: {writeError.message}</p>}{receipt.isError&&<p role="alert" className="error">Transaction failed on testnet. Check the explorer and retry.</p>}{hash&&<a className="text-link" target="_blank" rel="noopener noreferrer" href={`https://explorer.testnet.chain.robinhood.com/tx/${hash}`}>View transaction on testnet explorer</a>}
 </>}</div>
}
