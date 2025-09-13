// bot/commands/start.js
const { users } = require('../../packages/lib/db');
const { mainKeyboard } = require('../keyboard');
const { ensureAgentForUser, computeAgentId } = require('../../packages/lib/agentRegistry');

module.exports = async function start(ctx) {
  const telegramId = String(ctx.from.id);
  const col = await users();

  // Ensure user doc exists
  let u = await col.findOne({ telegramId });
  if (!u) {
    u = {
      telegramId,
      agentId: null,              // will be set after chain create
      hlAddress: '',
      hlMainAddress: '',
      hlSecretCipher: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await col.insertOne(u);
  }

  // Try to register on-chain (or fetch existing)
  let created = false, agentId, txHash, extraNote = '';
  try {
    const meta = { uri: JSON.stringify({ tgid: telegramId, createdAt: Date.now() }) };
    const res = await ensureAgentForUser(telegramId, meta);
    created = !!res.created;
    agentId = res.agentId;
    txHash  = res.txHash;
  } catch (e) {
    // If role missing or RPC issue, don’t block UX — fall back to local deterministic id
    agentId = u.agentId || computeAgentId(telegramId);
    await col.updateOne({ telegramId }, { $set: { agentId, updatedAt: new Date() } });

    const msg = (e && (e.message || String(e))) || '';
    if (/AccessControl|missing role|MANAGER_ROLE/i.test(msg)) {
      extraNote = '\n\n⚠️ I could not create your agent on-chain because my bot wallet is missing the **MANAGER_ROLE** on AgentRegistry. Please grant it and try /start again.';
    } else {
      extraNote = '\n\n⚠️ I could not reach the registry RPC right now. I saved a local AgentID so you can continue. You can re-run /start later to finalize on-chain.';
    }
  }

  // Reply
  const lines = [
    '👋 Welcome!',
    created
      ? `🧾 Agent created on-chain.\n• AgentID: \`${agentId}\`\n• Tx: \`${txHash?.slice(0,10)}…\``
      : `🧾 Agent ready.\n• AgentID: \`${agentId}\``,
    '👇 Next: tap **Connect HL** to link your Hyperliquid account securely (keys are encrypted in ROFL).',
  ];
  if (extraNote) lines.push(extraNote);

  await ctx.reply(lines.join('\n'), {
    parse_mode: 'Markdown',
    reply_markup: mainKeyboard().reply_markup,
  });
};

