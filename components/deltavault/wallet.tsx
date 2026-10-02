'use client';
import {useAccount,useBalance,useConnect,useDisconnect,useSwitchChain,type Connector} from 'wagmi';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogTrigger} from '@/components/ui/dialog';
import {Wallet,Copy,Check,ArrowUpRight,ArrowRight} from 'lucide-react';
import {useEffect,useState} from 'react';
import {formatEther} from 'viem';
import {robinhood} from './providers';
import {Btn,Tag} from './ui';

type WalletChoice={name:string;brand?:string;connector?:Connector;icon?:string;install?:string;hint?:string};
const walletBrands=[
 {name:'MetaMask',brand:'metamask',match:/metamask/i,install:'https://metamask.io/download/',flags:['isMetaMask']},
 {name:'Rabby',brand:'rabby',match:/rabby/i,install:'https://rabby.io/',flags:['isRabby']},
 {name:'Coinbase Wallet',brand:'coinbase',match:/coinbase/i,install:'https://www.coinbase.com/wallet/downloads',flags:['isCoinbaseWallet']},
 {name:'Phantom',brand:'phantom',match:/phantom/i,install:'https://phantom.com/download',flags:['isPhantom']},
 {name:'Trust Wallet',brand:'trust',match:/trust/i,install:'https://trustwallet.com/download',flags:['isTrust','isTrustWallet']},
 {name:'OKX Wallet',brand:'okx',match:/okx|okex/i,install:'https://web3.okx.com/download',flags:['isOkxWallet','isOKExWallet']},
 {name:'Brave Wallet',brand:'brave',match:/brave/i,install:'https://brave.com/wallet/',flags:['isBraveWallet']},
];
function safeIcon(icon?:string){return icon&&(/^(data:image\/(png|jpeg|webp|gif|svg\+xml);base64,)/i.test(icon)||/^https:\/\//i.test(icon))?icon:undefined}
function Logo({choice}:{choice:WalletChoice}){
 const [failed,setFailed]=useState(false);
 const brand=choice.brand;
 const src=brand?`/wallets/${brand}.svg`:safeIcon(choice.icon);
 return <span className={`wallet-logo ${brand||''}`} aria-hidden="true">{src&&!failed?<img src={src} alt="" width="29" height="29" onError={()=>setFailed(true)}/>:<Wallet size={24}/>}</span>
}
function WalletOptions(){
 const {connect,connectors,error,isPending,variables}=useConnect();
 const [available,setAvailable]=useState<Record<string,boolean>>({});
 const [flags,setFlags]=useState<Record<string,boolean>>({});
 useEffect(()=>{let active=true;Promise.all(connectors.map(async c=>{try{const provider=await c.getProvider();return {uid:c.uid,provider}}catch{return {uid:c.uid,provider:undefined}}})).then(entries=>{if(!active)return;setAvailable(Object.fromEntries(entries.map(e=>[e.uid,!!e.provider])));const injected=entries.find(e=>connectors.find(c=>c.uid===e.uid)?.name==='Injected')?.provider as Record<string,boolean>|undefined;setFlags(Object.fromEntries(walletBrands.flatMap(b=>b.flags.map(f=>[f,!!injected?.[f]]))))});return()=>{active=false}},[connectors]);
 const used=new Set<string>();
 const choices:WalletChoice[]=walletBrands.map(brand=>{
  const named=connectors.find(c=>brand.match.test(`${c.id} ${c.name}`)&&available[c.uid]);
  const fallback=connectors.find(c=>c.name==='Injected'&&available[c.uid]&&brand.flags.some(f=>flags[f])&&(brand.brand!=='metamask'||!flags.isRabby&&!flags.isPhantom&&!flags.isBraveWallet));
  const connector=named||fallback;
  if(connector)used.add(connector.uid);
  return {...brand,connector,icon:connector?.icon,hint:'Browser wallet'};
 });
 const walletconnect=connectors.find(c=>/walletconnect/i.test(c.name));
 if(walletconnect){used.add(walletconnect.uid);choices.push({name:'WalletConnect',brand:'walletconnect',connector:walletconnect,hint:'Scan with a wallet app'})}
 choices.push(...connectors.filter(c=>!used.has(c.uid)&&available[c.uid]).map(c=>({name:c.name==='Injected'?'Other browser wallet':c.name,connector:c,icon:c.icon,hint:'Browser wallet'})));
 return <><div className="wallet-options" role="group" aria-label="Wallet connection options"><span className="wallet-choices-label">Choose a wallet</span>{choices.map(choice=>{
  const contents=<><Logo choice={choice}/><span className="wallet-option-copy"><strong>{choice.name}</strong><small>{choice.connector?choice.hint:'Get wallet'}</small></span>{choice.connector?<ArrowRight size={18} className="wallet-provider-arrow"/>:<ArrowUpRight size={18} className="wallet-provider-arrow"/>}</>;
  return choice.connector?<button className="wallet-provider" key={choice.name} type="button" disabled={isPending} onClick={()=>connect({connector:choice.connector!})} aria-label={`Connect ${choice.name}`}>{contents}</button>:<a className="wallet-provider" key={choice.name} href={choice.install} target="_blank" rel="noopener noreferrer" aria-label={`Get ${choice.name} (opens in a new tab)`}>{contents}</a>
 })}</div>{isPending&&<p className="wallet-intro" role="status">Waiting for {variables?.connector.name||'your wallet'}…</p>}{!Object.values(available).some(Boolean)&&<p className="wallet-intro">No browser wallet detected. Choose a wallet above to install it, then return here or open DeltaVault in its wallet browser.</p>}{error&&<p className="error" role="alert">The connection was not completed. Choose a wallet to retry.</p>}</>
}
export function WalletDetails(){const {address,chainId,isConnected}=useAccount();const {disconnect}=useDisconnect();const {switchChain,isPending:switching,error:switchError}=useSwitchChain();const balance=useBalance({address,chainId:robinhood.id,query:{enabled:!!address&&chainId===robinhood.id,refetchInterval:30000}});const [copied,setCopied]=useState(false);
return <div className="wallet-details">{isConnected?<><Tag tone="cyan">Wallet connected</Tag><p className="wallet-address">{address}</p><div className="kv"><span>Actual network</span><strong>{chainId===robinhood.id?'Robinhood Testnet':`Chain ${chainId}`}</strong></div>{chainId===robinhood.id?<><div className="kv"><span>Real native balance</span><strong>{balance.isPending?'Reading…':balance.error?'Unavailable':balance.data?`${Number(formatEther(balance.data.value)).toFixed(6)} ETH`:'Unavailable'}</strong></div><p className="meta">Onchain read · Robinhood Chain Testnet{balance.dataUpdatedAt?` · ${new Date(balance.dataUpdatedAt).toLocaleTimeString()} local time`:''}</p>{balance.error&&<Btn secondary onClick={()=>balance.refetch()}>Retry balance</Btn>}</>:<><p className="notice">Your wallet is on a different network. The demo is still available.</p><Btn onClick={()=>switchChain({chainId:robinhood.id})} disabled={switching}>{switching?'Waiting for wallet…':'Switch to Robinhood Testnet'}</Btn></>}{switchError&&<p className="error" role="alert">Network switch was not completed. Your actual network is still shown above.</p>}<div className="dialog-actions"><Btn secondary onClick={async()=>{if(address)try{await navigator.clipboard.writeText(address);setCopied(true)}catch{setCopied(false)}}}>{copied?<Check/>:<Copy/>}{copied?'Copied':'Copy address'}</Btn><Btn secondary onClick={()=>disconnect()}>Disconnect</Btn></div></>:<WalletOptions/>}<p className="meta">Connecting only requests account access. Demo actions do not ask for a signature or transaction.</p></div>}
export default function WalletButton(){const {address,isConnected}=useAccount();return <Dialog><DialogTrigger asChild><Btn secondary className="wallet-button"><Wallet size={16}/><span>{isConnected?`${address?.slice(0,6)}…${address?.slice(-4)}`:'Connect Wallet'}</span></Btn></DialogTrigger><DialogContent className="dv-dialog"><DialogTitle className="dialog-heading">{isConnected?'Your wallet':'Connect your wallet'}</DialogTitle><DialogDescription>{isConnected?'Read your public wallet information.':'Choose a compatible wallet to connect to DeltaVault.'}</DialogDescription><WalletDetails/></DialogContent></Dialog>}
