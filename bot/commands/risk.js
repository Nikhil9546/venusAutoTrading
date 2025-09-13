// bot/commands/risk.js
const { setRisk, getRisk, useDefault, formatRisk } = require('../../packages/lib/risk');

async function menu(ctx) {
  const r = await getRisk(ctx.from.id);
  const msg = r ? formatRisk(r) : '⚠️ No risk setup yet.';
  await ctx.reply(
    msg + '\n\nChoose:\n• Default ZkAGI setup\n• Manual setup',
    {
      reply_markup: {
        keyboard: [
          [{ text: '⚡ Use Default (ZkAGI)' }],
          [{ text: '✍️ Manual Setup' }],
          [{ text: '⬅️ Back' }]
        ],
        resize_keyboard: true
      },
      parse_mode: 'Markdown'
    }
  );
}

async function useDefaultCmd(ctx) {
  const r = await useDefault(ctx.from.id);
  await ctx.reply('✅ Applied default ZkAGI risk.\n\n' + formatRisk(r), { parse_mode: 'Markdown' });
}

async function manualSetup(ctx) {
  ctx.session ??= {};
  ctx.session.await = 'risk_manual';
  await ctx.reply('✍️ Send your risk parameters as JSON:\n```json\n{\n "capitalUsagePercent":0.25,\n "maxLeverage":20,\n "minLeverage":5,\n "maxProfit":80,\n "quickProfit":40,\n "maxLoss":15,\n "dayLoss":80\n}\n```', { parse_mode: 'Markdown' });
}

async function handleText(ctx) {
  if (!ctx.session || ctx.session.await !== 'risk_manual') return;
  try {
    const obj = JSON.parse(ctx.message.text);
    await setRisk(ctx.from.id, obj);
    ctx.session.await = null;
    await ctx.reply('✅ Risk strategy saved.\n\n' + formatRisk(obj), { parse_mode: 'Markdown' });
  } catch (e) {
    await ctx.reply('❌ Invalid JSON. Try again.');
  }
}

module.exports = { menu, useDefaultCmd, manualSetup, handleText };

