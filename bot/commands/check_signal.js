// // bot/commands/check_signal.js
// const fetch = require('node-fetch');
// const { users } = require('../../packages/lib/db');

// const SIGNAL_SYMBOL = 'BTC';

// async function fetchLatestBtcSlot() {
//   const key = process.env.ZKAGI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;
//   if (!key) throw new Error('Missing ZKAGI_API_KEY');

//   const res = await fetch('https://zynapse.zkagi.ai/today', {
//     headers: {
//       accept: 'application/json',
//       'api-key': key,
//       'cache-control': 'no-cache',
//     },
//   });

//   if (!res.ok) throw new Error(`Signal API HTTP ${res.status}`);
//   const j = await res.json();

//   // New schema: object of arrays by symbol
//   const book = j?.forecast_today_hourly;
//   if (!book || !Array.isArray(book[SIGNAL_SYMBOL]) || book[SIGNAL_SYMBOL].length === 0) {
//     return null;
//   }
//   const arr = book[SIGNAL_SYMBOL];
//   const last = arr[arr.length - 1];
//   return {
//     symbol: SIGNAL_SYMBOL,
//     time: last.time,
//     signal: last.signal,
//     entry_price: last.entry_price,
//     forecast_price: last.forecast_price,
//     stop_loss: last.stop_loss,
//     take_profit: last.take_profit,
//     confidence_90: last.confidence_90,
//   };
// }

// async function checkSignal(ctx) {
//   try {
//     const slot = await fetchLatestBtcSlot();
//     if (!slot) {
//       await ctx.reply('ℹ️ No BTC signal available right now.');
//       return;
//     }

//     // Log to console for you
//     console.log(`[SIGNAL] ${slot.symbol} @ ${slot.time}  signal=${slot.signal}  fpx=${slot.forecast_price}  entry=${slot.entry_price}`);

//     // Compare with user's last seen to decide if it's new/changed
//     const col = await users();
//     const userId = String(ctx.from.id);
//     const user = await col.findOne({ telegramId: userId }, { projection: { lastSignal: 1 } });

//     const prev = user?.lastSignal?.[slot.symbol];
//     const changed =
//       !prev ||
//       prev.time !== slot.time ||
//       prev.signal !== slot.signal;

//     // Save as last seen for this user
//     await col.updateOne(
//       { telegramId: userId },
//       {
//         $set: {
//           telegramId: userId,
//           [`lastSignal.${slot.symbol}`]: {
//             time: slot.time,
//             signal: slot.signal,
//             forecast_price: slot.forecast_price,
//           },
//           updatedAt: new Date(),
//         },
//       },
//       { upsert: true }
//     );

//     // Tell the user
//     const msg =
//       `🧠 *Latest ${slot.symbol} signal*\n` +
//       `• Time: \`${slot.time}\`\n` +
//       `• Signal: *${slot.signal}*\n` +
//       `• Forecast: ${slot.forecast_price}\n` +
//       `• Entry: ${slot.entry_price}\n` +
//       `• SL / TP: ${slot.stop_loss} / ${slot.take_profit}\n` +
//       (changed ? `\n🟢 _This is new or changed since your last check._` : `\n⚪ _Unchanged since your last check._`);

//     await ctx.reply(msg, { parse_mode: 'Markdown' });
//   } catch (e) {
//     console.error('checkSignal error:', e);
//     await ctx.reply('❌ Could not fetch the signal right now.');
//   }
// }

// module.exports = checkSignal;

const fetch = require('node-fetch');
const { users } = require('../../packages/lib/db');

// ------------------- Config -------------------
const SIGNAL_URL =
  process.env.AVAX_SIGNAL_URL;
const SIGNAL_SYMBOL = 'AVAX';

/**
 * Fetch the latest AVAX slot from the forecast API
 */
async function fetchLatestAvaxSlot() {
  const res = await fetch(SIGNAL_URL, {
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
  });

  if (!res.ok) throw new Error(`Signal API HTTP ${res.status}`);
  const j = await res.json();

  // Expecting: { hour_start_utc, avax_forecast: { ... } }
  const slot = j?.avax_forecast;
  if (!slot || !slot.signal || !slot.forecast_price) return null;

  return {
    symbol: SIGNAL_SYMBOL,
    time: slot.time,
    signal: slot.signal,
    entry_price: slot.entry_price,
    forecast_price: slot.forecast_price,
    stop_loss: slot.stop_loss,
    take_profit: slot.take_profit,
    confidence_90: slot.confidence_90,
  };
}

/**
 * Telegraf handler for “Check Signal”
 */
async function checkSignal(ctx) {
  try {
    const slot = await fetchLatestAvaxSlot();
    if (!slot) {
      await ctx.reply('ℹ️ No AVAX signal available right now.');
      return;
    }

    console.log(
      `[SIGNAL] ${slot.symbol} @ ${slot.time}  signal=${slot.signal}  fpx=${slot.forecast_price}  entry=${slot.entry_price}`
    );

    // Compare with user's last seen to decide if it's new/changed
    const col = await users();
    const userId = String(ctx.from.id);
    const user = await col.findOne({ telegramId: userId }, { projection: { lastSignal: 1 } });

    const prev = user?.lastSignal?.[slot.symbol];
    const changed = !prev || prev.time !== slot.time || prev.signal !== slot.signal;

    // Save as last seen
    await col.updateOne(
      { telegramId: userId },
      {
        $set: {
          telegramId: userId,
          [`lastSignal.${slot.symbol}`]: {
            time: slot.time,
            signal: slot.signal,
            forecast_price: slot.forecast_price,
          },
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    const msg =
      `🧠 *Latest ${slot.symbol} signal*\n` +
      `• Time: \`${slot.time}\`\n` +
      `• Signal: *${slot.signal}*\n` +
      `• Forecast: ${slot.forecast_price}\n` +
      `• Entry: ${slot.entry_price}\n` +
      `• SL / TP: ${slot.stop_loss} / ${slot.take_profit}\n` +
      (changed
        ? `\n🟢 _This is new or changed since your last check._`
        : `\n⚪ _Unchanged since your last check._`);

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error('checkSignal error:', e);
    await ctx.reply('❌ Could not fetch the AVAX signal right now.');
  }
}

module.exports = checkSignal;

