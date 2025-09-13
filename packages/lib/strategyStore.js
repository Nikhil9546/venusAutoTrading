// packages/lib/strategyStore.js
// Encrypt a strategy via ROFL and store it on-chain in StrategyStore.
// Ethers v5 compatible (also works in v6 via simple detection).

require('dotenv').config();
const { roflEncrypt } = require('../../bot/roflClient');
const ethersLib = require('ethers'); // v5 or v6

// Detect ethers v6 vs v5
const isV6 = !!ethersLib?.AbstractProvider || (!!ethersLib?.Wallet && !ethersLib?.providers);
const JsonRpcProvider = isV6 ? ethersLib.JsonRpcProvider : ethersLib.providers.JsonRpcProvider;
const Wallet          = ethersLib.Wallet;
const Contract        = ethersLib.Contract;

const RPC_URL = process.env.RPC_URL || process.env.RPC_FUJI || process.env.RPC_AVALANCHE || process.env.ANVIL_RPC;
const PK      = process.env.PRIVATE_KEY;
const STORE   = process.env.STRATEGY_STORE_ADDRESS;

// Minimal ABI
const STRATEGY_STORE_ABI = [
  'function storeStrategy(bytes32 agentId, bytes payload) external',
];

// --- helpers ---
function req(name, val) { if (!val) throw new Error(`Missing env ${name}`); return val; }
function isHexBytes32(x){ return typeof x === 'string' && /^0x[0-9a-fA-F]{64}$/.test(x); }
function isAddr(x){ return typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x); }

// Decode ROFL parts (base64) → Buffer and pack as raw bytes
function packAesGcmB64({ iv, tag, ciphertext }) {
  const ivB  = Buffer.from(iv, 'base64');
  const tagB = Buffer.from(tag, 'base64');
  const ctB  = Buffer.from(ciphertext, 'base64');

  if (ivB.length !== 12)  throw new Error(`Invalid IV length ${ivB.length}, expected 12`);
  if (tagB.length !== 16) throw new Error(`Invalid tag length ${tagB.length}, expected 16`);
  if (ctB.length === 0)   throw new Error('Empty ciphertext');

  return Buffer.concat([ivB, tagB, ctB]); // layout expected by your contract
}

/**
 * storeStrategyEncrypted({ telegramId, agentId, strategyJson })
 *  - Encrypts strategyJson via ROFL per-user key
 *  - Stores raw bytes (iv|tag|ciphertext) into StrategyStore
 *  - Returns tx hash
 */
async function storeStrategyEncrypted({ telegramId, agentId, strategyJson }) {
  try {
    req('PRIVATE_KEY', PK);
    req('STRATEGY_STORE_ADDRESS', STORE);
    req('RPC_URL', RPC_URL);

    if (!isAddr(STORE)) throw new Error(`STRATEGY_STORE_ADDRESS invalid: ${STORE}`);

    // Normalize agentId
    let id = String(agentId || '');
    if (!id.startsWith('0x')) id = '0x' + id;
    if (!isHexBytes32(id)) throw new Error(`agentId must be 0x + 64 hex chars. Got: ${id}`);

    // 1) Encrypt with ROFL
    const plaintext = JSON.stringify(strategyJson ?? {});
    const enc = await roflEncrypt(String(telegramId), plaintext); // { iv, tag, ciphertext } (base64 strings)

    // 2) Build raw payload
    const payloadBuf = packAesGcmB64(enc);

    // 3) Provider / signer / contract
    const provider = new JsonRpcProvider(RPC_URL);
    const signer   = new Wallet(PK, provider);
    const store    = new Contract(STORE, STRATEGY_STORE_ABI, signer);

    // 4) Send tx (with graceful gas fallback)
    let overrides = {};
    try {
      const est = await store.estimateGas.storeStrategy(id, payloadBuf);
      overrides = { gasLimit: est.mul(120).div(100) };
    } catch (_) {
      // estimation can fail on some RPCs even if tx will succeed; proceed without override
    }

    const tx = await store.storeStrategy(id, payloadBuf, overrides);
    const rc = await tx.wait(1);
    return rc.transactionHash;
  } catch (err) {
    throw new Error(`storeStrategyEncrypted failed: ${err.reason || err.message || String(err)}`);
  }
}

module.exports = { storeStrategyEncrypted };

