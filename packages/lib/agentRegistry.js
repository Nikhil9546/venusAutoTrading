// packages/lib/agentRegistry.js
require('dotenv').config();
const { ethers } = require('ethers');
const { users } = require('./db');

const REGISTRY_ADDR = process.env.AGENT_REGISTRY_ADDRESS;
const RPC           = process.env.RPC_FUJI || process.env.RPC_URL || process.env.RPC_AVALANCHE;
const BOT_PK        = process.env.PRIVATE_KEY;

// --- ethers v5/v6 compatibility ---
function makeProvider(url) {
  if (ethers.providers?.JsonRpcProvider) return new ethers.providers.JsonRpcProvider(url); // v5
  if (ethers.JsonRpcProvider) return new ethers.JsonRpcProvider(url);                       // v6
  throw new Error('Unsupported ethers version: cannot create provider');
}

function keccak256AbiEncodeString(str) {
  if (ethers.utils?.defaultAbiCoder && ethers.utils?.keccak256) {
    const enc = ethers.utils.defaultAbiCoder.encode(['string'], [str]);                     // v5
    return ethers.utils.keccak256(enc);
  }
  if (ethers.AbiCoder && ethers.keccak256) {
    const enc = ethers.AbiCoder.defaultAbiCoder().encode(['string'], [str]);               // v6
    return ethers.keccak256(enc);
  }
  throw new Error('Unsupported ethers version: cannot abi-encode/keccak');
}

function getSigner() {
  if (!RPC) throw new Error('RPC_URL / RPC_FUJI missing in env');
  if (!BOT_PK) throw new Error('PRIVATE_KEY missing in env');
  return new ethers.Wallet(BOT_PK, makeProvider(RPC));
}

function getRegistry() {
  if (!REGISTRY_ADDR) throw new Error('AGENT_REGISTRY_ADDRESS missing in env');
  const ABI = ['function createAgent(bytes32 agentID, string uri)'];
  return new ethers.Contract(REGISTRY_ADDR, ABI, getSigner());
}

/** Deterministic bytes32 from Telegram ID */
function computeAgentId(telegramId) {
  return keccak256AbiEncodeString(String(telegramId));
}

/**
 * Ensure the user has an agent registered on-chain.
 * - if `agentId` exists in Mongo => returns it
 * - else => calls `createAgent` and persists
 */
async function ensureAgentForUser(telegramId, metadata = {}) {
  const col = await users();
  const query = { telegramId: String(telegramId) };
  const existing = await col.findOne(query, { projection: { agentId: 1 } });

  if (existing?.agentId) {
    return { created: false, agentId: existing.agentId };
  }

  const agentId = computeAgentId(telegramId);
  const uri = metadata?.uri || JSON.stringify({ tgid: String(telegramId), ...metadata });

  const reg = getRegistry();
  const tx  = await reg.createAgent(agentId, uri);
  const rc  = await (tx.wait ? tx.wait(1) : reg.provider.waitForTransaction(tx.hash, 1));

  await col.updateOne(query, { $set: { agentId, updatedAt: new Date() } }, { upsert: true });

  return { created: true, agentId, txHash: rc.transactionHash || rc.hash };
}

module.exports = { ensureAgentForUser, computeAgentId };

