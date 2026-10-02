import ExecutionView from '@/components/deltavault/onchain/execution-view';
import Portfolio from '@/components/deltavault/portfolio';
export const metadata={title:'Your portfolio'};
export default function Page(){return <ExecutionView section="portfolio"><Portfolio/></ExecutionView>}
