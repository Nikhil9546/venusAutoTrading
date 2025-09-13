// // bot/index.js
// require('dotenv').config();
// const { Telegraf, session } = require('telegraf');
// const {
//   startKeyboard,
//   afterStartKeyboard,
//   mainTradingKeyboard,
// } = require('./keyboard');

// // Commands
// const startCmd     = require('./commands/start');
// const connectHl    = require('./commands/connect_hl');
// const riskCmd      = require('./commands/risk');
// const portfolioCmd = require('./commands/portfolio');   // keep for /portfolio or hidden button if you want
// const tradeNow     = require('./commands/trade_now');
// const closeAll     = require('./commands/close_all');
// const checkSignal  = require('./commands/check_signal'); // optional (we’ll bind to "📊 Check Signal")

// if (!process.env.BOT_TOKEN) {
//   console.error('Missing BOT_TOKEN in .env');
//   process.exit(1);
// }

// // Disable handler timeout so long-running trades don’t get cut off.
// const bot = new Telegraf(process.env.BOT_TOKEN, { handlerTimeout: 0 });
// bot.use(session());

// // ---------- helpers ----------
// function setStage(ctx, stage) {
//   ctx.session ??= {};
//   ctx.session.stage = stage; // 'start' | 'postStart' | 'trading'
// }

// function kbForStage(stage) {
//   if (stage === 'trading') return mainTradingKeyboard();
//   if (stage === 'postStart') return afterStartKeyboard();
//   return startKeyboard();
// }

// async function showStageKb(ctx, text) {
//   const stage = ctx.session?.stage || 'start';
//   return ctx.reply(text, kbForStage(stage));
// }

// // Basic logging
// bot.use(async (ctx, next) => {
//   if (ctx.message?.text) console.log('> text:', JSON.stringify(ctx.message.text));
//   return next();
// });

// // ---------- step 1: onboard ----------
// bot.start(async (ctx) => {
//   try {
//     await startCmd(ctx);          // your existing onboarding content
//   } catch (e) {
//     console.error('start error:', e);
//   }
//   setStage(ctx, 'postStart');
//   await showStageKb(ctx, '✅ Agent is ready.\nNext: connect your Hyperliquid account.');
// });

// bot.hears(/^🧭 Onboard \/ Start$/, async (ctx) => {
//   try {
//     await startCmd(ctx);
//   } catch (e) {
//     console.error('onboard error:', e);
//   }
//   setStage(ctx, 'postStart');
//   await showStageKb(ctx, '✅ Agent is ready.\nNext: connect your Hyperliquid account.');
// });

// // ---------- step 2: connect HL + spin ----------
// bot.hears(/^🔗 Connect your Hyperliquid$/, (ctx) => {
//   try {
//     return connectHl.prompt(ctx); // shows Step 1/2/3 prompts inside this flow
//   } catch (e) {
//     console.error('connectHl.prompt error:', e);
//     return ctx.reply('⚠️ Connection issue. Please try again in a moment.', kbForStage(ctx.session?.stage));
//   }
// });

// bot.hears(/^🎡 Spin the Wheel$/, async (ctx) => {
//   // Placeholder: keep or wire to your game/bonus logic.
//   await ctx.reply('🎡 Coming soon! For now, let’s finish connecting HL to start trading.', afterStartKeyboard());
// });

// // ---------- portfolio (optional button/command) ----------
// bot.command('portfolio', (ctx) => portfolioCmd(ctx));

// // If you still want a button, uncomment:
// // bot.hears(/^📊 Portfolio$/, (ctx) => portfolioCmd(ctx));

// // ---------- step 3: trading actions (only shown after HL connect) ----------
// bot.hears(/^⚙️ Adjust Risk$/, async (ctx) => {
//   try {
//     await riskCmd.menu(ctx);
//   } catch (e) {
//     console.error('risk menu error:', e);
//     await ctx.reply('⚠️ Couldn’t open risk settings. Try again.', mainTradingKeyboard());
//   }
// });

// bot.hears(/^🚀 Trade Now \(Manual\)$/, async (ctx) => {
//   try {
//     await tradeNow(ctx);
//   } catch (e) {
//     console.error('Trade Now error:', e);
//     await ctx.reply('⚠️ Trade attempt failed. Please try again.', mainTradingKeyboard());
//     return;
//   }
//   await ctx.reply('✅ Done. What next?', mainTradingKeyboard());
// });

// bot.hears(/^🤖 Auto Trade \(Signals\)$/, async (ctx) => {
//   // If you already run a scheduler, you can toggle a user flag here.
//   try {
//     if (typeof riskCmd.enableAutoTrade === 'function') {
//       await riskCmd.enableAutoTrade(ctx);
//     } else {
//       await ctx.reply('🤖 Auto trade toggled (placeholder).', mainTradingKeyboard());
//     }
//   } catch (e) {
//     console.error('auto trade error:', e);
//     await ctx.reply('⚠️ Couldn’t update auto trade setting. Try again.', mainTradingKeyboard());
//   }
// });

// bot.hears(/^🛑 Kill All Positions$/, async (ctx) => {
//   try {
//     await closeAll(ctx);
//   } catch (e) {
//     console.error('close all error:', e);
//     await ctx.reply('⚠️ Couldn’t close positions. Try again.', mainTradingKeyboard());
//     return;
//   }
//   await ctx.reply('✅ All set. What next?', mainTradingKeyboard());
// });

// bot.hears(/^📊 Check Signal$/, async (ctx) => {
//   try {
//     if (typeof checkSignal === 'function') {
//       await checkSignal(ctx);
//     } else {
//       await ctx.reply('ℹ️ Signal check not available right now.', mainTradingKeyboard());
//     }
//   } catch (e) {
//     console.error('checkSignal error:', e);
//     await ctx.reply('⚠️ Couldn’t fetch the signal. Please try again.', mainTradingKeyboard());
//   }
// });

// // ---------- global text router (awaiting inputs for flows) ----------
// bot.on('text', async (ctx) => {
//   let consumed = false;

//   // HL connect (multi-step). Make sure connect_hl.handleText returns true when it handled a step.
//   if (typeof connectHl.handleText === 'function') {
//     try {
//       consumed = await connectHl.handleText(ctx);
//       if (consumed && ctx.session?.hlConnected) {
//         // The connect flow should set ctx.session.hlConnected = true on success.
//         setStage(ctx, 'trading');
//         await ctx.reply('✅ Your Hyperliquid account is securely connected.\nYou can adjust risk, trade manually, or enable auto trade.',
//           mainTradingKeyboard()
//         );
//         return;
//       }
//       if (consumed) return; // stay in the connect flow
//     } catch (e) {
//       console.error('connectHl.handleText error:', e);
//       await ctx.reply('⚠️ Connection issue. Please re-check the details and try again.');
//       return;
//     }
//   }

//   // Risk manual JSON (if your risk module expects JSON text)
//   if (!consumed && typeof riskCmd.handleText === 'function') {
//     try {
//       consumed = await riskCmd.handleText(ctx);
//       if (consumed) return;
//     } catch (e) {
//       console.error('risk.handleText error:', e);
//       await ctx.reply('⚠️ Couldn’t read your risk settings. Please try again.', mainTradingKeyboard());
//       return;
//     }
//   }

//   // If nothing handled: just show the current stage keyboard again.
//   await showStageKb(ctx, '👇 Use the keyboard to continue.');
// });

// // ---------- safety net ----------
// bot.catch((err, ctx) => {
//   console.error('Telegraf error for', ctx.updateType, err);
// });

// // ---------- launch ----------
// bot.launch().then(() => console.log('🤖 Bot is live (layered menus).'));

// bot/index.js
// bot/index.js
require('dotenv').config();
const { Telegraf, session } = require('telegraf');

const { setupKeyboard, tradingKeyboard } = require('./keyboard');

const startCmd     = require('./commands/start');
const connectHl    = require('./commands/connect_hl');
const riskCmd      = require('./commands/risk');
const portfolioCmd = require('./commands/portfolio');
const tradeNow     = require('./commands/trade_now');
const closeAll     = require('./commands/close_all');
const checkSignal  = require('./commands/check_signal'); // optional

if (!process.env.BOT_TOKEN) {
  console.error('Missing BOT_TOKEN in .env');
  process.exit(1);
}

// No handler timeout so long ops don’t get cut off
// const bot = new Telegraf(process.env.BOT_TOKEN, { handlerTimeout: 0 });
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

// basic log
bot.use(async (ctx, next) => {
  if (ctx.message?.text) console.log('> text:', JSON.stringify(ctx.message.text));
  return next();
});

// helpers
function setStage(ctx, stage) {
  ctx.session ??= {};
  ctx.session.stage = stage;
}
function sendSetup(ctx, text) {
  return ctx.reply(text, { reply_markup: setupKeyboard() });
}
function sendTrading(ctx, text) {
  return ctx.reply(text, { reply_markup: tradingKeyboard() });
}

/* ------------------------------- START ---------------------------------- */

bot.start(async (ctx) => {
  try {
    // your existing onboarding text (safe if it throws)
    await Promise.resolve(startCmd(ctx)).catch((e) => {
      console.warn('startCmd warn:', e?.message || e);
    });

    // decide stage based on DB
    let connected = false;
    try {
      connected = await connectHl.isConnected(ctx.from.id);
    } catch (e) {
      console.warn('isConnected warn:', e?.message || e);
    }

    if (connected) {
      setStage(ctx, 'trading');
      return sendTrading(ctx, '✅ Welcome back. Your Hyperliquid is connected.');
    } else {
      setStage(ctx, 'setup');
      return sendSetup(ctx, '👇 Let’s begin. Connect your Hyperliquid to continue.');
    }
  } catch (e) {
    console.error('start fatal:', e);
    // absolute fallback so user always sees something
    setStage(ctx, 'setup');
    return sendSetup(ctx, '👋 Hi! Use the buttons below to continue.');
  }
});

// Also handle the “Onboard / Start” keyboard button
bot.hears(/^🧭 Onboard \/ Start$/, async (ctx) => {
  try {
    await Promise.resolve(startCmd(ctx)).catch(() => {});
    const connected = await connectHl.isConnected(ctx.from.id).catch(() => false);
    if (connected) {
      setStage(ctx, 'trading');
      return sendTrading(ctx, '✅ You are already connected.');
    }
    setStage(ctx, 'setup');
    return sendSetup(ctx, '👇 Use the buttons to continue.');
  } catch {
    setStage(ctx, 'setup');
    return sendSetup(ctx, '👇 Use the buttons to continue.');
  }
});

/* ---------------------------- SETUP ACTIONS ----------------------------- */
bot.hears(/^🔗 Connect HL$/, (ctx) => connectHl.prompt(ctx));

/* --------------------------- TRADING ACTIONS ---------------------------- */
bot.hears(/^📊 Portfolio$/, (ctx) => portfolioCmd(ctx));

bot.hears(/^⚙️ Adjust Risk$/, (ctx) => riskCmd.menu(ctx));
bot.hears(/^⚡ Use Default \(ZkAGI\)$/, async (ctx) => {
  await riskCmd.useDefaultCmd(ctx);
  return sendTrading(ctx, '✅ Default risk applied.');
});
bot.hears(/^✍️ Manual Setup$/, (ctx) => riskCmd.manualSetup(ctx));

bot.hears(/^🚀 Trade Now$/, async (ctx) => {
  await tradeNow(ctx);
  return sendTrading(ctx, '✅ Done. What next?');
});

bot.hears(/^🛑 Kill All Positions$/, async (ctx) => {
  await closeAll(ctx);
  return sendTrading(ctx, '✅ All positions closed (where possible).');
});

bot.hears(/^🔄 Check Signal$/, (ctx) => checkSignal?.(ctx));

/* --------------------------- SPIN THE WHEEL ----------------------------- */
bot.hears(/^🎰 Spin the Wheel$/, async (ctx) => {
  const outcomes = ['+5% risk boost (temp)', '−5% risk (safer)', 'Free 🍩', 'Try again!'];
  const pick = outcomes[Math.floor(Math.random() * outcomes.length)];
  const text = `🎡 You spun the wheel… *${pick}*`;
  const stage = ctx.session?.stage === 'trading' ? 'trading' : 'setup';
  return stage === 'trading' ? sendTrading(ctx, text) : sendSetup(ctx, text);
});

/* ------------------------ AWAITED TEXT ROUTER --------------------------- */
bot.on('text', async (ctx) => {
  // HL connect steps
  const usedHL = await connectHl.handleText(ctx);
  if (usedHL) {
    if (ctx.session?.hlConnected) {
      setStage(ctx, 'trading');
      return sendTrading(ctx, '✅ Hyperliquid connected. Choose an action below.');
    }
    return;
  }

  // Risk JSON
  if (typeof riskCmd.handleText === 'function') {
    const usedRisk = await riskCmd.handleText(ctx);
    if (usedRisk) return;
  }

  // not handled -> keep current stage visible
  const stage = ctx.session?.stage === 'trading' ? 'trading' : 'setup';
  return stage === 'trading'
    ? sendTrading(ctx, '👇 Use the keyboard to continue.')
    : sendSetup(ctx, '👇 Use the keyboard to continue.');
});

bot.catch((err, ctx) => {
  console.error('Telegraf error for', ctx.updateType, err);
});

bot.launch().then(() => console.log('🤖 Bot is live with staged keyboards.'));


