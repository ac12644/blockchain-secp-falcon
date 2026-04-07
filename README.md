[![GitHub stars](https://img.shields.io/github/stars/ac12644/blockchain-secp-falcon?style=flat)](https://github.com/ac12644/blockchain-secp-falcon/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/ac12644/blockchain-secp-falcon?style=flat)](https://github.com/ac12644/blockchain-secp-falcon/network/members)
[![GitHub issues](https://img.shields.io/github/issues/ac12644/blockchain-secp-falcon?style=flat)](https://github.com/ac12644/blockchain-secp-falcon/issues)
[![Tests](https://github.com/ac12644/blockchain-secp-falcon/actions/workflows/tests.yml/badge.svg)](https://github.com/ac12644/blockchain-secp-falcon/actions/workflows/tests.yml)

<div align="center">
  <a href="https://github.com/ac12644/blockchain-secp-falcon">
    <img src="img/blockchain.svg" alt="Logo" width="80" height="80">
  </a>
  <h1>Blockchain</h1>
  <p>A hackable, educational Layer 1 blockchain built from scratch in Node.js</p>
</div>

---

## Overview

A fully functional blockchain implementation designed for learning. Every component is modular, readable, and swappable — from consensus to cryptography to networking.

**Key features:**

- **Pluggable consensus** -- switch between Proof-of-Work and Proof-of-Stake via environment variable
- **Pluggable cryptography** -- secp256k1 (ECDSA via Node.js built-in crypto) or post-quantum Falcon-512
- **P2P networking** -- peer discovery and block gossip via [Hyperswarm](https://github.com/holepunchto/hyperswarm) with NAT hole-punching
- **Transaction mempool** -- fee-sorted pending transaction pool
- **Block rewards** -- coinbase transactions with halving schedule (50 coins, halves every 210K blocks)
- **Difficulty adjustment** -- Bitcoin-style retargeting every 10 blocks
- **Persistent storage** -- RocksDB for block persistence across restarts
- **REST API** -- query blocks, state, mempool; submit transactions and mine
- **CLI** -- 8 commands for interacting with a running node
- **Race-safe** -- sequential block queue prevents concurrent modification

---

## Quick Start

**Requirements:** Node.js >= 22

```bash
# Clone and install
git clone https://github.com/ac12644/blockchain-secp-falcon.git
cd blockchain-secp-falcon
npm install

# Start a node (PoW + secp256k1 by default)
npm start

# In another terminal, mine a block
node bin/cli.js mine

# Check node status
node bin/cli.js status
```

Output:

```
Node Status
---------------------------------------
  Chain height:   1
  Latest hash:    0000a3f8c2e1...
  Block time:     2026-04-07T12:00:00.000Z
  Difficulty:     0x1f00ffff
  Transactions:   1 in latest block
  Mempool:        0 pending
  Port:           8080
```

---

## Architecture

```
src/
├── index.js                 # Entry point — starts DB, wallet, P2P, HTTP
├── consensus/
│   ├── pow.js               # Proof-of-Work (nonce mining, compact target)
│   ├── pos.js               # Proof-of-Stake (deterministic validator selection)
│   └── difficulty.js        # Difficulty retargeting every 10 blocks
├── core/
│   ├── block.js             # BlockHeader + Block, binary serialization, double-SHA256
│   ├── chain.js             # Chain management, validation, block production, mutex queue
│   ├── merkle.js            # Merkle tree (SHA-256)
│   └── state.js             # Account state with incremental cache
├── crypto/
│   ├── cryptoAdapter.js     # Pluggable signing (Node crypto / Falcon-512)
│   └── keys.js              # Wallet key generation and file persistence
├── network/
│   ├── http.js              # Express 5 REST API
│   └── p2p.js               # Hyperswarm P2P gossip and sync
├── storage/
│   └── db.js                # RocksDB block persistence
└── tx/
    ├── transaction.js        # Transaction model, signing, coinbase, verification
    └── mempool.js            # Fee-sorted pending transaction pool

cli/
├── http.js                  # Shared HTTP client (undici)
└── cmds/                    # CLI commands (block, mine, tx, wallet, mempool, status, ...)

test/                        # Jest test suite (14 tests)
```

---

## Configuration

Set via environment variables or `.env` file (see `.env.example`):

| Variable | Values | Default | Description |
|---|---|---|---|
| `CONSENSUS_MODE` | `pow`, `pos` | `pow` | Consensus mechanism |
| `CRYPTO_MODE` | `secp256k1`, `falcon` | `secp256k1` | Signing algorithm |
| `HTTP_PORT` | any port number | auto (8080-8999) | HTTP API port |
| `DB_PATH` | file path | `./data/blocks` | RocksDB storage path |

```bash
# Examples
CONSENSUS_MODE=pos npm start
CRYPTO_MODE=falcon CONSENSUS_MODE=pos npm start
HTTP_PORT=3000 npm start
```

Convenience scripts:

```bash
npm run start:pow       # PoW mode
npm run start:pos       # PoS mode
npm run start:secp      # secp256k1 crypto
npm run start:falcon    # Falcon-512 crypto
```

---

## CLI

The CLI interacts with a running node over HTTP.

```
Usage: cli <command> [options]

Commands:

  block       Query blocks from running node (b)
  mempool     Show pending transactions in mempool (mp)
  mine        Mine a new block (includes mempool txs) (m)
  status      Show node status overview (s)
  tx          Submit a signed transaction (t)
  version     Show version (v)
  wallet      Query wallet balance and state (w)

Options:
  --port <n>    Node HTTP port (default: $HTTP_PORT or 8080)
  --verbose     Show request details
```

### Examples

```bash
# Mine a block
node bin/cli.js mine

# Check status
node bin/cli.js status

# Get block by index
node bin/cli.js block --index 0

# Get latest block
node bin/cli.js block --latest

# Check wallet balance
node bin/cli.js wallet --address <40-char-hex>

# Send a transaction (auto-signs with local wallet, auto-fetches nonce)
node bin/cli.js tx --to <address> --amount 10 --fee 1

# View mempool
node bin/cli.js mempool
```

---

## REST API

Each node exposes a REST API on its HTTP port.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/blocks` | Entire chain |
| `GET` | `/block/:index` | Block by index |
| `GET` | `/latest` | Latest block |
| `GET` | `/state/:address` | Account balance and nonce |
| `GET` | `/mempool` | Pending transactions |
| `POST` | `/tx` | Submit a signed transaction |
| `POST` | `/mine` | Mine a block (includes mempool txs) |

### Examples

```bash
# Get entire chain
curl http://localhost:8080/blocks

# Mine a block
curl -X POST http://localhost:8080/mine

# Check balance
curl http://localhost:8080/state/475fb27b35aedcf5f9e0d5cd94b4e635ca38efb0

# View mempool
curl http://localhost:8080/mempool
```

---

## Multi-Node Sync

Run multiple nodes locally to see P2P sync in action:

```bash
# Terminal 1 — start first node
HTTP_PORT=8080 npm start

# Terminal 2 — start second node (auto-discovers peer via Hyperswarm DHT)
HTTP_PORT=8081 npm start

# Terminal 3 — mine on node A
node bin/cli.js mine --port 8080

# Verify both nodes have the same chain tip
node bin/cli.js status --port 8080
node bin/cli.js status --port 8081
```

Nodes discover each other automatically via Hyperswarm's DHT. When a block is mined on one node, it broadcasts to all connected peers.

---

## How It Works

### Blocks

Each block contains a header (version, previous hash, Merkle root, timestamp, difficulty, nonce), an index, and a list of transactions. Headers are serialized as 80-byte binary buffers and hashed with double-SHA256.

### Transactions

Transactions include sender, recipient, amount, fee, nonce, public key, and signature. The first transaction in every block is a **coinbase** that mints the block reward (50 coins, halving every 210,000 blocks) plus collected fees.

### Consensus

- **Proof-of-Work:** iterates nonces until the block hash is below the compact target. Difficulty adjusts every 10 blocks based on actual vs. target block time (10 seconds).
- **Proof-of-Stake:** deterministically selects a validator weighted by stake using HMAC-SHA256 of the previous block hash.

### State

Account state (balance + nonce) is derived from the chain. An incremental cache avoids rebuilding from genesis on every query -- only new blocks are processed.

### Networking

Peers join a shared Hyperswarm topic (SHA-256 of "myBlockchain"). On connection, they exchange chain tips and sync missing blocks. The longest valid chain wins on forks.

### Storage

Blocks are persisted to RocksDB on acceptance and loaded in parallel batches on startup. Nodes survive restarts without losing chain state.

---

## Cryptography

### secp256k1 (default)

Uses Node.js built-in `crypto` module for ECDSA key generation, signing, and verification. Keys are stored in standard DER format (PKCS8 private, SPKI public). Zero external crypto dependencies.

### Falcon-512 (post-quantum)

Optional post-quantum signing via [pqclean](https://www.npmjs.com/package/pqclean). Falcon-512 is a NIST-selected lattice-based signature scheme resistant to quantum attacks.

```bash
CRYPTO_MODE=falcon npm start
```

> **Note:** `pqclean` requires native compilation. If it fails to install, the node defaults to secp256k1.

---

## Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:cov      # With coverage report
```

**14 tests** across 6 suites:

| Suite | Tests |
|---|---|
| Block & Header | Deterministic hashing, field sensitivity, hash caching |
| Chain | Block acceptance, timestamp validation |
| Merkle | Determinism, empty set, odd leaves, order sensitivity |
| PoW | Mining under target, invalid previous hash rejection |
| PoS | Deterministic selection, stake-based validation |
| Transactions | Sign/verify, nonce enforcement, balance checks, address derivation |

---

## Security

- **0 known vulnerabilities** (`npm audit`)
- ECDSA signing uses Node.js built-in OpenSSL (constant-time C implementation)
- HTTP payload limited to 100KB
- P2P messages capped at 10MB with malformed JSON logging
- Max 50 peer connections
- Transaction validation: address derivation, signature, sequential nonce, balance check
- Block difficulty enforced at protocol level (peers cannot use easier targets)
- Sequential block queue prevents race conditions

---

## Dependencies

| Package | Purpose |
|---|---|
| `express` | HTTP API server (v5) |
| `hyperswarm` | P2P peer discovery and connections |
| `rocksdb` | Block persistence |
| `pqclean` | Post-quantum Falcon-512 signatures (optional) |
| `undici` | HTTP client for CLI |
| `get-port` | Dynamic port selection |
| `dotenv` | Environment variable loading |
| `jest` | Test framework (dev) |

---

## Contributing

PRs, issues, and stars are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Push and open a Pull Request

---

## License

[GPL-3.0](LICENSE)
