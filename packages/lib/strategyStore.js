// packages/lib/strategyStore.js
// Save strategy JSON on-chain via StrategyStore: bytes payload = iv|tag|ciphertext


const { ethers } = require('ethers');
const { roflEncrypt } = require('../../bot/roflClient');


const STRATEGY_STORE_ABI = [
'function storeStrategy(bytes32 id, bytes payload) external'
];


function toBytes(b64) { return Buffer.from(b64, 'base64'); }


async function storeStrategyEncrypted({ telegramId, agentId, strategyJson }) {
const rpc = process.env.RPC_URL;
const pk = process.env.PRIVATE_KEY; // deployer/bot key with rights to call contract
const strategyAddr = process.env.STRATEGY_STORE_ADDRESS;
if (!rpc || !pk || !strategyAddr) throw new Error('RPC_URL/PRIVATE_KEY/STRATEGY_STORE_ADDRESS required');


const provider = new ethers.providers.JsonRpcProvider(rpc);
const wallet = new ethers.Wallet(pk, provider);
const store = new ethers.Contract(strategyAddr, STRATEGY_STORE_ABI, wallet);


// 1) ROFL-encrypt
const enc = await roflEncrypt(String(telegramId), JSON.stringify(strategyJson));
// enc: { iv, tag, ciphertext } (all base64)


const payload = Buffer.concat([ toBytes(enc.iv), toBytes(enc.tag), toBytes(enc.ciphertext) ]);


// 2) send tx
const tx = await store.storeStrategy(agentId, '0x' + payload.toString('hex'));
const rc = await tx.wait();
return rc.transactionHash;
}


module.exports = { storeStrategyEncrypted };
