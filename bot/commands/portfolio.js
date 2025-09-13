// // bot/commands/portfolio.js
// const { buildPortfolioMessage } = require('../../packages/lib/hl');

// module.exports = async function portfolio(ctx) {
//   try {
//     await ctx.sendChatAction('typing');
//     const msg = await buildPortfolioMessage(ctx.from.id);
//     await ctx.reply(msg, { parse_mode: 'Markdown' });
//   } catch (e) {
//     console.error('portfolio error:', e);
//     const reason = (e && e.message) ? e.message : 'Failed to load portfolio.';
//     await ctx.reply('❌ ' + reason);
//   }
// };

// bot/commands/portfolio.js
const { buildPortfolioMessage } = require('../../packages/lib/hl');

module.exports = async function portfolio(ctx) {
  // show a “typing…” action while we fetch
  let typingTimer;
  try {
    typingTimer = setInterval(() => {
      // fire and forget, ignore errors
      ctx.replyWithChatAction('typing').catch(() => {});
    }, 2000);

    // immediate placeholder so user sees something right away
    const placeholder = await ctx.reply('⏳ Fetching your Hyperliquid portfolio…');

    // build final message
    const text = await buildPortfolioMessage(ctx.from.id);

    // replace the placeholder with the final, nicely formatted output
    await ctx.telegram.editMessageText(
      placeholder.chat.id,
      placeholder.message_id,
      undefined,
      text,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('portfolio error:', e);
    // friendly message only; no raw stack/URLs/tokens
    const msg = '⚠️ Couldn’t load your portfolio right now. Please try again in a moment.';
    try {
      await ctx.reply(msg);
    } catch (_) {}
  } finally {
    if (typingTimer) clearInterval(typingTimer);
  }
};


