const { merkleRoot } = require("../src/core/merkle");

describe("Merkle", () => {
  test("deterministic root for same txs", () => {
    const txs = [{ a: 1 }, { b: 2 }, { c: 3 }];
    expect(merkleRoot(txs)).toBe(merkleRoot(txs));
  });

  test("empty tx set returns zero root", () => {
    expect(merkleRoot([])).toMatch(/^0{64}$/);
  });

  test("odd number of leaves duplicates last", () => {
    const txsOdd = [{ x: 1 }, { y: 2 }, { z: 3 }];
    const txsEven = [{ x: 1 }, { y: 2 }, { z: 3 }, { z: 3 }]; // duplicate last
    expect(merkleRoot(txsOdd)).toBe(merkleRoot(txsEven));
  });

  test("order matters", () => {
    const a = merkleRoot([{ a: 1 }, { b: 2 }]);
    const b = merkleRoot([{ b: 2 }, { a: 1 }]);
    expect(a).not.toBe(b);
  });
});
