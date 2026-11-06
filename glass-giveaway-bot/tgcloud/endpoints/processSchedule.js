import{db,api}from'sdk';import{eq,and}from'sdk/db';import{giveaways,entries,winners,users,referrals}from'../schema.js';import{checkMembership}from'../lib/membership.js';import{BOOST_BONUS_TICKETS,REFERRAL_BONUS_TICKETS}from'../lib/config.js';
function randomIndex(n){const a=new Uint32Array(1);crypto.getRandomValues(a);return Math.floor(a[0]/4294967296*n);}
function draw(rows,count){const pool=rows.map(r=>({...r,weight:Math.max(1,Number(r.tickets)||1)})),out=[];while(pool.length&&out.length<count){let cursor=randomIndex(pool.reduce((s,r)=>s+r.weight,0)),i=0;for(;i<pool.length;i++){cursor-=pool[i].weight;if(cursor<0)break;}out.push(pool.splice(Math.min(i,pool.length-1),1)[0]);}return out;}
export default async function(){const now=Math.floor(Date.now()/1000),all=await db.select().from(giveaways).all(),actions=[];
for(const g of all){
if(g.status==='scheduled'&&g.startsAt<=now&&!g.startPosted){if(g.announcementChatId)await api.sendMessage({chat_id:g.announcementChatId,text:'🎁 Начался розыгрыш «'+g.title+'»!\nПриз: '+g.prize+'\nПобедителей: '+g.winnerCount});await db.update(giveaways).set({status:'active',startPosted:true}).where(eq(giveaways.id,g.id)).run();actions.push({giveawayId:g.id,action:'started'});}
if(g.status!=='finished'&&g.endsAt<=now&&!g.endPosted){
const existing=await db.select().from(winners).where(eq(winners.giveawayId,g.id)).all();let selected=existing.sort((a,b)=>a.place-b.place);
if(!selected.length){const participants=await db.select().from(entries).where(eq(entries.giveawayId,g.id)).all(),eligible=[];
for(const row of participants){let boosts=row.boosts||0;if(g.boostChatId){try{const result=await api.getUserChatBoosts({chat_id:g.boostChatId,user_id:row.userId});boosts=Array.isArray(result?.boosts)?result.boosts.length:0;}catch(e){console.warn('Could not refresh boosts at draw',row.userId,e?.description||e);}}
const refs=await db.$count(referrals,and(eq(referrals.giveawayId,g.id),eq(referrals.referrerId,row.userId))),tickets=1+boosts*BOOST_BONUS_TICKETS+refs*REFERRAL_BONUS_TICKETS;
await db.update(entries).set({boosts,referrals:refs,tickets}).where(eq(entries.id,row.id)).run();
const membership=await checkMembership(g.id,row.userId);if(membership.ok)eligible.push({...row,boosts,referrals:refs,tickets});else console.info('Excluded at draw: no longer subscribed',row.userId,g.id);
}
selected=draw(eligible,g.winnerCount);
if(selected.length){await db.insert(winners).values(selected.map((row,i)=>({giveawayId:g.id,userId:row.userId,place:i+1,ticketsAtDraw:row.tickets}))).onConflictDoNothing().run();selected=await db.select().from(winners).where(eq(winners.giveawayId,g.id)).all();selected.sort((a,b)=>a.place-b.place);}
}
const lines=[];for(const w of selected){const u=await db.select().from(users).where(eq(users.tgId,w.userId)).get();lines.push(w.place+'. '+(u?.firstName||'Участник')+(u?.username?' (@'+u.username+')':'')+' — ID '+w.userId);}
if(g.announcementChatId)await api.sendMessage({chat_id:g.announcementChatId,text:selected.length?'🏆 Розыгрыш «'+g.title+'» завершён!\nПобедители:\n'+lines.join('\n'):'Розыгрыш «'+g.title+'» завершён. Подходящих участников не оказалось.'});
await db.update(giveaways).set({status:'finished',endPosted:true}).where(eq(giveaways.id,g.id)).run();actions.push({giveawayId:g.id,action:'finished',winners:selected.length});
}}
return{ok:true,processedAt:now,actions};}