'use client';
import { createContext,useContext,useEffect,useRef,useState,ReactNode,useCallback } from 'react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { createConfig,http,WagmiProvider } from 'wagmi';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';
import {defineChain} from 'viem';
import {Toaster,toast} from 'sonner';
import {DemoState,Review,initialState,parseState,commit,changeScenario,setPaused,MarketId} from '@/lib/deltavault/engine';
export const robinhood=defineChain({id:46630,name:'Robinhood Chain Testnet',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:['https://rpc.testnet.chain.robinhood.com']}},blockExplorers:{default:{name:'Robinhood Explorer',url:'https://explorer.testnet.chain.robinhood.com'}},testnet:true});
const walletConnectProjectId=process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const config=createConfig({chains:[robinhood],connectors:[injected(),coinbaseWallet({appName:'DeltaVault'}),...(walletConnectProjectId?[walletConnect({projectId:walletConnectProjectId,showQrModal:true})]:[])],transports:{[robinhood.id]:http(undefined,{timeout:9000,retryCount:1})},ssr:true});
const KEY='deltavault-demo-v1';
type Ctx={state:DemoState;ready:boolean;notice:string;confirm:(r:Review)=>void;reset:()=>void;scenario:(id:MarketId,p:string)=>void;pause:(v:boolean)=>void};
const Context=createContext<Ctx|null>(null);
export const useDemo=()=>{const c=useContext(Context);if(!c)throw Error('Demo provider missing');return c};
function DemoProvider({children}:{children:ReactNode}){
 const [state,setState]=useState<DemoState>(initialState),[ready,setReady]=useState(false),[notice,setNotice]=useState('');const ref=useRef(state);const available=useRef(true);
 // Hydrate device-local storage after SSR; this external source cannot be read during server render.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw){try{const saved=parseState(raw);ref.current=saved;setState(saved)}catch{setNotice('Saved demo data could not be restored. A fresh demo is ready; use Reset demo to replace it.');available.current=false}}}catch{available.current=false;setNotice('Session-only demo: this browser does not allow local saving.')}setReady(true)},[]);
 const update=useCallback((next:DemoState)=>{ref.current=next;setState(next);if(available.current)try{localStorage.setItem(KEY,JSON.stringify(next))}catch{available.current=false;setNotice('Session-only demo: your latest changes could not be saved.')}},[]);
 const confirm=useCallback((r:Review)=>{const next=commit(ref.current,r);if(next!==ref.current){update(next);toast.success(r.action.kind==='open'?'Simulated position opened':r.action.kind==='close'?'Simulated position closed':r.action.kind==='deposit'?'Simulated deposit complete':'Simulated withdrawal complete')}},[update]);
 const reset=useCallback(()=>{available.current=true;setNotice('');update(initialState());toast.success('Demo reset to 10,000 USD')},[update]);
 const scenario=useCallback((id:MarketId,p:string)=>{const before=ref.current.positions.filter(p=>p.status==='Liquidated').length;const next=changeScenario(ref.current,id,p);update(next);const count=next.positions.filter(p=>p.status==='Liquidated').length-before;if(count)toast.warning(`${count} simulated position${count>1?'s':''} liquidated`)},[update]);
 const pause=useCallback((v:boolean)=>update(setPaused(ref.current,v)),[update]);
 useEffect(()=>{const ctx=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:unknown)=>Promise<void>}}).modelContext;if(!ctx?.registerTool)return;const lifecycle=new AbortController();Promise.resolve(ctx.registerTool({name:'read_demo_portfolio',title:'Read demo portfolio',description:'Read device-local simulated balances, positions and vault holdings. No wallet or financial writes.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:(input:unknown)=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('Expected an empty object');const s=ref.current;return {mode:'demo',cash:s.cash,positions:s.positions,holdings:s.holdings,revision:s.revision}}},{signal:lifecycle.signal})).catch(()=>{});return()=>lifecycle.abort()},[]);
 return <Context.Provider value={{state,ready,notice,confirm,reset,scenario,pause}}>{children}</Context.Provider>
}
export default function Providers({children}:{children:ReactNode}){const [query]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:1,staleTime:30000,refetchOnWindowFocus:false}}}));return <WagmiProvider config={config}><QueryClientProvider client={query}><DemoProvider>{children}</DemoProvider><Toaster theme="dark" position="bottom-right" toastOptions={{style:{background:'#102838',border:'1px solid #607E8B',color:'#F3F7F8'}}}/></QueryClientProvider></WagmiProvider>}
