import { db, api } from 'sdk';
import { eq, and } from 'sdk/db';
import { giveaways, entries, winners, users, referrals } from '../schema.js';
import { checkMembership } from '../lib/membership.js';
import { BOOST_BONUS_TICKETS, REFERRAL_BONUS_TICKETS } from '../lib/config.js';

function randomIndex(total) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return Math.floor((value[0] / 0x100000000) * total);
}

function drawWeighted(rows, count) {
  const pool = rows.map(row => ({ ...row, weight: Math.max(1, Number(row.tickets) || 1) }));
  const selected = [];
  while (pool.length && selected.length < count) {
    let cursor = randomIndex(pool.reduce((sum, row) => sum + row.weight, 0));
    let index = 0;
    for (; index < pool.length; index++) {
      cursor -= pool[index].weight;
      if (cursor < 0) break;
    }
    selected.push(pool.splice(Math.min(index, pool.length - 1), 1)[0]);
  }
  return selected;
}

export default async function processSchedule() {
  const now = Math.floor(Date.now() / 1000);
  const all = await db.select().from(giveaways).all();
  const actions = [];

  for (const giveaway of all) {
    if (giveaway.status === 'scheduled' && giveaway.startsAt <= now && !giveaway.startPosted) {
      if (giveaway.announcementChatId) {
        try {
          await api.sendMessage({
            chat_id: giveaway.announcementChatId,
            text: '🎁 Начался розыгрыш «' + giveaway.title + '»!\nПриз: ' + giveaway.prize +
              '\nПобедителей: ' + giveaway.winnerCount,
          });
        } catch (error) {
          console.warn('Start announcement failed', giveaway.id, error?.description || error);
          actions.push({ giveawayId: giveaway.id, action: 'start_post_failed' });
          continue;
        }
      }
      await db.update(giveaways).set({ status: 'active', startPosted: true })
        .where(eq(giveaways.id, giveaway.id)).run();
      actions.push({ giveawayId: giveaway.id, action: 'started' });
    }

    if (giveaway.status !== 'finished' && giveaway.endsAt <= now && !giveaway.endPosted) {
      // Reuse already stored winners on retry; never redraw after a notification failure.
      let selected = await db.select().from(winners)
        .where(eq(winners.giveawayId, giveaway.id)).all();

      if (!selected.length) {
        const participants = await db.select().from(entries)
          .where(eq(entries.giveawayId, giveaway.id)).all();
        const eligible = [];

        for (const participant of participants) {
          let boosts = participant.boosts || 0;
          if (giveaway.boostChatId) {
            try {
              const result = await api.getUserChatBoosts({
                chat_id: giveaway.boostChatId,
                user_id: participant.userId,
              });
              boosts = Array.isArray(result?.boosts) ? result.boosts.length : 0;
            } catch (error) {
              console.warn('Boost refresh failed', participant.userId, error?.description || error);
            }
          }

          const referralsCount = await db.$count(referrals, and(
            eq(referrals.giveawayId, giveaway.id),
            eq(referrals.referrerId, participant.userId),
          ));
          const tickets = 1 + boosts * BOOST_BONUS_TICKETS +
            referralsCount * REFERRAL_BONUS_TICKETS;

          await db.update(entries).set({
            boosts,
            referrals: referralsCount,
            tickets,
          }).where(eq(entries.id, participant.id)).run();

          const membership = await checkMembership(giveaway.id, participant.userId);
          if (membership.ok) {
            eligible.push({ ...participant, boosts, referrals: referralsCount, tickets });
          } else {
            console.info('Participant excluded at draw: no longer subscribed', participant.userId, giveaway.id);
          }
        }

        const drawn = drawWeighted(eligible, giveaway.winnerCount);
        if (drawn.length) {
          await db.insert(winners).values(drawn.map((row, index) => ({
            giveawayId: giveaway.id,
            userId: row.userId,
            place: index + 1,
            ticketsAtDraw: row.tickets,
          }))).onConflictDoNothing().run();
        }
        selected = await db.select().from(winners)
          .where(eq(winners.giveawayId, giveaway.id)).all();
      }

      selected.sort((a, b) => a.place - b.place);
      const winnerLines = [];
      for (const winner of selected) {
        const user = await db.select().from(users)
          .where(eq(users.tgId, winner.userId)).get();
        const name = user?.firstName || 'Участник';
        const username = user?.username ? ' (@' + user.username + ')' : '';
        winnerLines.push(winner.place + '. ' + name + username + ' — ID ' + winner.userId);
      }

      if (giveaway.announcementChatId) {
        try {
          await api.sendMessage({
            chat_id: giveaway.announcementChatId,
            text: selected.length
              ? '🏆 Розыгрыш «' + giveaway.title + '» завершён!\nПобедители:\n' + winnerLines.join('\n')
              : 'Розыгрыш «' + giveaway.title + '» завершён. Подходящих участников не оказалось.',
          });
        } catch (error) {
          console.warn('End announcement failed', giveaway.id, error?.description || error);
          actions.push({ giveawayId: giveaway.id, action: 'end_post_failed' });
          continue;
        }
      }

      await db.update(giveaways).set({ status: 'finished', endPosted: true })
        .where(eq(giveaways.id, giveaway.id)).run();
      actions.push({ giveawayId: giveaway.id, action: 'finished', winners: selected.length });
    }
  }

  return { ok: true, processedAt: now, actions };
}
