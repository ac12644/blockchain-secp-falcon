// Core block primitives: canonical header, block hash (double-SHA256)

const { createHash } = require("crypto");

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

// Binary serialization (80 bytes, Bitcoin-style layout)
function serializeHeader(h) {
  const buf = Buffer.allocUnsafe(80);
  buf.writeUInt32BE(h.version, 0);
  Buffer.from(h.previousHash, "hex").copy(buf, 4);
  Buffer.from(h.merkleRoot, "hex").copy(buf, 36);
  buf.writeUInt32BE(h.time, 68);
  buf.writeUInt32BE(h.nBits, 72);
  buf.writeUInt32BE(h.nonce, 76);
  return buf;
}

// Double SHA-256 of the binary header
function hashHeader(header) {
  const s = serializeHeader(header);
  return createHash("sha256")
    .update(createHash("sha256").update(s).digest())
    .digest("hex");
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
