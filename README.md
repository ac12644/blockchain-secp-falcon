<!-- PROJECT SHIELDS -->

[![GitHub stars](https://img.shields.io/github/stars/ac12644/blockchain-secp-falcon?style=flat)](https://github.com/ac12644/blockchain-secp-falcon/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/ac12644/blockchain-secp-falcon?style=flat)](https://github.com/ac12644/blockchain-secp-falcon/network/members)
[![GitHub issues](https://img.shields.io/github/issues/ac12644/blockchain-secp-falcon?style=flat)](https://github.com/ac12644/blockchain-secp-falcon/issues)
[![Tests](https://github.com/ac12644/blockchain-secp-falcon/actions/workflows/tests.yml/badge.svg)](https://github.com/ac12644/blockchain-secp-falcon/actions/workflows/tests.yml)

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/ac12644/blockchain-secp-falcon">
    <img src="img/blockchain.svg" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Blockchain — a hackable educational L1 in Node.js</h3>

  <p align="center">
    Learn-by-doing blockchain: modular consensus (PoW/PoS), pluggable crypto (secp256k1 / Falcon PQC), P2P gossip, Merkle trees, blocks, state, and a tiny REST API.
    <br /><br />
    <strong>⭐ Star this repo if you like real, readable blockchain code!</strong>
  </p>
</div>

---

## Why this project?

Most tutorials hide the moving parts. This repo shows the **whole path** end-to-end:

- block and header structure
- merkle trees and block hashing
- PoW/PoS consensus (switchable)
- transaction signing & verification
- P2P sync & fork choice (longest chain)
- dynamic HTTP API for quick experiments
- unit tests for the core primitives

You’ll be able to **run multiple nodes locally**, **mine blocks**, **send signed transactions**, and **watch chains sync**.

---

## Quick Start (5 minutes)

```bash
# 1) Install
npm install

# 2) Run your first node (PoW + secp256k1)
npm start
# watch logs:
# [http] listening on :8080
# [p2p] listening on <random>
# [wallet] address: <your 40-hex address>

# 3) In another terminal, run a second node
npm start
# second node picks a new HTTP port (e.g., :8081) and connects

# 4) Mine an empty block on node A (instant, easy PoW target via /mine)
curl -X POST http://localhost:8080/mine

# 5) Check both nodes now show the same tip:
curl http://localhost:8080/latest
curl http://localhost:8081/latest
```

If both latest blocks match, congrats — you have a tiny blockchain cluster syncing locally.

---

## Project Structure

```
src/
├─ consensus/          # PoW / PoS implementations
├─ core/               # block, chain, merkle, state
├─ crypto/             # Crypto adapter (secp256k1 or Falcon)
├─ network/            # P2P gossip + HTTP server
├─ tx/                 # transaction model & verification
├─ wallet/             # wallet init & key persist
└─ index.js            # entrypoint (starts P2P and HTTP)
test/                  # Jest tests for core modules
```

---

## How it works (short theory)

- **BlockHeader:** links to previous block, commits to the Merkle root of txs, includes timestamp + PoW/PoS fields.
- **Merkle Tree:** deterministic hash of the tx list; order matters; last leaf duplicates when odd.
- **PoW:** mines a header hash under a target (nBits). We add `/mine` with an **easy** target for instant demos.
- **PoS:** selects a validator with probability proportional to stake (demo stakes are in-memory).
- **Chain Validity:** checks parent linkage, timestamps, consensus-specific validity, and per-tx signature/balance/nonce.
- **P2P:** peers gossip new blocks, request missing blocks, and can request a full chain on forks; longest chain wins.

---

## Switch Consensus & Crypto

### Consensus

```bash
# Proof-of-Work (default)
npm run start:pow
# Proof-of-Stake
npm run start:pos
```

or:

```bash
CONSENSUS_MODE=pow node src/index.js
CONSENSUS_MODE=pos node src/index.js
```

### Cryptography

```bash
# Classic ECDSA (secp256k1) — default
npm run start:secp
# Post-Quantum Falcon-512 (requires pqclean)
npm run start:falcon
```

or:

```bash
CRYPTO_MODE=falcon node src/index.js
```

You can combine:

```bash
CRYPTO_MODE=falcon CONSENSUS_MODE=pos node src/index.js
```

---

## HTTP API (learn by calling)

Each node auto-picks a free port (8080, 8081, …).

- `GET /blocks` → entire chain
- `GET /block/:index` → block by index
- `GET /latest` → latest block
- `GET /state/:address` → `{ balance, nonce }`
- `POST /mine` → mine an empty block (PoW demo, instant)
- `POST /tx` → submit a **signed** transaction (see below)

### Example: Mine and Inspect

```bash
curl -X POST http://localhost:8080/mine
curl http://localhost:8080/latest
curl http://localhost:8080/blocks | jq 'length'
```

---

## Submitting a **signed transaction** (end-to-end)

Transactions must be signed using the same crypto mode the node is running.

We’ll:

1. read your local wallet,
2. sign a tx in a one-liner Node script,
3. POST it to the node.

### 1) Get your address (from logs)

When you start the node you’ll see:

```
[wallet] address: 09c8186fc8073ee1728f9a2586a221b81d4f5c2a
```

### 2) Prepare recipient

```
export FROM=09c8186fc8073ee1728f9a2586a221b81d4f5c2a
export TO=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

### 3) Build & sign a tx

```bash
node -e "(
  async () => {
    const fs = require('fs');
    const CryptoAdapter = require('./src/crypto/cryptoAdapter');
    const pk = fs.readFileSync('./src/wallet/private_key','utf8').trim();
    const pub = fs.readFileSync('./src/wallet/public_key','utf8').trim();
    const from = process.env.FROM;
    const to = process.env.TO;
    const amount = 1, fee = 0, nonce = 1;
    const message = from + to + amount;
    const signature = await CryptoAdapter.sign(message, pk);
    const tx = { fromAddress: from, toAddress: to, amount, fee, nonce, publicKey: pub, signature };
    console.log(JSON.stringify(tx));
  }
)()" > /tmp/tx.json
```

### 4) Submit the tx

```bash
curl -X POST http://localhost:8080/tx   -H "Content-Type: application/json"   --data-binary @/tmp/tx.json
```

Check balances:

```bash
curl http://localhost:8080/state/$FROM
curl http://localhost:8080/state/$TO
```

---

## Running multiple nodes (sync demo)

1. Terminal A:

```bash
npm start
# [http] :8080
```

2. Terminal B:

```bash
npm start
# [http] :8081
# [p2p] connected...
```

3. Mine on A:

```bash
curl -X POST http://localhost:8080/mine
```

4. Both tips match:

```bash
curl http://localhost:8080/latest
curl http://localhost:8081/latest
```

---

## Tests

```bash
npm test
npm run test:watch
npm run test:cov
```

Covers:

- merkle root
- block hashing
- PoW & PoS validation
- tx signing + balance/nonce
- chain add/replace

---

## Configuration

- `CONSENSUS_MODE` — pow | pos
- `CRYPTO_MODE` — secp256k1 | falcon
- `HTTP_PORT` — preferred port (auto-picks next free otherwise)

---

## Troubleshooting

- **Port in use** → set `HTTP_PORT` or let auto-pick.
- **Peers not connecting** → check firewall; discovery-swarm needs LAN.
- **Nothing mines** → POST `/mine` for instant PoW demo.
- **Tx rejected** → wrong nonce, insufficient balance, or crypto mode mismatch.

---

## Next steps

- Add coinbase reward to miner.
- Persist state in RocksDB.
- On-chain stakes for PoS.
- Implement a mempool.
- Difficulty retarget for PoW.
- Build a block explorer UI.

---

## Contributing

PRs, issues, and stars welcome 🙌

1. Fork
2. Branch `feat/my-feature`
3. Commit + Push
4. PR 🎉

---

<p align="right">(<a href="#top">back to top</a>)</p>
