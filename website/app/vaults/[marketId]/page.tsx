import ExecutionView from '@/components/deltavault/onchain/execution-view';
import {VaultDetail} from '@/components/deltavault/vaults';
export function generateStaticParams(){return [{marketId:'btc'},{marketId:'eth'}]}
export const dynamicParams=false;
export const metadata={title:'Vault detail'};
export default async function Page({params}:{params:Promise<{marketId:string}>}){const {marketId}=await params;return <ExecutionView section="vaults" market={marketId==='eth'?'ETH-USD':'BTC-USD'}><VaultDetail id={marketId}/></ExecutionView>}
