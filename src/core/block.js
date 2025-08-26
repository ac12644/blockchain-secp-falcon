// Core block primitives: canonical header, block hash (double-SHA256)

const CryptoJS = require("crypto-js");

class BlockHeader {
  constructor(version, previousHash, merkleRoot, time, nBits, nonce) {
    this.version = version >>> 0; // uint32
    this.previousHash = previousHash; // hex string 64 chars
    this.merkleRoot = merkleRoot; // hex string 64 chars
    this.time = Number(time) | 0; // unix seconds
    this.nBits = Number(nBits) >>> 0; // compact target (uint32)
    this.nonce = Number(nonce) >>> 0; // uint32
  }
}

// Simple, readable “serialization” for learners (use binary in real systems)
function serializeHeader(h) {
  return [
    h.version,
    h.previousHash,
    h.merkleRoot,
    h.time,
    h.nBits,
    h.nonce,
  ].join("|");
}

// Bitcoin-style double SHA-256 of the header serialization
function hashHeader(header) {
  const s = serializeHeader(header);
  return CryptoJS.SHA256(CryptoJS.SHA256(s)).toString();
}

class Block {
  constructor(blockHeader, index, txns = []) {
    this.blockHeader = blockHeader;
    this.index = index >>> 0;
    this.txns = Array.isArray(txns) ? txns : [];
    this.hash = hashHeader(this.blockHeader); // cached
  }
}

module.exports = {
  BlockHeader,
  Block,
  hashHeader,
};
