import Decimal from 'decimal.js';
import { z } from 'zod';
Decimal.set({precision:40,rounding:Decimal.ROUND_DOWN});
export const VERSION=1;
export const D=(v:Decimal.Value)=>new Decimal(v);
export const money=(v:Decimal.Value)=>D(v).toFixed(2,Decimal.ROUND_DOWN);
export const MARKETS=[
 {id:'btc',symbol:'BTC',name:'Bitcoin',pair:'BTC-USD',price:'68420',maxLeverage:10,maintenance:'0.05',fee:'0.001',sharePrice:'1.24',liquidity:'1250000',baseExposure:'620000',exposureLimit:'1000000',depositLimit:'250000',color:'#F3C783'},
 {id:'eth',symbol:'ETH',name:'Ethereum',pair:'ETH-USD',price:'3450',maxLeverage:10,maintenance:'0.05',fee:'0.001',sharePrice:'1.08',liquidity:'780000',baseExposure:'312000',exposureLimit:'600000',depositLimit:'200000',color:'#A8B7F4'},
] as const;
export type MarketId=typeof MARKETS[number]['id'];
export const getMarket=(id:string)=>MARKETS.find(m=>m.id===id);
const decimal=z.string().regex(/^\d+(\.\d+)?$/).refine(v=>D(v).isFinite()&&D(v).lte('1000000000000'));
const signed=z.string().refine(v=>{try{return D(v).isFinite()&&D(v).abs().lte('1000000000000')}catch{return false}});
const PositionSchema=z.object({id:z.string(),marketId:z.enum(['btc','eth']),direction:z.enum(['long','short']),collateral:decimal,exposure:decimal,quantity:decimal,entry:decimal,leverage:z.number().int().min(1).max(10),entryFee:decimal,configVersion:z.literal(1),status:z.enum(['Open','Closed','Liquidated']),opened:z.string(),closed:z.string().optional(),result:signed.optional(),exit:decimal.optional()});
const LedgerSchema=z.object({id:z.string(),action:z.string(),marketId:z.string(),amount:signed,fee:decimal,before:decimal,after:decimal,time:z.string(),recordId:z.string().optional()});
const StateSchema=z.object({version:z.literal(1),revision:z.number().int().nonnegative(),cash:decimal,prices:z.object({btc:decimal.refine(v=>D(v).gte(".01")),eth:decimal.refine(v=>D(v).gte(".01"))}),paused:z.boolean(),positions:z.array(PositionSchema).max(1000),holdings:z.object({btc:z.object({shares:decimal,basis:decimal}),eth:z.object({shares:decimal,basis:decimal})}),ledger:z.array(LedgerSchema).max(3000),actions:z.array(z.string()).max(5000)});
export type DemoState=z.infer<typeof StateSchema>;
export type Position=z.infer<typeof PositionSchema>;
export type DemoAction={kind:'open';marketId:MarketId;direction:'long'|'short';amount:string;leverage:number}|{kind:'close';positionId:string}|{kind:'deposit'|'withdraw';marketId:MarketId;amount:string};
export type Review={id:string;revision:number;action:DemoAction;title:string;items:[string,string][];risk:string};
export function initialState():DemoState{return {version:1,revision:0,cash:'10000.00',prices:{btc:MARKETS[0].price,eth:MARKETS[1].price},paused:false,positions:[],holdings:{btc:{shares:'0',basis:'0'},eth:{shares:'0',basis:'0'}},ledger:[],actions:[]}}
export function parseState(value:string):DemoState{return StateSchema.parse(JSON.parse(value))}
export function amount(v:string,decimals=2){if(!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(v)||!D(v).isFinite()||D(v).lte(0)||D(v).gt('1000000000'))throw Error(`Enter a positive amount with at most ${decimals} decimal places.`);return D(v)}
export function pnl(p:Position,price:string){const delta=D(price).minus(p.entry);return delta.mul(p.quantity).mul(p.direction==='long'?1:-1)}
export function liquidation(p:Pick<Position,'marketId'|'direction'|'quantity'|'entry'|'collateral'>){const m=getMarket(p.marketId)!;const q=D(p.quantity);if(q.lte(0))return D(0);return p.direction==='long'?Decimal.max(0,q.mul(p.entry).minus(p.collateral).div(q.mul(D(1).minus(m.maintenance).minus(m.fee)))):D(p.collateral).plus(q.mul(p.entry)).div(q.mul(D(1).plus(m.maintenance).plus(m.fee)))}
export function vaultMetrics(s:DemoState,id:MarketId){const m=getMarket(id)!;const total=D(m.liquidity).plus(D(s.holdings[id].shares).mul(m.sharePrice));const exposure=s.positions.filter(p=>p.marketId===id&&p.status==='Open').reduce((a,p)=>a.plus(p.exposure),D(m.baseExposure));const capacity=Decimal.min(m.exposureLimit,total.mul('.8'));return {total,exposure,available:Decimal.max(0,total.minus(exposure)),capacity,remaining:Decimal.max(0,capacity.minus(exposure)),utilization:total.eq(0)?null:exposure.div(total).mul(100)}}
export function closing(s:DemoState,p:Position){const m=getMarket(p.marketId)!;const fee=D(p.quantity).mul(s.prices[p.marketId]).mul(m.fee);const gross=D(p.collateral).plus(pnl(p,s.prices[p.marketId]));const credit=Decimal.max(0,gross.minus(fee));return {fee,credit:D(money(credit)),result:credit.minus(p.collateral).minus(p.entryFee)}}
export function validate(s:DemoState,a:DemoAction){
 if(a.kind==='open'){
  if(s.paused)throw Error('Scenario pricing is paused. Resume it before opening a position.');
  const m=getMarket(a.marketId);if(!m)throw Error('Unknown market.');const c=amount(a.amount);
  if(!Number.isInteger(a.leverage)||a.leverage<1||a.leverage>m.maxLeverage)throw Error('Leverage must be between 1× and 10×.');
  const exposure=c.mul(a.leverage),fee=D(money(exposure.mul(m.fee))),debit=c.plus(fee);
  if(debit.gt(s.cash))throw Error('Collateral plus the entry fee exceeds your demo balance.');
  if(exposure.gt(vaultMetrics(s,a.marketId).remaining))throw Error('This order exceeds the market’s remaining capacity.');
  return {collateral:c,exposure,fee,debit:D(money(debit)),quantity:exposure.div(s.prices[a.marketId]).toDecimalPlaces(18)};
 }
 if(a.kind==='close'){
  if(s.paused)throw Error('Scenario pricing is paused. Resume it before closing a position.');
  const p=s.positions.find(p=>p.id===a.positionId);if(!p||p.status!=='Open')throw Error('This position is no longer open.');return closing(s,p);
 }
 const m=getMarket(a.marketId);if(!m)throw Error('Unknown vault.');
 if(a.kind==='deposit'){
  const deposit=amount(a.amount);if(deposit.gt(s.cash))throw Error('Deposit exceeds your demo balance.');
  if(deposit.plus(s.holdings[a.marketId].basis).gt(m.depositLimit))throw Error('Deposit exceeds this scenario’s deposit limit.');
  return {shares:deposit.div(m.sharePrice).toDecimalPlaces(6),deposit};
 }
 const shares=amount(a.amount,6);if(shares.gt(s.holdings[a.marketId].shares))throw Error('You do not hold enough shares.');
 const gross=shares.mul(m.sharePrice);if(gross.gt(vaultMetrics(s,a.marketId).available))throw Error('Withdrawal exceeds available scenario liquidity.');
 const fee=gross.mul('.001');return {shares,fee,credit:D(money(gross.minus(fee)))};
}
export function makeReview(s:DemoState,a:DemoAction,id:string):Review{
 validate(s,a);const m=a.kind==='close'?getMarket(s.positions.find(p=>p.id===a.positionId)!.marketId)!:getMarket(a.marketId)!;
 let title='',items:[string,string][]=[];
 if(a.kind==='open'){const c=D(a.amount),exposure=c.mul(a.leverage),q=exposure.div(s.prices[a.marketId]);title=`Review ${a.direction} position`;items=[['Market',m.pair],['Collateral',`${money(c)} demo USD`],['Leverage',`${a.leverage}×`],['Exposure',`${money(exposure)} demo USD`],['Entry price',`${money(s.prices[a.marketId])} scenario USD`],['Entry fee',`${money(exposure.mul(m.fee))} demo USD`],['Estimated liquidation',`${money(liquidation({marketId:a.marketId,direction:a.direction,quantity:q.toString(),entry:s.prices[a.marketId],collateral:a.amount}))} scenario USD`]];}
 else if(a.kind==='close'){title='Review position close';const p=s.positions.find(p=>p.id===a.positionId)!;const v=closing(s,p);items=[['Position',`${p.direction.toUpperCase()} ${m.pair}`],['Exit price',`${money(s.prices[p.marketId])} scenario USD`],['Exit fee',`${money(v.fee)} demo USD`],['Amount returned',`${money(v.credit)} demo USD`],['Net result',`${money(v.result)} demo USD`]];}
 else if(a.kind==='deposit'){title='Review vault deposit';items=[['Vault',`${m.symbol} market vault`],['Deposit',`${money(a.amount)} demo USD`],['Estimated shares',D(a.amount).div(m.sharePrice).toFixed(6)],['Share price',`${m.sharePrice} sample USD`],['Deposit fee','0.00 demo USD']];}
 else {const gross=D(a.amount).mul(m.sharePrice);title='Review vault withdrawal';items=[['Vault',`${m.symbol} market vault`],['Shares',a.amount],['Share price',`${m.sharePrice} sample USD`],['Withdrawal fee',`${money(gross.mul('.001'))} demo USD`],['Amount returned',`${money(gross.mul('.999'))} demo USD`]];}
 return {id,revision:s.revision,action:a,title,items,risk:a.kind==='open'||a.kind==='close'?'Leverage magnifies losses. A position can be liquidated and lose its collateral. These estimates use simplified sample rules.':'Liquidity providers can lose capital. Trader outcomes, liquidity availability, oracles and smart contracts introduce risk. This demonstration does not promise yield or redemption.'};
}
export function commit(s:DemoState,r:Review,time=new Date().toISOString()):DemoState{
 if(s.actions.includes(r.id))return s;
 if(r.revision!==s.revision)throw Error('The scenario or balance changed. Close this review and review the action again.');validate(s,r.action);
 const n=structuredClone(s);const a=r.action;let fee=D(0),delta=D(0),recordId=r.id,marketId:MarketId='btc';
 if(a.kind==='open'){marketId=a.marketId;const m=getMarket(marketId)!;const exposure=D(a.amount).mul(a.leverage);fee=D(money(exposure.mul(m.fee)));delta=D(a.amount).plus(fee).neg();n.positions.unshift({id:r.id,marketId,direction:a.direction,collateral:money(a.amount),exposure:money(exposure),quantity:exposure.div(s.prices[marketId]).toFixed(18),entry:s.prices[marketId],leverage:a.leverage,entryFee:money(fee),configVersion:1,status:'Open',opened:time});}
 else if(a.kind==='close'){const p=n.positions.find(p=>p.id===a.positionId)!;marketId=p.marketId;recordId=p.id;const v=closing(s,p);fee=v.fee;delta=v.credit;p.status='Closed';p.closed=time;p.result=money(delta.minus(p.collateral).minus(p.entryFee));p.exit=s.prices[p.marketId];}
 else {marketId=a.marketId;const m=getMarket(marketId)!;const h=n.holdings[marketId];if(a.kind==='deposit'){const shares=D(a.amount).div(m.sharePrice).toDecimalPlaces(6);h.shares=D(h.shares).plus(shares).toFixed(6);h.basis=money(D(h.basis).plus(a.amount));delta=D(a.amount).neg();}else{const shares=D(a.amount),gross=shares.mul(m.sharePrice);fee=gross.mul('.001');delta=D(money(gross.minus(fee)));h.basis=money(D(h.basis).mul(D(1).minus(shares.div(h.shares))));h.shares=D(h.shares).minus(shares).toFixed(6);}}
 n.cash=money(D(s.cash).plus(delta));n.revision++;n.actions.push(r.id);n.ledger.unshift({id:r.id,action:a.kind,marketId,amount:money(delta),fee:money(fee),before:s.cash,after:n.cash,time,recordId});return n;
}
export function changeScenario(s:DemoState,id:MarketId,price:string,time=new Date().toISOString()):DemoState{
 const p=amount(price);if(p.lt('.01'))throw Error('Scenario price must be at least 0.01.');const n=structuredClone(s);n.prices[id]=money(p);n.revision++;
 if(!s.paused)for(const pos of n.positions.filter(p=>p.marketId===id&&p.status==='Open')){
  const v=closing(n,pos),maintenance=D(pos.quantity).mul(price).mul(getMarket(id)!.maintenance);
  if(D(pos.collateral).plus(pnl(pos,price)).minus(v.fee).lte(maintenance)){
   const before=n.cash;n.cash=money(D(n.cash).plus(v.credit));pos.status='Liquidated';pos.closed=time;pos.exit=money(price);pos.result=money(v.credit.minus(pos.collateral).minus(pos.entryFee));
   n.ledger.unshift({id:`liquidate-${pos.id}`,action:'liquidated',marketId:id,amount:money(v.credit),fee:money(v.fee),before,after:n.cash,time,recordId:pos.id});
  }
 }return n;
}
export function setPaused(s:DemoState,paused:boolean){let n={...s,paused,revision:s.revision+1};if(!paused)for(const m of MARKETS)n=changeScenario(n,m.id,n.prices[m.id]);return n}
export function portfolioValue(s:DemoState){return MARKETS.reduce((a,m)=>a.plus(D(s.holdings[m.id].shares).mul(m.sharePrice)),s.positions.filter(p=>p.status==='Open').reduce((a,p)=>a.plus(closing(s,p).credit),D(s.cash)))}
