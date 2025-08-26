const { BlockHeader, Block } = require("../src/core/block");
const {
  generatePoSBlock,
  verifyPoSBlock,
  selectValidatorDeterministic,
} = require("../src/consensus/pos");

function genesis() {
  const h = new BlockHeader(
    1,
    "0".repeat(64),
    "m".repeat(64),
    1700000000,
    0,
    0
  );
  return new Block(h, 0, []);
}

describe("PoS (deterministic selection)", () => {
  const stakes = [
    { address: "A", stake: 10 },
    { address: "B", stake: 20 },
    { address: "C", stake: 30 },
  ];

  test("selection is deterministic from seed", () => {
    const seed = "f".repeat(64);
    const v1 = selectValidatorDeterministic(stakes, seed);
    const v2 = selectValidatorDeterministic(stakes, seed);
    expect(v1).toBe(v2);
  });

  test("generated PoS block validates with same stakes", () => {
    const g = genesis();
    const b1 = generatePoSBlock(g, [], 1, 1700000100, stakes);
    expect(verifyPoSBlock(b1, g, stakes)).toBe(true);
  });

  test("verification fails if stakes differ", () => {
    const g = genesis();
    const b1 = generatePoSBlock(g, [], 1, 1700000100, stakes);
    const otherStakes = [{ address: "A", stake: 1 }]; // different set
    expect(verifyPoSBlock(b1, g, otherStakes)).toBe(false);
  });
});
