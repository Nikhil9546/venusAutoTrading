const { users } = require('./db');
const { roflDecrypt } = require('../../bot/roflClient');
const { Hyperliquid } = require('hyperliquid');

const DEFAULTS = { allocPct:0.30, maxProfit:100, quickProfit:50, maxLoss:20, maxDailyLoss:100, minLev:5, maxLev:25, reverseSignal:true };

async function loadUserTradingContext(telegramId) {
  const col = await users();
  const u = await col.findOne({ telegramId });
  if (!u) throw new Error('User not onboarded');
  if (!u.hlSecretCipher) throw new Error('User has not connected HL secret');

  const secretBuf = await roflDecrypt(telegramId, u.hlSecretCipher.ivB64 || u.hlSecretCipher.iv,
                                               u.hlSecretCipher.tagB64 || u.hlSecretCipher.tag,
                                               u.hlSecretCipher.ctB64   || u.hlSecretCipher.ciphertext);

  const secret = secretBuf.toString('utf8');

  const sdk = new Hyperliquid({ privateKey: secret, walletAddress: u.hlAddress || undefined, testnet: false });
  const address = u.hlAddress || (sdk.walletAddress || '');
  if (!u.hlAddress && address) await col.updateOne({ telegramId }, { $set: { hlAddress: address } });

  return { telegramId, agentId: u.agentId, hlAddress: address, sdk, settings: { ...DEFAULTS, ...(u.settings||{}) } };
}

module.exports = { loadUserTradingContext };
