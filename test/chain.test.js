// basic end-to-end: create a valid PoW block and add it to the chain
// we re-require the module to reset in-memory chain each test

describe("Chain (PoW)", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.CONSENSUS_MODE = "pow";
  });

  test("addBlock accepts valid PoW block and rejects bad timestamp", async () => {
    const chain = require("../src/core/chain");
    const { generateNextBlock, addBlock, getLatestBlock } = chain;

    const b1 = generateNextBlock([], [], 0x207fffff); // easy
    const ok = await addBlock(b1, []);
    expect(ok).toBe(true);
    expect(getLatestBlock().index).toBe(1);

    // clone b1 but make timestamp go backwards
    const bad = JSON.parse(JSON.stringify(b1));
    bad.blockHeader.time = 1; // older than genesis
    bad.hash = require("../src/core/block").hashHeader(bad.blockHeader);
    const ok2 = await addBlock(bad, []);
    expect(ok2).toBe(false);
  });
});
