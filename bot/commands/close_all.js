// bot/commands/close_all.js
const { closeAll } = require('../../packages/lib/hlTrade');


module.exports = async function closeAllCmd(ctx) {
try {
const r = await closeAll(ctx.from.id);
await ctx.reply(`🛑 Closed ${r.closed} positions.`);
} catch (e) {
console.error('close_all error:', e);
await ctx.reply('❌ Close failed: ' + (e.message || 'unknown'));
}
};
