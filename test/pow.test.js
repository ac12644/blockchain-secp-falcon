const { BlockHeader, Block } = require("../src/core/block");
const { merkleRoot } = require("../src/core/merkle");
const { generatePoWBlock, verifyPoWBlock } = require("../src/consensus/pow");

function genesis() {
  const h = new BlockHeader(
    1,
    "0".repeat(64),
    "m".repeat(64),
    1700000000,
    0x1f00ffff,
    0
  );
  return new Block(h, 0, []);
}

// very-easy target so mining is instant
const EASY_NBITS = 0x207fffff;

describe("PoW", () => {
  test("generatePoWBlock finds a valid hash under target", () => {
    const g = genesis();
    const txs = [
      {
        fromAddress: "a",
        toAddress: "b",
        amount: 0,
        fee: 0,
        nonce: 1,
        publicKey: "00",
        signature: "00",
      },
    ];
    const b1 = generatePoWBlock(g, [], 1, 1700000100, EASY_NBITS);
    expect(b1.blockHeader.merkleRoot).toBe(merkleRoot([]));
    expect(verifyPoWBlock(b1, g)).toBe(true);
  });

  test("invalid previous hash fails verification", () => {
    const g = genesis();
    const b1 = generatePoWBlock(g, [], 1, 1700000100, EASY_NBITS);
    const badPrev = new Block(
      new BlockHeader(1, "x".repeat(64), "m".repeat(64), 1700000050, 0, 0),
      0,
      []
    );
    expect(verifyPoWBlock(b1, badPrev)).toBe(false);
  });
});
