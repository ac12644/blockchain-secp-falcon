// Chain management: deterministic genesis, validation, add/replace, block production

const { BlockHeader, Block } = require("./block");
const { verifyPoWBlock, generatePoWBlock } = require("../consensus/pow");
const { verifyPoSBlock, generatePoSBlock } = require("../consensus/pos");
const {
  buildStateFromChain,
  getChainStateSnapshot,
  invalidateCache,
} = require("./state");
const {
  verifyTransaction,
  createCoinbaseTx,
  verifyCoinbaseTx,
  isCoinbase,
} = require("../tx/transaction");
const { getNextNBits } = require("../consensus/difficulty");
const db = require("../storage/db");

const CONSENSUS_MODE = (process.env.CONSENSUS_MODE || "pow").toLowerCase();
const FUTURE_SKEW = 2 * 60 * 60; // 2 hours

// Fixed, reproducible genesis (same on all nodes)
const GENESIS = {
  version: 1,
  previousHash: "0".repeat(64),
  merkleRoot:
    "d3b07384d113edec49eaa6238ad5ff00d3b07384d113edec49eaa6238ad5ff00",
  time: 1700000000,
  nBits: 0x1f00ffff,
  nonce: 0,
};

function getGenesisBlock() {
  const h = new BlockHeader(
    GENESIS.version,
    GENESIS.previousHash,
    GENESIS.merkleRoot,
    GENESIS.time,
    GENESIS.nBits,
    GENESIS.nonce
  );
  return new Block(h, 0, []);
}

const chain = [getGenesisBlock()];

// Sequential queue prevents concurrent addBlock race conditions
let blockQueue = Promise.resolve();

function now() {
  return Math.floor(Date.now() / 1000);
}

function isTimestampValid(newBlock) {
  const latest = chain[chain.length - 1];
  if (newBlock.blockHeader.time <= latest.blockHeader.time) return false;
  if (newBlock.blockHeader.time > now() + FUTURE_SKEW) return false;
  return true;
}

function getLatestBlock() {
  return chain[chain.length - 1];
}

async function _addBlock(newBlock, stakes = []) {
  const prev = getLatestBlock();
  if (newBlock.index !== prev.index + 1) return false;
  if (!isTimestampValid(newBlock)) return false;

  if (CONSENSUS_MODE === "pow") {
    const expectedNBits = getNextNBits(chain, GENESIS.nBits);
    if (newBlock.blockHeader.nBits !== expectedNBits) return false;
    if (!verifyPoWBlock(newBlock, prev)) return false;
  } else {
    if (!verifyPoSBlock(newBlock, prev, stakes)) return false;
  }

  // Validate coinbase tx (must be first, exactly one)
  const txns = newBlock.txns || [];
  if (txns.length === 0 || !isCoinbase(txns[0])) return false;
  const regularTxns = txns.slice(1);
  if (regularTxns.some(isCoinbase)) return false; // only one coinbase allowed
  if (!verifyCoinbaseTx(txns[0], newBlock.index, regularTxns)) return false;

  // Validate regular txs against cached state (snapshot for safe mutation)
  const state = getChainStateSnapshot(chain);
  for (const tx of regularTxns) {
    const ok = await verifyTransaction(tx, state);
    if (!ok) return false;
    const accFrom = state.get(tx.fromAddress) || { balance: 0, nonce: 0 };
    const accTo = state.get(tx.toAddress) || { balance: 0, nonce: 0 };
    accFrom.balance -= tx.amount + tx.fee;
    accFrom.nonce = tx.nonce;
    accTo.balance += tx.amount;
    state.set(tx.fromAddress, accFrom);
    state.set(tx.toAddress, accTo);
  }

  chain.push(newBlock);

  // persist to disk if DB is open
  if (db.isOpen()) {
    await db.putBlock(newBlock);
  }

  console.log(
    `[chain] accepted block #${newBlock.index} hash=${newBlock.hash.slice(
      0,
      12
    )}... txs=${newBlock.txns.length}`
  );
  return true;
}

function addBlock(newBlock, stakes = []) {
  return (blockQueue = blockQueue
    .then(() => _addBlock(newBlock, stakes))
    .catch(() => false));
}

function isValidChain(candidate, stakes = []) {
  // genesis check (hash equality)
  const g = getGenesisBlock();
  if (candidate[0].hash !== g.hash) return false;

  const state = new Map();
  for (let i = 1; i < candidate.length; i++) {
    const prev = candidate[i - 1];
    const cur = candidate[i];
    if (cur.blockHeader.time <= prev.blockHeader.time) return false;

    if (CONSENSUS_MODE === "pow") {
      const expectedNBits = getNextNBits(candidate, GENESIS.nBits, i);
      if (cur.blockHeader.nBits !== expectedNBits) return false;
      if (!verifyPoWBlock(cur, prev)) return false;
    } else {
      if (!verifyPoSBlock(cur, prev, stakes)) return false;
    }

    // validate coinbase
    const txns = cur.txns || [];
    if (txns.length === 0 || !isCoinbase(txns[0])) return false;
    const regularTxns = txns.slice(1);
    if (regularTxns.some(isCoinbase)) return false;
    if (!verifyCoinbaseTx(txns[0], cur.index, regularTxns)) return false;

    // credit coinbase reward
    const coinTo = state.get(txns[0].toAddress) || { balance: 0, nonce: 0 };
    coinTo.balance += txns[0].amount;
    state.set(txns[0].toAddress, coinTo);

    // validate regular transactions against accumulated state
    for (const tx of regularTxns) {
      if (!verifyTransaction(tx, state)) return false;
      const from = state.get(tx.fromAddress) || { balance: 0, nonce: 0 };
      const to = state.get(tx.toAddress) || { balance: 0, nonce: 0 };
      from.balance -= tx.amount + tx.fee;
      from.nonce = tx.nonce;
      to.balance += tx.amount;
      state.set(tx.fromAddress, from);
      state.set(tx.toAddress, to);
    }
  }
  return true;
}

async function replaceChain(newChain, stakes = []) {
  if (newChain.length <= chain.length) return false;
  if (!isValidChain(newChain, stakes)) return false;
  chain.length = 0;
  newChain.forEach((b) => chain.push(b));
  invalidateCache();

  // persist all blocks if DB is open
  if (db.isOpen()) {
    for (const b of newChain) {
      await db.putBlock(b);
    }
  }
  return true;
}

/**
 * Load persisted chain from DB on startup.
 * Falls back to genesis-only if DB is empty or not open.
 */
async function loadChain() {
  try {
    await db.open();
    const blocks = await db.loadAllBlocks();
    if (blocks.length > 0) {
      chain.length = 0;
      blocks.forEach((b) => chain.push(b));
      console.log(`[chain] restored ${chain.length} blocks from disk`);
    } else {
      // persist genesis
      await db.putBlock(chain[0]);
      console.log("[chain] initialized new DB with genesis block");
    }
  } catch (err) {
    console.warn("[chain] DB not available, running in-memory only:", err.message);
  }
}

// Block production API
function generateNextBlock(txns = [], stakes = [], minerAddress = "") {
  const prev = getLatestBlock();
  const nextIndex = prev.index + 1;
  const nextTime = now();

  // prepend coinbase tx
  const fees = txns.reduce((sum, t) => sum + (t.fee || 0), 0);
  const coinbase = createCoinbaseTx(minerAddress, nextIndex, fees);
  const allTxns = [coinbase, ...txns];

  if (CONSENSUS_MODE === "pow") {
    const nBits = getNextNBits(chain, GENESIS.nBits);
    return generatePoWBlock(prev, allTxns, nextIndex, nextTime, nBits);
  }
  return generatePoSBlock(prev, allTxns, nextIndex, nextTime, stakes);
}

module.exports = {
  chain,
  getLatestBlock,
  getGenesisBlock,
  addBlock,
  replaceChain,
  isValidChain,
  generateNextBlock,
  loadChain,
};
