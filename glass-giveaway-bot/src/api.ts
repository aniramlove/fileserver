import type{Captcha,ListResponse,Winner}from'./types';
const now=Math.floor(Date.now()/1000);
const demo:ListResponse={user:{id:0,firstName:'Гость'},giveaways:[{id:'demo-1',title:'Набор приятных мелочей',description:'Тестовый розыгрыш сообщества',prize:'Подарочный набор',winnerCount:3,startsAt:now-3600,endsAt:now+172800,participants:128,status:'active',joined:false,ownTickets:0,ownBoosts:0,ownReferrals:0,requirements:[]},{id:'demo-2',title:'Бонус подписчикам',description:'Пример запланированного розыгрыша',prize:'Telegram Stars',winnerCount:1,startsAt:now+86400,endsAt:now+432000,participants:0,status:'scheduled',joined:false,ownTickets:0,ownBoosts:0,ownReferrals:0,requirements:[]}]};
function call<T>(name:string,input:Record<string,unknown>={}):Promise<T>{const api=window.Telegram?.WebApp?.Serverless;if(!api)return Promise.reject(new Error('Открой Mini App через Telegram.'));return new Promise((resolve,reject)=>api.call(name,input,(e,r)=>e?reject(e):resolve(r as T)));}
export const api={
list:()=>window.Telegram?.WebApp?.Serverless?call<ListResponse>('getGiveaways'):Promise.resolve(demo),
captcha:(giveawayId:string)=>call<Captcha>('getCaptcha',{giveawayId}),
verifyCaptcha:(giveawayId:string,challengeId:string,answer:string)=>call<{ok:boolean}>('verifyCaptcha',{giveawayId,challengeId,answer}),
join:(giveawayId:string)=>call<{ok:boolean;tickets:number;boosts:number;referrals:number}>('joinGiveaway',{giveawayId}),
stats:()=>call<{entries:number;referrals:number;wins:number;tickets:number;isAdmin:boolean}>('getMyStats'),
winners:()=>call<{winners:Winner[]}>('getWinners'),
create:(input:Record<string,unknown>)=>call<{ok:boolean;giveawayId:string}>('createGiveaway',input),
};