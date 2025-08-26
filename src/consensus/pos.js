// Proof-of-Stake (didactic): deterministic validator selection

const { createHmac } = require("crypto");
const { BlockHeader, Block, hashHeader } = require("../core/block");
const { merkleRoot } = require("../core/merkle");

// stakes = [{ address, stake }]
function selectValidatorDeterministic(stakes, seedHex) {
  const total = stakes.reduce((s, x) => s + x.stake, 0);
  if (total <= 0) throw new Error("Empty stakes");
  const h = createHmac("sha256", Buffer.from(seedHex, "hex"))
    .update("validator-selection")
    .digest("hex");
  const r = Number(BigInt("0x" + h) % BigInt(total));
  let acc = 0;
  for (const s of stakes) {
    acc += s.stake;
    if (r < acc) return s.address;
  }
  return stakes[stakes.length - 1].address;
}

function generatePoSBlock(prevBlock, txns, index, time, stakes) {
  const validator = selectValidatorDeterministic(stakes, prevBlock.hash);
  // encode validator address into nonce field just for visibility (educational)
  const header = new BlockHeader(
    1,
    prevBlock.hash,
    merkleRoot(txns),
    time,
    0,
    0
  );
  const block = new Block(header, index, txns);
  block.validator = validator; // extra metadata (not hashed)
  return block;
}

function verifyPoSBlock(block, prevBlock, stakes) {
  if (block.blockHeader.previousHash !== prevBlock.hash) return false;
  if (merkleRoot(block.txns) !== block.blockHeader.merkleRoot) return false;
  if (hashHeader(block.blockHeader) !== block.hash) return false;

  const expected = selectValidatorDeterministic(stakes, prevBlock.hash);
  if (block.validator !== expected) return false;

  if (block.blockHeader.time <= prevBlock.blockHeader.time) return false;
  return true;
}

module.exports = {
  selectValidatorDeterministic,
  generatePoSBlock,
  verifyPoSBlock,
};
