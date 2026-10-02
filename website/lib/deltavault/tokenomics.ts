// Proposed website allocation; final token specifications remain to be announced.
export const TOKEN_TICKER='TBA';
export const TOKEN_ALLOCATIONS=[
 {name:'Ecosystem incentives',percent:30,color:'#63E3D4',description:'Proposed incentives for participation and ecosystem growth.'},
 {name:'Liquidity',percent:25,color:'#54AFC8',description:'Proposed support for token liquidity and market access.'},
 {name:'Treasury',percent:20,color:'#8298E8',description:'Proposed reserves for protocol development and operations.'},
 {name:'Team',percent:15,color:'#D6B57A',description:'Proposed allocation for contributors; vesting is TBA.'},
 {name:'Community',percent:10,color:'#B6D0D6',description:'Proposed community programs and participation initiatives.'},
] as const;
export const TOKEN_ALLOCATION_TOTAL=TOKEN_ALLOCATIONS.reduce((total,item)=>total+item.percent,0);
