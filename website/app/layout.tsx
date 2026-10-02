import type {Metadata} from 'next';
import './globals.css';
import Providers from '@/components/deltavault/providers';
import Shell from '@/components/deltavault/shell';
export const metadata:Metadata={title:{default:'DeltaVault — Capital in motion',template:'%s | DeltaVault'},description:'Explore market-specific liquidity and leveraged trading with a transparent DeltaVault demo. Defined exposure. Everything in view.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Providers><Shell>{children}</Shell></Providers></body></html>}
