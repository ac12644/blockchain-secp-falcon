// Simple Merkle tree over JSON(tx) hashes (SHA-256)

const CryptoJS = require("crypto-js");
const sha = (x) => CryptoJS.SHA256(x).toString();

function merkleRoot(txns) {
  if (!txns || txns.length === 0) return "0".repeat(64);
  let level = txns.map((t) => sha(JSON.stringify(t)));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = level[i + 1] || a; // duplicate last if odd count
      next.push(sha(a + b));
    }
    level = next;
  }
  return level[0];
}

module.exports = { merkleRoot };
