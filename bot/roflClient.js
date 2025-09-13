const fetch = require('node-fetch');
const BASE = process.env.ROFL_GATEWAY_URL;
const APP = process.env.ROFL_APP_ID;
if (!BASE || !APP) throw new Error('ROFL_GATEWAY_URL or ROFL_APP_ID missing in env');
async function roflEncrypt(userId, plaintext){
const r = await fetch(`${BASE}/v1/apps/${APP}/encrypt`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:String(userId), plaintext})});
if(!r.ok){const t=await r.text().catch(()=>'' ); throw new Error(`Encrypt failed ${r.status}: ${t}`)}; return r.json();
}
async function roflDecrypt(userId, iv, tag, ciphertext){
const r = await fetch(`${BASE}/v1/apps/${APP}/decrypt`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:String(userId), iv, tag, ciphertext})});
if(!r.ok){const t=await r.text().catch(()=>'' ); throw new Error(`Decrypt failed ${r.status}: ${t}`)}; return r.json();
}
module.exports = { roflEncrypt, roflDecrypt };
