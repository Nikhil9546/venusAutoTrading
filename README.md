AVAX Trading Bot (TEE-secured)

A concise template for a Telegram trading bot that:
	•	Registers a per-user Agent on Avalanche.
	•	Encrypts strategies in a TEE and stores them on-chain.
	•	Trades AVAX-PERP from signals (manual or auto), with risk controls.
	•	Enforces “one agent per user” and “one execution per new signal”.

⸻

Architecture

User (Telegram)
   │
   ▼
Bot (Telegraf, Node)
   │ 1) Register agent (once)
   │ 2) Fetch AVAX signal
   │ 3) Encrypt strategy (TEE)
   │
   ├── Avalanche (C-Chain)
   │    ├─ AgentRegistry    (agentId → owner, metadata)
   │    └─ StrategyStore    (agentId → encrypted bytes)
   │
   └── Hyperliquid (perps)
        └─ Place/close orders per user wallet

Security guarantees
	•	TEE encryption: strategy JSON is encrypted before on-chain storage; keys never leave the enclave.
	•	Single agent per user: agentId is deterministic → a user can’t re-register.
	•	Signal gating: a strategy is submitted/executed once per latest signal.

⸻

Contracts (2)
	1.	AgentRegistry

	•	createAgent(bytes32 id, string uri) — one-time per user; only MANAGER can call.
	•	updateAgent(bytes32 id, string uri) — agent owner can update metadata.

	2.	StrategyStore

	•	storeStrategy(bytes32 id, bytes payload) — TEE-encrypted payload (iv|tag|ciphertext).

⸻

Commands (Telegram)
	•	/start → Creates user record and ensures on-chain Agent (if missing).
	•	Connect HL → Save user’s HL API wallet + main wallet + API secret (TEE-encrypted).
	•	Adjust Risk → Use default (ZkAGI) or manual JSON.
	•	Check Signal → Shows latest AVAX signal from your endpoint.
	•	Trade Now → Executes per latest signal (skips if HOLD or already executed).
	•	Auto Trade → Periodic polling; executes only on new signals.
	•	Close All → Market-closes all open positions.
	•	Portfolio → Shows balances & open positions (API + Main wallet).

⸻

Environment

# Avalanche RPC + Deploy key
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc    # or mainnet RPC
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY

# Telegram
BOT_TOKEN=123456789:ABCdef...

# Deployed contracts
AGENT_REGISTRY_ADDRESS=0x...
STRATEGY_STORE_ADDRESS=0x...

# TEE encryption service (generic)
TEE_GATEWAY_URL=https://<your-tee-gateway>
TEE_APP_ID=tee1q...

# AVAX signal source
AVAX_SIGNAL_URL=http://31.57.124.209:5000/avax/latest

MongoDB URL and other app infra vars as you already use them.

⸻

Deploy (brief)

# Install
npm i

# Compile & deploy (Hardhat)
npx hardhat compile
npx hardhat run scripts/deploy.mjs --network fuji
# set AGENT_REGISTRY_ADDRESS & STRATEGY_STORE_ADDRESS in .env

Grant the bot wallet the MANAGER_ROLE on AgentRegistry (from the deployer):

await registry.grantRole(await registry.MANAGER_ROLE(), "0x<botWalletAddress>");


⸻

Run

node bot/index.js

	•	On /start, the bot computes a deterministic agentId for the user and creates it on Avalanche (once).
	•	On Trade Now / Auto Trade, the bot fetches the AVAX signal, sizes via user risk, places AVAX-PERP orders on Hyperliquid, and stores the TEE-encrypted strategy in StrategyStore.

⸻

Notes
	•	Position sizing defaults to 5% of available margin (configurable).
	•	Bot persists “last executed signal” to avoid duplicate trades for the same tick.
	•	Errors shown to users are friendly; internals are logged in the console.
