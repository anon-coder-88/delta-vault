// EIP-6963 keeps installed browser wallets separate instead of choosing window.ethereum blindly.
const connectButton=document.querySelector('#connect');
const dialog=document.querySelector('#wallet-dialog');
const closeButton=document.querySelector('#close-wallet');
const options=document.querySelector('#wallet-options');
const status=document.querySelector('#status');
const error=document.querySelector('#wallet-error');
const announced=new Map();
const brands=[
  {name:'MetaMask',icon:'metamask',url:'https://metamask.io/download/',matches:(name,p)=>/metamask/i.test(name)||Boolean(p.isMetaMask&&!p.isRabby)},
  {name:'Coinbase Wallet',icon:'coinbase',url:'https://www.coinbase.com/wallet/downloads',matches:(name,p)=>/coinbase/i.test(name)||Boolean(p.isCoinbaseWallet)},
  {name:'Rabby',icon:'rabby',url:'https://rabby.io/',matches:(name,p)=>/rabby/i.test(name)||Boolean(p.isRabby)}
];

function candidates(){
  const list=[...announced.values()];
  const injected=window.ethereum?.providers||(window.ethereum?[window.ethereum]:[]);
  for(const provider of injected)if(!list.some(item=>item.provider===provider))list.push({name:'Browser wallet',provider});
  return list;
}

function walletRow({name,icon,url,provider}){
  const row=document.createElement('div');row.className='wallet-option';
  const logo=document.createElement('img');logo.src=`/wallets/${icon}.svg`;logo.alt='';logo.width=32;logo.height=32;
  const details=document.createElement('span');details.className='wallet-option-copy';
  const title=document.createElement('strong');title.textContent=name;
  const hint=document.createElement('small');hint.textContent=provider?'Detected in this browser':'Not installed';
  details.append(title,hint);
  const action=document.createElement(provider?'button':'a');
  action.textContent=provider?'Connect':'Install ↗';
  action.setAttribute('aria-label',`${provider?'Connect':'Install'} ${name}`);
  if(provider){action.type='button';action.addEventListener('click',()=>connect(provider,name,action))}
  else{action.href=url;action.target='_blank';action.rel='noopener noreferrer'}
  row.append(logo,details,action);return row;
}

function render(){
  const detected=candidates(),used=new Set();options.replaceChildren();
  for(const brand of brands){
    const match=detected.find(({name,provider})=>!used.has(provider)&&brand.matches(name,provider));
    if(match)used.add(match.provider);
    options.append(walletRow({...brand,provider:match?.provider}));
  }
  for(const item of detected.filter(({provider})=>!used.has(provider))){
    const row=document.createElement('button');row.type='button';row.className='extra-wallet';
    row.textContent=`Connect ${item.name}`;
    row.addEventListener('click',()=>connect(item.provider,item.name,row));options.append(row);
  }
}

async function connect(provider,name,action){
  error.hidden=true;action.disabled=true;action.textContent='Connecting…';
  try{
    const accounts=await provider.request({method:'eth_requestAccounts'});
    if(!accounts?.[0])throw new Error('No account was returned.');
    const chain=await provider.request({method:'eth_chainId'});
    const address=accounts[0];
    status.textContent=`${name} connected: ${address.slice(0,6)}…${address.slice(-4)} · chain ${parseInt(chain,16)}. Open the onchain terminal to act.`;
    connectButton.textContent=`${address.slice(0,6)}…${address.slice(-4)}`;
    dialog.close();
  }catch(err){
    error.textContent=err?.code===4001?'The wallet request was declined. Choose a wallet to retry.':'Connection did not complete. Check your wallet and try again.';
    error.hidden=false;
  }finally{action.disabled=false;action.textContent=action.classList.contains('extra-wallet')?`Connect ${name}`:'Connect'}
}

window.addEventListener('eip6963:announceProvider',event=>{
  const {info,provider}=event.detail||{};
  if(info?.uuid&&provider?.request){announced.set(info.uuid,{name:info.name||'Browser wallet',provider});render()}
});
window.dispatchEvent(new Event('eip6963:requestProvider'));
connectButton.addEventListener('click',()=>{render();error.hidden=true;dialog.showModal()});
closeButton.addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
window.addEventListener('pageshow',render);
window.addEventListener('ethereum#initialized',render);
render();
