const { BlockHeader, Block, hashHeader } = require("../src/core/block");

describe("Block & Header", () => {
  test("hashHeader is deterministic and changes with fields", () => {
    const h1 = new BlockHeader(
      1,
      "p".repeat(64),
      "m".repeat(64),
      1700000000,
      0x1f00ffff,
      0
    );
    const h2 = new BlockHeader(
      1,
      "p".repeat(64),
      "m".repeat(64),
      1700000000,
      0x1f00ffff,
      0
    );
    expect(hashHeader(h1)).toBe(hashHeader(h2));

    const h3 = new BlockHeader(
      1,
      "q".repeat(64),
      "m".repeat(64),
      1700000000,
      0x1f00ffff,
      0
    );
    expect(hashHeader(h1)).not.toBe(hashHeader(h3));
  });

  test("block caches its hash and links to previous by previousHash", () => {
    const prev = new Block(
      new BlockHeader(1, "0".repeat(64), "m".repeat(64), 1700000000, 0, 0),
      0,
      []
    );
    const h = new BlockHeader(1, prev.hash, "m".repeat(64), 1700000100, 0, 0);
    const b = new Block(h, 1, []);
    expect(b.blockHeader.previousHash).toBe(prev.hash);
    expect(b.hash).toBe(hashHeader(h));
  });
});
