# AVAX AI Trading Bot (TEE‑secured)

A secure **Telegram bot** that trades **AVAX perpetuals** using encrypted strategies and on‑chain agent management.

---

## Overview

* Registers each user as an **Agent** on Avalanche (C‑Chain).
* Encrypts strategies inside a **TEE** and stores them on‑chain.
* Places or closes AVAX‑PERP orders on Hyperliquid (manual or auto).
* Enforces:

  * One agent per user (deterministic agentId).
  * One execution per signal.

---

## Architecture

```
User (Telegram)
   │
   ▼
Bot (Node + Telegraf)
   │ 1️⃣ Register Agent (once)
   │ 2️⃣ Fetch AVAX signal
   │ 3️⃣ Encrypt & push strategy (TEE)
   │
   ├── Avalanche C‑Chain
   │    ├─ AgentRegistry (agentId → owner, metadata)
   │    └─ StrategyStore (agentId → encrypted bytes)
   │
   └── Hyperliquid (perps)
        └─ Trades AVAX‑PERP for user wallets
```

### Security

* **TEE encryption** ensures strategies are never stored in plain text.
* **AgentRegistry** prevents duplicate registrations.
* **Signal gating** prevents duplicate trades for the same signal.

---

## Contracts

### 1️⃣ AgentRegistry

* `createAgent(bytes32 id, string uri)` – creates an agent (MANAGER only).
* `updateAgent(bytes32 id, string uri)` – agent owner updates metadata.

### 2️⃣ StrategyStore

* `storeStrategy(bytes32 id, bytes payload)` – saves TEE‑encrypted strategy.

---

## Telegram Commands

| Command          | Purpose                                                               |
| ---------------- | --------------------------------------------------------------------- |
| `/start`         | Creates a user record and ensures an **Agent** exists on Avalanche.   |
| **Connect HL**   | Save Hyperliquid API wallet, main wallet & private key (encrypted).   |
| **Adjust Risk**  | Configure risk (default or manual JSON).                              |
| **Check Signal** | View latest **AVAX** trading signal.                                  |
| **Trade Now**    | Execute trade for the current signal (skips if HOLD or already done). |
| **Auto Trade**   | Poll signals & auto‑trade only when new.                              |
| **Close All**    | Close all open AVAX positions.                                        |
| **Portfolio**    | Show balances & open positions for API + Main wallet.                 |

---

## Environment

```ini
# Avalanche RPC & key
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
PRIVATE_KEY=0xYOUR_DEPLOYER_KEY

# Telegram
BOT_TOKEN=123456789:ABC...

# Contracts
AGENT_REGISTRY_ADDRESS=0x...
STRATEGY_STORE_ADDRESS=0x...

# TEE gateway (for strategy encryption)
TEE_GATEWAY_URL=https://<your-tee>
TEE_APP_ID=tee1q...

# AVAX signal endpoint
AVAX_SIGNAL_URL=http://31.57.124.209:5000/avax/latest
```

> MongoDB URL & other app configs as usual.

---

## Deployment

```bash
npm install
npx hardhat compile
npx hardhat run scripts/deploy.mjs --network fuji
```

Grant the bot wallet the **MANAGER\_ROLE**:

```js
await registry.grantRole(await registry.MANAGER_ROLE(), "0x<botWallet>");
```

---

## Running the Bot

```bash
node bot/index.js
```

### Flow

1. User sends `/start` → bot ensures `agentId` and creates agent if missing.
2. User connects Hyperliquid API key & wallets.
3. Bot fetches **AVAX** signal → encrypts strategy via TEE → stores in `StrategyStore`.
4. Trade executes on Hyperliquid with 5% of user margin (configurable).

---

## Key Notes

* Default trade size = **5%** of available margin.
* Strategies are encrypted before storage; keys remain inside TEE.
* Errors are user‑friendly; internal logs show stack traces.
* Once a signal is executed, the bot won’t repeat until a new signal arrives.

