import express from 'express';

const app = express();
app.use(express.json({ limit: '256kb' }));

const SIDE = process.env.SIDECAR_URL || 'http://crypto:8081';

const b64 = (buf) => Buffer.from(buf).toString('base64');
const ub64 = (s)   => Buffer.from(s, 'base64');

async function post(path, body) {
  const res = await fetch(`${SIDE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Public API (what your bot will call through the ROFL gateway)
app.post('/v1/apps/:appId/encrypt', async (req, res) => {
  try {
    const { userId, plaintext } = req.body || {};
    if (!userId || !plaintext) return res.status(400).json({ error: 'userId & plaintext required' });
    const out = await post('/encrypt', { userId: String(userId), plaintext });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'encrypt failed' });
  }
});

app.post('/v1/apps/:appId/decrypt', async (req, res) => {
  try {
    const { userId, iv, tag, ciphertext } = req.body || {};
    if (!userId || !iv || !tag || !ciphertext) return res.status(400).json({ error: 'missing field' });
    const out = await post('/decrypt', { userId: String(userId), iv, tag, ciphertext });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'decrypt failed' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('node-api listening on', PORT));

