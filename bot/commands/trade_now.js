// // bot/commands/trade_now.js
// const fetch = require('node-fetch');
// const { fetchLatestSignal, hashSignal } = require('../../packages/lib/signal');
// const { openFromSignal } = require('../../packages/lib/hlTrade');
// const { users } = require('../../packages/lib/db');
// const { storeStrategyEncrypted } = require('../../packages/lib/strategyStore');

// function shortAddr(a){ return a ? a.slice(0,6) + '…' + a.slice(-4) : ''; }

// // Fallback: read latest BTC slot directly from feed when signal.js can't
// async function fetchLatestBtcSlotFallback() {
//   const apiKey = process.env.ZKAGI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;
//   if (!apiKey) throw new Error('Signal API key missing (ZKAGI_API_KEY).');

//   const r = await fetch('https://zynapse.zkagi.ai/today', {
//     method: 'GET',
//     headers: { accept: 'application/json', 'api-key': apiKey },
//   });
//   if (!r.ok) throw new Error(`Signal API ${r.status}`);

//   const j = await r.json();
//   // The feed is: { forecast_today_hourly: { BTC: [ ... ] } }
//   const btcArr = j?.forecast_today_hourly?.BTC;
//   if (!Array.isArray(btcArr) || btcArr.length === 0) {
//     return { ok: false, reason: 'No BTC array in forecast_today_hourly' };
//   }
//   const slot = btcArr[btcArr.length - 1];
//   if (!slot || !slot.signal || !slot.forecast_price) {
//     return { ok: false, reason: 'BTC slot missing required fields' };
//   }
//   const sigHash = hashSignal({
//     signal: slot.signal,
//     forecast_price: slot.forecast_price,
//     ts: slot.time || Math.floor(Date.now() / 3600000),
//   });

//   return { ok: true, slot, sigHash, ts: Date.now() };
// }

// module.exports = async function tradeNow(ctx) {
//   try {
//     // 1) Try your existing helper first
//     let s = await fetchLatestSignal();

//     // 2) If it says "no usable signal", fall back to direct BTC parsing
//     if (!s.ok) {
//       console.warn('trade_now: primary signal fetch said:', s.reason || s.error);
//       s = await fetchLatestBtcSlotFallback();
//       if (!s.ok) return ctx.reply(`⚠️ Could not fetch BTC signal: ${s.reason || 'unknown'}`);
//     }

//     const slot = s.slot;
//     const sigHash = s.sigHash || hashSignal(slot);

//     console.log('🧠 Using BTC slot:', JSON.stringify(slot));

//     // HOLD → stop
//     if (slot.signal === 'HOLD') {
//       return ctx.reply('⏸️ Latest signal is HOLD — no trade.');
//     }

//     // 3) Dedupe per user on sigHash
//     const col = await users();
//     const u = await col.findOne(
//       { telegramId: String(ctx.from.id) },
//       { projection: { lastExecuted: 1 } }
//     );
//     const already =
//       u?.lastExecuted &&
//       u.lastExecuted.hash === sigHash &&
//       u.lastExecuted.signal === slot.signal;

//     if (already) {
//       return ctx.reply('⚪ This signal already executed for you. Waiting for the next one.');
//     }

//     // 4) Place the trade (per-user secret via ROFL inside openFromSignal)
//     const exec = await openFromSignal(ctx.from.id, slot);

//     const msg = [
//       '✅ *Order Submitted*',
//       `• Side: ${exec.side}`,
//       `• Size: ${exec.size}`,
//       `• Leverage: ${exec.leverage}x`,
//       `• User: \`${shortAddr(exec.address)}\`${exec.orderId ? `\n• OrderId: ${exec.orderId}` : ''}`
//     ].join('\n');
//     await ctx.reply(msg, { parse_mode: 'Markdown' });

//     // 5) Mark as executed so we don’t repeat same slot
//     await col.updateOne(
//       { telegramId: String(ctx.from.id) },
//       {
//         $set: {
//           lastExecuted: {
//             hash: sigHash,
//             symbol: 'BTC',
//             signal: slot.signal,
//             time: slot.time || null,
//             at: Date.now(),
//           },
//         },
//       },
//       { upsert: true }
//     );

//     // 6) Optional: store encrypted strategy on-chain
//     try {
//       const u2 = await col.findOne({ telegramId: String(ctx.from.id) }, { projection: { agentId: 1 } });
//       const agentId = u2?.agentId;
//       if (agentId && process.env.STRATEGY_STORE_ADDRESS) {
//         const strategy = {
//           t: Date.now(),
//           source: 'ZkAGI-latest',
//           slot,
//           executed: { side: exec.side, size: exec.size, leverage: exec.leverage },
//         };
//         const tx = await storeStrategyEncrypted({
//           telegramId: ctx.from.id,
//           agentId,
//           strategyJson: strategy,
//         });
//         await ctx.reply(`🔒 Strategy saved on-chain (tx: \`${tx.slice(0,10)}…\`)`, { parse_mode: 'Markdown' });
//       }
//     } catch (e) {
//       console.warn('storeStrategyEncrypted warn:', e.message);
//     }
//   } catch (e) {
//     console.error('trade_now error:', e);
//     await ctx.reply('❌ Trade failed: ' + (e.message || 'unknown'));
//   }
// };

// bot/commands/trade_now.js
const fetch = require('node-fetch');
const { fetchLatestSignal, hashSignal } = require('../../packages/lib/signal');
const { openFromSignal } = require('../../packages/lib/hlTrade');
const { users } = require('../../packages/lib/db');
const { storeStrategyEncrypted } = require('../../packages/lib/strategyStore');

function shortAddr(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; }

// Fallback: read latest BTC slot directly from feed when signal.js can't
async function fetchLatestBtcSlotFallback() {
  const apiKey = process.env.ZKAGI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;
  if (!apiKey) throw new Error('Signal API key missing (ZKAGI_API_KEY).');

  const r = await fetch('https://zynapse.zkagi.ai/today', {
    method: 'GET',
    headers: { accept: 'application/json', 'api-key': apiKey },
  });
  if (!r.ok) throw new Error(`Signal API ${r.status}`);

  const j = await r.json();
  const btcArr = j?.forecast_today_hourly?.BTC;
  if (!Array.isArray(btcArr) || btcArr.length === 0) {
    return { ok: false, reason: 'No BTC array in forecast_today_hourly' };
  }
  const slot = btcArr[btcArr.length - 1];
  if (!slot || !slot.signal || !slot.forecast_price) {
    return { ok: false, reason: 'BTC slot missing required fields' };
  }
  const sigHash = hashSignal({
    signal: slot.signal,
    forecast_price: slot.forecast_price,
    ts: slot.time || Math.floor(Date.now() / 3600000),
  });

  return { ok: true, slot, sigHash, ts: Date.now() };
}

module.exports = async function tradeNow(ctx) {
  let typingTimer;
  let placeholder;
  try {
    // keep UI reactive
    typingTimer = setInterval(() => {
      ctx.replyWithChatAction('typing').catch(() => {});
    }, 2000);

    // show placeholder immediately
    placeholder = await ctx.reply('🚦 Checking BTC signal and preparing trade…');

    // 1) Try your existing helper first
    let s = await fetchLatestSignal();

    // 2) If it says "no usable signal", fall back to direct BTC parsing
    if (!s.ok) {
      console.warn('trade_now: primary signal fetch said:', s.reason || s.error);
      s = await fetchLatestBtcSlotFallback();
      if (!s.ok) {
        const msg = `⚠️ Could not fetch BTC signal: ${s.reason || 'unknown'}`;
        if (placeholder) {
          await ctx.telegram.editMessageText(placeholder.chat.id, placeholder.message_id, undefined, msg);
        } else {
          await ctx.reply(msg);
        }
        return;
      }
    }

    const slot = s.slot;
    const sigHash = s.sigHash || hashSignal(slot);

    console.log('🧠 Using BTC slot:', JSON.stringify(slot));

    // HOLD → stop
    if (slot.signal === 'HOLD') {
      const msg = '⏸️ Latest signal is HOLD — no trade.';
      if (placeholder) {
        await ctx.telegram.editMessageText(placeholder.chat.id, placeholder.message_id, undefined, msg);
      } else {
        await ctx.reply(msg);
      }
      return;
    }

    // 3) Dedupe per user on sigHash
    const col = await users();
    const u = await col.findOne(
      { telegramId: String(ctx.from.id) },
      { projection: { lastExecuted: 1 } }
    );
    const already =
      u?.lastExecuted &&
      u.lastExecuted.hash === sigHash &&
      u.lastExecuted.signal === slot.signal;

    if (already) {
      const msg = '⚪ This signal was already executed for you. Waiting for the next change.';
      if (placeholder) {
        await ctx.telegram.editMessageText(placeholder.chat.id, placeholder.message_id, undefined, msg);
      } else {
        await ctx.reply(msg);
      }
      return;
    }

    // 4) Place the trade (per-user secret via ROFL inside openFromSignal)
    let exec;
    try {
      exec = await openFromSignal(ctx.from.id, slot);
    } catch (err) {
      console.error('openFromSignal error:', err);
      const friendly =
        /Insufficient margin/i.test(err?.message || '')
          ? '💸 Not enough margin on Hyperliquid to open this position.'
          : '❌ Could not place the order right now.';
      if (placeholder) {
        await ctx.telegram.editMessageText(placeholder.chat.id, placeholder.message_id, undefined, friendly);
      } else {
        await ctx.reply(friendly);
      }
      return;
    }

    const lines = [
      '✅ *Order Submitted*',
      `• Side: ${exec.side}`,
      `• Size: ${exec.size}`,
      `• Leverage: ${exec.leverage}x`,
      `• User: \`${shortAddr(exec.address)}\`${exec.orderId ? `\n• OrderId: ${exec.orderId}` : ''}`,
    ];
    const okMsg = lines.join('\n');

    // 5) Mark as executed so we don’t repeat same slot
    await col.updateOne(
      { telegramId: String(ctx.from.id) },
      {
        $set: {
          lastExecuted: {
            hash: sigHash,
            symbol: 'BTC',
            signal: slot.signal,
            time: slot.time || null,
            at: Date.now(),
          },
        },
      },
      { upsert: true }
    );

    // 6) Optional: store encrypted strategy on-chain
    (async () => {
      try {
        const u2 = await col.findOne({ telegramId: String(ctx.from.id) }, { projection: { agentId: 1 } });
        const agentId = u2?.agentId;
        if (agentId && process.env.STRATEGY_STORE_ADDRESS) {
          const strategy = {
            t: Date.now(),
            source: 'ZkAGI-latest',
            slot,
            executed: { side: exec.side, size: exec.size, leverage: exec.leverage },
          };
          const tx = await storeStrategyEncrypted({
            telegramId: ctx.from.id,
            agentId,
            strategyJson: strategy,
          });
          // append a soft confirmation
          await ctx.reply(`🔒 Strategy saved on-chain (tx: \`${tx.slice(0,10)}…\`)`, { parse_mode: 'Markdown' });
        }
      } catch (e) {
        console.warn('storeStrategyEncrypted warn:', e?.message || e);
      }
    })().catch(() => {});

    // success: replace placeholder with final message
    if (placeholder) {
      await ctx.telegram.editMessageText(
        placeholder.chat.id,
        placeholder.message_id,
        undefined,
        okMsg,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply(okMsg, { parse_mode: 'Markdown' });
    }

  } catch (e) {
    console.error('trade_now error:', e);
    const msg = '⚠️ Trade could not be completed right now. Please try again in a moment.';
    try {
      if (placeholder) {
        await ctx.telegram.editMessageText(placeholder.chat.id, placeholder.message_id, undefined, msg);
      } else {
        await ctx.reply(msg);
      }
    } catch (_) {}
  } finally {
    if (typingTimer) clearInterval(typingTimer);
  }
};

