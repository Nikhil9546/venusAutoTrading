// server/web.js
require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const { users } = require('../packages/lib/db');
const { roflEncrypt } = require('../bot/roflClient');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const BASE = process.env.PUBLIC_BASE_URL || 'http://localhost:8080';
const PORT = Number(process.env.WEB_PORT || 8080);

// simple in-memory token store (valid 10 mins). You could persist in Mongo if you prefer.
const tokens = new Map(); // token -> { telegramId, expires }

function makeToken(telegramId) {
  const token = crypto.randomBytes(16).toString('hex');
  tokens.set(token, { telegramId: String(telegramId), expires: Date.now() + 10 * 60_000 });
  return token;
}
function takeToken(token) {
  const rec = tokens.get(token);
  if (!rec) return null;
  tokens.delete(token);
  if (Date.now() > rec.expires) return null;
  return rec.telegramId;
}

// HTML form
const html = (token, error) => `<!doctype html>
<html><head><meta charset="utf-8"><title>Connect Hyperliquid</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#0b0f1a;color:#e6edf3;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.card{background:#121826;border:1px solid #1f2a44;border-radius:16px;padding:24px;max-width:520px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.3)}
h1{font-size:22px;margin:0 0 8px} p{opacity:.85}
label{display:block;margin:14px 0 6px} input{width:100%;padding:12px;border-radius:10px;border:1px solid #2a3658;background:#0e1424;color:#e6edf3}
button{margin-top:18px;padding:12px 16px;border-radius:10px;background:#3b82f6;color:white;border:none;cursor:pointer}
.note{font-size:12px;opacity:.8;margin-top:8px}
.err{color:#ff8b8b;margin-bottom:10px}
.success{color:#6ee7b7}
</style></head>
<body><div class="card">
<h1>Connect Hyperliquid</h1>
<p>Enter your <b>API Wallet Address</b>, <b>API Key</b> and <b>API Secret</b>. We encrypt in your ROFL enclave and never store plaintext.</p>
${error ? `<div class="err">${error}</div>` : ''}
<form method="post" action="/connect/${token}">
  <label>Hyperliquid API Wallet Address</label>
  <input name="hlAddress" placeholder="0x..." required />
  <label>Hyperliquid API Key</label>
  <input name="hlApiKey" placeholder="hlpk_..." required />
  <label>Hyperliquid API Secret</label>
  <input name="hlSecret" placeholder="••••••••" required />
  <button type="submit">Save Securely</button>
  <div class="note">Tip: This page works for 10 minutes. You can close it once saved.</div>
</form>
</div></body></html>`;

// 1) Bot will create token; user opens this page
app.get('/connect/:token', (req, res) => {
  const { token } = req.params;
  if (!tokens.has(token)) return res.status(400).send(html('', 'Invalid or expired link. Ask the bot again.'));
  return res.send(html(token));
});

// 2) Form submission → ROFL encrypt → save in Mongo
app.post('/connect/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const telegramId = takeToken(token);
    if (!telegramId) return res.status(400).send(html('', 'Invalid or expired link.'));

    const { hlAddress, hlApiKey, hlSecret } = req.body;
    if (!hlAddress || !hlApiKey || !hlSecret) return res.status(400).send(html(token, 'All fields are required.'));

    // Encrypt the apiKey & secret with ROFL (per-user id = telegramId)
    const [apiKeyCipher, secretCipher] = await Promise.all([
      roflEncrypt(String(telegramId), String(hlApiKey)),
      roflEncrypt(String(telegramId), String(hlSecret)),
    ]);

    const col = await users();
    await col.updateOne(
      { telegramId: String(telegramId) },
      {
        $set: {
          hlAddress: String(hlAddress).trim(),
          hlApiKeyCipher: apiKeyCipher,         // { iv, tag, ciphertext }
          hlSecretCipher: secretCipher,         // { iv, tag, ciphertext }
          hlConnectedAt: new Date()
        }
      },
      { upsert: true }
    );

    res.send(`<!doctype html><html><body style="background:#0b0f1a;color:#e6edf3;font-family:system-ui;padding:32px">
      <h2 class="success">✅ Saved securely!</h2>
      <p>You can now return to Telegram and press <b>Portfolio</b> or <b>Trade Now</b>.</p>
    </body></html>`);
  } catch (e) {
    console.error('web connect error:', e);
    res.status(500).send(html('', 'Server error. Try again.'));
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Connect server on ${BASE} (PORT ${PORT})`);
});

module.exports = { makeToken };

