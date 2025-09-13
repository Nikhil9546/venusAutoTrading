require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { loadUserTradingContext } = require('../packages/lib/userTrading');
const { runUserTradeCycle } = require('../packages/lib/tradingCycle');

const app = express();
app.use(express.json());

function verify(uid, sig) {
  if (!sig) return false;
  const mac = crypto.createHmac('sha256', process.env.BOT_API_SECRET || 'missing').update(uid).digest('hex');
  return mac === sig;
}

// Health
app.get('/health', (_, res) => res.json({ ok: true }));

// Per-user trade cycle
app.get('/trade', async (req, res) => {
  try {
    const uid = req.query.uid;
    const sig = req.header('x-task-signature');
    if (!uid) return res.status(400).json({ error: 'uid missing' });
    if (!verify(String(uid), sig)) return res.status(401).json({ error: 'bad signature' });

    const ctx = await loadUserTradingContext(String(uid));
    const out = await runUserTradeCycle(ctx);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

const port = Number(process.env.SERVER_PORT) || 4000;
app.listen(port, () => console.log(`📡 Node server listening on :${port}`));
