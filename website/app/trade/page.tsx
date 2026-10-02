import ExecutionView from '@/components/deltavault/onchain/execution-view';
import Trade from '@/components/deltavault/trade';
export const metadata={title:'Trading demo'};
export default function Page(){return <ExecutionView section="trade"><Trade/></ExecutionView>}
