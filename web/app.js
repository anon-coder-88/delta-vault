import {BrowserProvider,Contract,parseUnits,keccak256,toUtf8Bytes} from 'https://cdn.jsdelivr.net/npm/ethers@6.17.0/+esm';
const $=id=>document.getElementById(id),providers=new Map();
let config,vault,token,lens,signer,busy=false;
const report=text=>{$('status').textContent=text};
function listWallets(){const chosen=$('wallet').value;$('wallet').replaceChildren(...[...providers].map(([id,entry])=>new Option(entry.name,id)));if(providers.has(chosen))$('wallet').value=chosen}
window.addEventListener('eip6963:announceProvider',({detail})=>{if(detail?.provider?.request){providers.set(detail.info.uuid,{name:detail.info.name,provider:detail.provider});listWallets()}});
window.dispatchEvent(new Event('eip6963:requestProvider'));
if(window.ethereum){providers.set('injected',{name:'Browser wallet',provider:window.ethereum});listWallets()}
try{const response=await fetch('config.json');if(!response.ok)throw Error('Deploy first to generate config.json');config=await response.json()}catch(e){report(e.message)}
const marketId=()=>keccak256(toUtf8Bytes($('market').value));
async function refresh(){
 const m=await lens.marketState(config.vault,marketId());
 $('state').textContent=JSON.stringify({liquidity:m.liquidity.toString(),reserved:m.reserved.toString(),remainingCapacity:m.remainingCapacity.toString(),price:m.price.toString(),fresh:m.fresh,enabled:m.enabled,paused:m.paused},null,2)+'\nAmounts: 6 decimals; price: 8 decimals.';
}
$('connect').onclick=async()=>{try{
 if(!config)throw Error('Deploy first');const selected=providers.get($('wallet').value);if(!selected)throw Error('Install an EVM wallet or open this page in its wallet browser');
 const provider=new BrowserProvider(selected.provider);await provider.send('eth_requestAccounts',[]);
 if(Number((await provider.getNetwork()).chainId)!==config.chainId)throw Error(`Switch your wallet to deployment chain ${config.chainId}`);
 signer=await provider.getSigner();vault=new Contract(config.vault,config.vaultAbi,signer);token=new Contract(config.token,config.tokenAbi,signer);lens=new Contract(config.lens,config.lensAbi,provider);
 report(`Connected ${await signer.getAddress()} on chain ${config.chainId}`);await refresh();
 selected.provider.on?.('accountsChanged',()=>location.reload());selected.provider.on?.('chainChanged',()=>location.reload());
 }catch(e){report(e.shortMessage||e.message)}};
$('refresh').onclick=()=>refresh().catch(e=>report(e.shortMessage||e.message));
document.querySelectorAll('[data-action]').forEach(button=>button.onclick=async()=>{
 if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{
  if(!signer)throw Error('Connect a wallet on the deployment network');
  const action=button.dataset.action,id=marketId();
  const call={faucet:()=>token.faucet(),approve:()=>token.approve(config.vault,parseUnits($('amount').value,6)),deposit:()=>vault.deposit(id,parseUnits($('amount').value,6)),withdraw:()=>vault.withdraw(id,parseUnits($('shares').value,6)),open:()=>vault.openPosition(id,parseUnits($('amount').value,6),Number($('leverage').value),$('direction').value==='long'),close:()=>vault.closePosition(BigInt($('position').value)),liquidate:()=>vault.liquidate(BigInt($('position').value))}[action];
  if(!confirm(`${button.textContent} on chain ${config.chainId}? Contract: ${['faucet','approve'].includes(action)?config.token:config.vault}. Check all values in your wallet.`))return;
  report('Awaiting wallet approval…');const tx=await call();report(`Pending: ${tx.hash}`);const receipt=await tx.wait();if(receipt.status!==1)throw Error('Transaction reverted');const opened=receipt.logs.map(log=>{try{return vault.interface.parseLog(log)}catch{return null}}).find(log=>log?.name==='PositionOpened');report(`Confirmed: ${tx.hash}${opened?' · position ID '+opened.args.positionId:''}`);await refresh().catch(()=>report(`Confirmed: ${tx.hash} · market read unavailable; refresh to retry.`));
 }catch(e){report(e.shortMessage||e.message)}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false)}
});
