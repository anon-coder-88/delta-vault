import ExecutionView from '@/components/deltavault/onchain/execution-view';
import Vaults from '@/components/deltavault/vaults';
export const metadata={title:'Market vaults'};
export default function Page(){return <ExecutionView section="vaults"><Vaults/></ExecutionView>}
