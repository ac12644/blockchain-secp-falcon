// Chain management: deterministic genesis, validation, add/replace, block production

const { BlockHeader, Block } = require("./block");
const { verifyPoWBlock, generatePoWBlock } = require("../consensus/pow");
const { verifyPoSBlock, generatePoSBlock } = require("../consensus/pos");
const { buildStateFromChain } = require("./state");

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

let chain = [getGenesisBlock()];

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

async function addBlock(newBlock, stakes = []) {
  const prev = getLatestBlock();
  if (newBlock.index !== prev.index + 1) return false;
  if (!isTimestampValid(newBlock)) return false;

  if (CONSENSUS_MODE === "pow") {
    if (!verifyPoWBlock(newBlock, prev)) return false;
  } else {
    if (!verifyPoSBlock(newBlock, prev, stakes)) return false;
  }

  // Recompute and validate all txs against current state
  const state = buildStateFromChain(chain);
  for (const tx of newBlock.txns) {
    const { verifyTransaction } = require("../tx/transaction");
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
  console.log(
    `[chain] accepted block #${newBlock.index} hash=${newBlock.hash.slice(
      0,
      12
    )}... txs=${newBlock.txns.length}`
  );
  return true;
}

function isValidChain(candidate, stakes = []) {
  // genesis check (hash equality)
  const g = getGenesisBlock();
  const sameGenesis = JSON.stringify(candidate[0]) === JSON.stringify(g);
  if (!sameGenesis) return false;

  for (let i = 1; i < candidate.length; i++) {
    const prev = candidate[i - 1];
    const cur = candidate[i];
    if (cur.blockHeader.time <= prev.blockHeader.time) return false;

    if ((process.env.CONSENSUS_MODE || "pow") === "pow") {
      if (!verifyPoWBlock(cur, prev)) return false;
    } else {
      if (!verifyPoSBlock(cur, prev, stakes)) return false;
    }
  }
  return true;
}

function replaceChain(newChain, stakes = []) {
  if (newChain.length <= chain.length) return false;
  if (!isValidChain(newChain, stakes)) return false;
  chain = newChain;
  return true;
}

// Block production API
function generateNextBlock(txns = [], stakes = [], nBits = GENESIS.nBits) {
  const prev = getLatestBlock();
  const nextIndex = prev.index + 1;
  const nextTime = now();

  if (CONSENSUS_MODE === "pow") {
    return generatePoWBlock(prev, txns, nextIndex, nextTime, nBits);
  }
  return generatePoSBlock(prev, txns, nextIndex, nextTime, stakes);
}

module.exports = {
  chain,
  getLatestBlock,
  getGenesisBlock,
  addBlock,
  replaceChain,
  isValidChain,
  generateNextBlock,
};
