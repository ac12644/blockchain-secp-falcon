const express = require("express");
const bodyParser = require("body-parser");
const getPort = require("get-port");
const {
  chain,
  getLatestBlock,
  addBlock,
  generateNextBlock,
} = require("../core/chain");
const { buildStateFromChain } = require("../core/state");

/**
 * Start HTTP server.
 * @param {number|undefined} preferredPort
 * @param {Array<{address:string, stake:number}>} stakes
 * @param {(type:string, data:any)=>void} broadcast - P2P broadcast function
 */
async function startHttpServer(
  preferredPort,
  stakes = [],
  broadcast = () => {}
) {
  const app = express();
  app.use(bodyParser.json());

  app.get("/blocks", (req, res) => res.json(chain));

  app.get("/block/:index", (req, res) => {
    const idx = Number(req.params.index);
    if (Number.isNaN(idx) || idx < 0 || idx >= chain.length)
      return res.status(404).json({ error: "not found" });
    res.json(chain[idx]);
  });

  app.get("/state/:address", (req, res) => {
    const state = buildStateFromChain(chain);
    res.json(state.get(req.params.address) || { balance: 0, nonce: 0 });
  });

  app.post("/tx", async (req, res) => {
    try {
      const tx = req.body;
      const block = generateNextBlock([tx], stakes);
      const ok = await addBlock(block, stakes);
      if (ok) broadcast("receiveNewBlock", block);
      return res.json({ ok, block });
    } catch (e) {
      return res
        .status(400)
        .json({ ok: false, error: e?.message || String(e) });
    }
  });

  // 👉 new: force-mine an empty block (uses very easy nBits when in PoW)
  app.post("/mine", async (req, res) => {
    try {
      // when in PoW, pass an easy compact target so it solves instantly
      const EASY_NBITS = 0x207fffff;
      const block = generateNextBlock([], stakes, EASY_NBITS);
      const ok = await addBlock(block, stakes);
      if (ok) {
        broadcast("receiveNewBlock", block);
        return res.json({ ok: true, mined: true, block });
      }
      return res.status(400).json({ ok: false, mined: false });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: e?.message || String(e) });
    }
  });

  app.get("/latest", (req, res) => res.json(getLatestBlock()));

  const port = await getPort({
    port: preferredPort ? Number(preferredPort) : getPort.makeRange(8080, 8999),
  });

  await new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`[http] listening on :${port}`);
      resolve();
    });
  });

  return { app, port };
}

module.exports = { startHttpServer };
