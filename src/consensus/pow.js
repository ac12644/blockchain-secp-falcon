// Proof-of-Work: compact target (nBits) + verification

const { BlockHeader, Block, hashHeader } = require("../core/block");
const { merkleRoot } = require("../core/merkle");

function targetFromNBits(nBits) {
  // Compact format similar to Bitcoin
  const exp = (nBits >>> 24) & 0xff;
  const mant = nBits & 0x007fffff;
  let target = BigInt(mant) * (1n << (8n * (BigInt(exp) - 3n)));
  return target;
}
const hashToBigInt = (hex) => BigInt("0x" + hex);

function generatePoWBlock(prevBlock, txns, index, time, nBits) {
  const root = merkleRoot(txns);
  const target = targetFromNBits(nBits);
  let nonce = 0;
  let header, hash;
  do {
    header = new BlockHeader(1, prevBlock.hash, root, time, nBits, nonce++);
    hash = hashHeader(header);
  } while (hashToBigInt(hash) > target);
  return new Block(header, index, txns);
}

function verifyPoWBlock(block, prevBlock) {
  if (block.blockHeader.previousHash !== prevBlock.hash) return false;
  if (merkleRoot(block.txns) !== block.blockHeader.merkleRoot) return false;
  if (hashHeader(block.blockHeader) !== block.hash) return false;

  const target = targetFromNBits(block.blockHeader.nBits);
  if (hashToBigInt(block.hash) > target) return false;

  // basic time sanity
  if (block.blockHeader.time <= prevBlock.blockHeader.time) return false;
  return true;
}

module.exports = { generatePoWBlock, verifyPoWBlock, targetFromNBits };
