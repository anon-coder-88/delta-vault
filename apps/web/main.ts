import {createPublicClient, createWalletClient, custom, http, getAddress, type EIP1193Provider, type Address} from 'viem';
import {foundry} from 'viem/chains';
import {marketClient, assetUnits, MarketVaultAbi} from '../../packages/sdk/index';
import {DevelopmentAssetAbi} from '../../packages/abi/index';

const field = (id:string) => document.getElementById(id) as HTMLInputElement;
const status = document.getElementById('status')!;
const publicClient = createPublicClient({chain:foundry,transport:http('http://127.0.0.1:8545')});
let account:Address | undefined;
let client:ReturnType<typeof marketClient> | undefined;
let provider:EIP1193Provider | undefined;
let connectedVault:Address | undefined;

function ready() {
  if (!client || !account) throw Error('Connect a wallet on local chain 31337');
  if (getAddress(field('vault').value) !== connectedVault) throw Error('Reconnect after changing the vault address');
  return {client,account};
}
async function refresh() {
  const {client,account} = ready();
  const snapshot = await client.snapshot(account);
  document.getElementById('snapshot')!.textContent = JSON.stringify(snapshot,(_,v)=>typeof v==='bigint'?v.toString():v,2);
}
async function amount() {
  const {client} = ready();
  const asset = await publicClient.readContract({address:client.vault,abi:MarketVaultAbi,functionName:'asset'});
  const decimals = await publicClient.readContract({address:asset,abi:DevelopmentAssetAbi,functionName:'decimals'});
  return assetUnits(field('amount').value,decimals);
}
const positionId = () => {
  if (!/^[1-9]\d*$/.test(field('position').value)) throw Error('Enter a positive integer position ID');
  return BigInt(field('position').value);
};
function invalidate() {
  client=undefined;account=undefined;connectedVault=undefined;
  document.getElementById('account')!.textContent='Account or chain changed. Reconnect.';
  document.getElementById('snapshot')!.textContent='No current account read';
}
const actions:Record<string,()=>Promise<unknown>> = {
  async connect() {
    provider=(window as Window & {ethereum?:EIP1193Provider}).ethereum;
    if (!provider) throw Error('No injected EVM wallet available');
    const wallet=createWalletClient({chain:foundry,transport:custom(provider)});
    if (await wallet.getChainId() !== 31337) throw Error('Switch your wallet to local Anvil chain 31337');
    [account] = await wallet.requestAddresses();
    if (!account) throw Error('No selected account');
    connectedVault=getAddress(field('vault').value);
    if (!await publicClient.getCode({address:connectedVault})) throw Error('No contract at this local address');
    client=marketClient(publicClient,createWalletClient({account,chain:foundry,transport:custom(provider)}),connectedVault);
    document.getElementById('account')!.textContent=`${account} · Local chain 31337`;
    const emitter=provider as EIP1193Provider & {on?:(event:string,cb:()=>void)=>void;removeListener?:(event:string,cb:()=>void)=>void};
    emitter.removeListener?.('accountsChanged',invalidate);emitter.removeListener?.('chainChanged',invalidate);
    emitter.on?.('accountsChanged',invalidate);emitter.on?.('chainChanged',invalidate);
    await refresh();
  },
  refresh,
  approve:async()=>ready().client.approveAsset(await amount()),
  deposit:async()=>{const {client,account}=ready();return client.deposit(await amount(),account)},
  redeem:async()=>{const {client,account}=ready();return client.redeem((await client.snapshot(account)).shares,account,account)},
  open:async()=>{const {id}=await ready().client.open(await amount(),Number(field('leverage').value),field('direction').value==='long');field('position').value=id.toString()},
  close:async()=>ready().client.close(positionId()),
  liquidate:async()=>ready().client.liquidate(positionId()),
  expire:async()=>ready().client.expire(positionId()),
  recover:async()=>ready().client.recover(positionId()),
  claim:async()=>{const {client,account}=ready();return client.withdrawClaim(account)},
};
for (const [id, action] of Object.entries(actions)) {
  document.getElementById(id)!.addEventListener('click',async()=>{
    const buttons=Array.from(document.querySelectorAll('button'));
    buttons.forEach(button=>button.disabled=true);
    status.textContent='Waiting for wallet or local transaction confirmation…';
    try {
      await action();
      status.textContent=`${id} completed on local chain.`;
      if(client && id!=='refresh' && id!=='connect') {
        try {await refresh()} catch(error) {status.textContent += ` Snapshot unavailable: ${(error as Error).message}`}
      }
    } catch(error) {status.textContent=(error as Error).message}
    finally {buttons.forEach(button=>button.disabled=false)}
  });
}
