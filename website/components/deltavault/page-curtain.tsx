'use client';

import {useEffect,useRef,useState} from 'react';

type Phase='enter'|'exit'|'ready';

export default function PageCurtain(){
 const [phase,setPhase]=useState<Phase>('enter');
 const navigating=useRef(false);
 const destination=useRef('');

 useEffect(()=>{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const enterTimer=window.setTimeout(()=>setPhase('ready'),1500);
  let leaveTimer=0;

  const navigate=(event:MouseEvent)=>{
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||navigating.current||reduced.matches)return;
   const target=event.target;
   if(!(target instanceof Element))return;
   const link=target.closest<HTMLAnchorElement>('a[href]');
   if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
   const url=new URL(link.href,location.href);
   if(!['http:','https:'].includes(url.protocol)||url.origin!==location.origin)return;
   if(url.pathname===location.pathname&&url.search===location.search)return;
   event.preventDefault();
   navigating.current=true;
   destination.current=url.href;
   window.clearTimeout(enterTimer);
   setPhase('exit');
   // Native document navigation preserves the working static-page links.
   leaveTimer=window.setTimeout(()=>location.assign(destination.current),580);
  };

  const restore=(event:PageTransitionEvent)=>{
   if(event.persisted){window.clearTimeout(leaveTimer);navigating.current=false;setPhase('ready')}
  };
  const motionChange=()=>{
   if(reduced.matches){window.clearTimeout(enterTimer);setPhase('ready');if(navigating.current)location.assign(destination.current)}
  };
  document.addEventListener('click',navigate);
  window.addEventListener('pageshow',restore);
  reduced.addEventListener('change',motionChange);
  return()=>{
   window.clearTimeout(enterTimer);window.clearTimeout(leaveTimer);
   document.removeEventListener('click',navigate);
   window.removeEventListener('pageshow',restore);
   reduced.removeEventListener('change',motionChange);
  };
 },[]);

 return <div className="page-curtain" data-phase={phase} role="status" aria-label={phase==='exit'?'Opening page':'Loading DeltaVault'} onAnimationEnd={event=>{if(event.target===event.currentTarget&&event.animationName==='dv-curtain-reveal')setPhase('ready')}}>
  <div className="curtain-grid" aria-hidden="true"/>
  <div className="curtain-center" aria-hidden="true">
   <div className="curtain-mark"><span className="curtain-orbit"/><span className="curtain-orbit inner"/><img src="/brand/symbol.svg" width="86" height="86" alt=""/></div>
   <span className="curtain-kicker">A NEW ANGLE ON CAPITAL</span>
   <strong>DELTA<span>VAULT</span></strong>
   <span className="curtain-subtitle">CAPITAL IN MOTION&nbsp; / &nbsp;RISK IN FOCUS</span>
  </div>
  <div className="curtain-foot" aria-hidden="true"><span>MARKET</span><i/><span>LIQUIDITY</span><i/><span>EXPOSURE</span></div>
  <div className="curtain-progress" aria-hidden="true"/>
 </div>;
}
