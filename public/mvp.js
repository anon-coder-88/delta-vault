// The full wallet and contract actions live in the reused React application.
const connect=document.querySelector('#connect');
const status=document.querySelector('#status');
connect.addEventListener('click',async()=>{
  const provider=window.ethereum;
  if(!provider){status.textContent='Install an EVM wallet, then reload this page.';return}
  try{
    const accounts=await provider.request({method:'eth_requestAccounts'});
    const chain=await provider.request({method:'eth_chainId'});
    status.textContent=`Connected ${accounts[0].slice(0,6)}…${accounts[0].slice(-4)} · chain ${parseInt(chain,16)}. Open the onchain terminal to act.`;
  }catch{status.textContent='Connection was not completed. You can retry.'}
});
