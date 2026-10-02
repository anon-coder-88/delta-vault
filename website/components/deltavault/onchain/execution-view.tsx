'use client';
import {useState,type ReactNode} from 'react';
import OnchainTerminal from './terminal';
export default function ExecutionView({children,section='all',market}:{children:ReactNode;section?:'all'|'trade'|'vaults'|'portfolio';market?:'BTC-USD'|'ETH-USD'}){
 const [mode,setMode]=useState<'demo'|'contract'>('contract');
 return <><div className="wrap execution-switch" role="group" aria-label="Execution mode"><button aria-pressed={mode==='contract'} onClick={()=>setMode('contract')}>Testnet contracts</button><button aria-pressed={mode==='demo'} onClick={()=>setMode('demo')}>Simulated demo</button></div>{mode==='contract'?<OnchainTerminal section={section} initialMarket={market}/>:children}</>;
}
