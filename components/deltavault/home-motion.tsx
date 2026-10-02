'use client';

import {useEffect} from 'react';

/** Motion is progressive: the server-rendered page is fully visible until this mounts. */
export default function HomeMotion(){
 useEffect(()=>{
  const root=document.querySelector<HTMLElement>('main.home-main');
  if(!root)return;
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  const targets=[...root.querySelectorAll<HTMLElement>('.market-overview .section-top > *, .market-overview .market-label, .market-row, .system-section .section-top > *, .feature-major, .feature-stack article, .risk-layout > div, .risk-index > a, .final-cta > *')];
  let observer:IntersectionObserver|null=null;
  let frame=0;
  const update=()=>{
   frame=0;
   const travel=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
   root.style.setProperty('--page-progress',String(Math.min(1,Math.max(0,window.scrollY/travel))));
   root.style.setProperty('--art-drift',`${Math.min(34,Math.max(0,window.scrollY*.08))}px`);
  };
  const scroll=()=>{if(!frame&&!document.hidden)frame=requestAnimationFrame(update)};
  const configure=()=>{
   observer?.disconnect();observer=null;
   if(preference.matches){root.classList.remove('motion-active');root.style.removeProperty('--art-drift');return}
   targets.forEach((element,index)=>{
    element.classList.add('reveal-item');
    element.style.setProperty('--reveal-delay',`${(index%4)*75}ms`);
   });
   observer=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('in-view');observer?.unobserve(entry.target)}
   },{rootMargin:'0px 0px -7% 0px',threshold:.08});
   targets.forEach(element=>{if(!element.classList.contains('in-view'))observer?.observe(element)});
   root.classList.add('motion-active');scroll();
  };
  configure();
  preference.addEventListener('change',configure);
  window.addEventListener('scroll',scroll,{passive:true});
  window.addEventListener('resize',scroll,{passive:true});
  document.addEventListener('visibilitychange',scroll);
  return()=>{
   observer?.disconnect();cancelAnimationFrame(frame);
   preference.removeEventListener('change',configure);
   window.removeEventListener('scroll',scroll);
   window.removeEventListener('resize',scroll);
   document.removeEventListener('visibilitychange',scroll);
   root.classList.remove('motion-active');root.style.removeProperty('--page-progress');root.style.removeProperty('--art-drift');
   targets.forEach(element=>{element.classList.remove('reveal-item','in-view');element.style.removeProperty('--reveal-delay')});
  };
 },[]);
 return <div className="home-progress" aria-hidden="true"/>;
}
