'use client';
import {useAccount,useBalance,useConnect,useDisconnect,useSwitchChain,type Connector} from 'wagmi';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogTrigger} from '@/components/ui/dialog';
import {Wallet,Copy,Check,ArrowUpRight} from 'lucide-react';
import {useEffect,useState} from 'react';
import {formatEther} from 'viem';
import {robinhood} from './providers';
import {Btn,Tag} from './ui';

type WalletChoice={name:string;connector?:Connector;icon?:string;install?:string;hint?:string};
const installs={MetaMask:'https://metamask.io/download/',Rabby:'https://rabby.io/'};
function safeIcon(icon?:string){return icon&&(/^(data:image\/(png|jpeg|webp|gif|svg\+xml);base64,)/i.test(icon)||/^https:\/\//i.test(icon))?icon:undefined}
function Logo({choice}:{choice:WalletChoice}){
 const [failed,setFailed]=useState(false);
 const brand=choice.name==='MetaMask'?'metamask':choice.name==='Coinbase Wallet'?'coinbase':choice.name==='Rabby'?'rabby':choice.name==='WalletConnect'?'walletconnect':undefined;
 const src=brand?`/wallets/${brand}.svg`:safeIcon(choice.icon);
 return <span className={`wallet-logo ${brand||''}`} aria-hidden="true">{src&&!failed?<img src={src} alt="" width="29" height="29" onError={()=>setFailed(true)}/>:<Wallet size={24}/>}</span>
}
function WalletOptions(){
 const {connect,connectors,error,isPending,variables}=useConnect();
 const [available,setAvailable]=useState<Record<string,boolean>>({});
 useEffect(()=>{let active=true;Promise.all(connectors.map(async c=>{try{return [c.uid,!!(await c.getProvider())] as const}catch{return [c.uid,false] as const}})).then(entries=>{if(active)setAvailable(Object.fromEntries(entries))});return()=>{active=false}},[connectors]);
 const byName=(name:string)=>connectors.find(c=>c.name.toLowerCase().includes(name.toLowerCase()));
 const metaMask=byName('MetaMask')||connectors.find(c=>c.name==='Injected'&&available[c.uid]&&typeof window!=='undefined'&&!!(window as Window&{ethereum?:{isMetaMask?:boolean;isRabby?:boolean}}).ethereum?.isMetaMask&&!(window as Window&{ethereum?:{isRabby?:boolean}}).ethereum?.isRabby);
 const rabby=byName('Rabby')||connectors.find(c=>c.name==='Injected'&&available[c.uid]&&typeof window!=='undefined'&&!!(window as Window&{ethereum?:{isRabby?:boolean}}).ethereum?.isRabby);
 const coinbase=byName('Coinbase');
 const walletconnect=byName('WalletConnect');
 const known=new Set([metaMask?.uid,rabby?.uid,coinbase?.uid,walletconnect?.uid]);
 const others=connectors.filter(c=>!known.has(c.uid)&&available[c.uid]);
 const choices:WalletChoice[]=[
  {name:'MetaMask',connector:metaMask&&available[metaMask.uid]?metaMask:undefined,icon:metaMask?.icon,install:installs.MetaMask,hint:'Browser extension'},
  {name:'Coinbase Wallet',connector:coinbase,icon:coinbase?.icon,hint:'Extension or mobile'},
  {name:'Rabby',connector:rabby&&available[rabby.uid]?rabby:undefined,icon:rabby?.icon,install:installs.Rabby,hint:'Browser extension'},
  ...(walletconnect?[{name:'WalletConnect',connector:walletconnect,icon:walletconnect.icon,hint:'Scan with a wallet app'}]:[]),
  ...others.map(c=>({name:c.name==='Injected'?'Browser wallet':c.name,connector:c,icon:c.icon,hint:'Detected in this browser'}))
 ];
 return <><p className="wallet-intro">Choose a wallet to view your address and real testnet balance. The demo works without a wallet.</p><div className="wallet-options" role="group" aria-label="Wallet connection options">{choices.map(choice=><div className="wallet-option" key={choice.name}><Logo choice={choice}/><div className="wallet-option-copy"><strong>{choice.name}</strong><span>{choice.connector?choice.hint:'Not installed'}</span></div>{choice.connector?<button type="button" disabled={isPending} onClick={()=>{connect({connector:choice.connector!})}} aria-label={`Connect ${choice.name}`}>{isPending&&variables?.connector===choice.connector?'Connecting…':'Connect'}</button>:choice.install?<a href={choice.install} target="_blank" rel="noopener noreferrer" aria-label={`Install ${choice.name} (opens new tab)`}>Install <ArrowUpRight size={14}/></a>:null}</div>)}</div>{error&&<p className="error" role="alert">The connection was not completed. Choose a wallet to retry.</p>}</>
}
export function WalletDetails(){const {address,chainId,isConnected}=useAccount();const {disconnect}=useDisconnect();const {switchChain,isPending:switching,error:switchError}=useSwitchChain();const balance=useBalance({address,chainId:robinhood.id,query:{enabled:!!address&&chainId===robinhood.id,refetchInterval:30000}});const [copied,setCopied]=useState(false);
return <div className="wallet-details">{isConnected?<><Tag tone="cyan">Wallet connected</Tag><p className="wallet-address">{address}</p><div className="kv"><span>Actual network</span><strong>{chainId===robinhood.id?'Robinhood Testnet':`Chain ${chainId}`}</strong></div>{chainId===robinhood.id?<><div className="kv"><span>Real native balance</span><strong>{balance.isPending?'Reading…':balance.error?'Unavailable':balance.data?`${Number(formatEther(balance.data.value)).toFixed(6)} ETH`:'Unavailable'}</strong></div><p className="meta">Onchain read · Robinhood Chain Testnet{balance.dataUpdatedAt?` · ${new Date(balance.dataUpdatedAt).toLocaleTimeString()} local time`:''}</p>{balance.error&&<Btn secondary onClick={()=>balance.refetch()}>Retry balance</Btn>}</>:<><p className="notice">Your wallet is on a different network. The demo is still available.</p><Btn onClick={()=>switchChain({chainId:robinhood.id})} disabled={switching}>{switching?'Waiting for wallet…':'Switch to Robinhood Testnet'}</Btn></>}{switchError&&<p className="error" role="alert">Network switch was not completed. Your actual network is still shown above.</p>}<div className="dialog-actions"><Btn secondary onClick={async()=>{if(address)try{await navigator.clipboard.writeText(address);setCopied(true)}catch{setCopied(false)}}}>{copied?<Check/>:<Copy/>}{copied?'Copied':'Copy address'}</Btn><Btn secondary onClick={()=>disconnect()}>Disconnect</Btn></div></>:<WalletOptions/>}<p className="meta">Connecting only requests account access. Demo actions do not ask for a signature or transaction.</p></div>}
export default function WalletButton(){const {address,isConnected}=useAccount();return <Dialog><DialogTrigger asChild><Btn secondary className="wallet-button"><Wallet size={16}/><span>{isConnected?`${address?.slice(0,6)}…${address?.slice(-4)}`:'Connect Wallet'}</span></Btn></DialogTrigger><DialogContent className="dv-dialog"><DialogTitle className="dialog-heading">{isConnected?'Your wallet':'Connect Wallet'}</DialogTitle><DialogDescription>Real wallet information, separate from your simulated portfolio.</DialogDescription><WalletDetails/></DialogContent></Dialog>}
