const express = require("express");
const {
  chain,
  getLatestBlock,
  addBlock,
  generateNextBlock,
} = require("../core/chain");
const { getChainState } = require("../core/state");
const {
  addToMempool,
  selectTransactions,
  removeConfirmed,
  size: mempoolSize,
  getPending,
} = require("../tx/mempool");

/**
 * Start HTTP server.
 * @param {number|undefined} preferredPort
 * @param {Array<{address:string, stake:number}>} stakes
 * @param {(type:string, data:any)=>void} broadcast - P2P broadcast function
 */
async function startHttpServer(
  preferredPort,
  stakes = [],
  minerAddress = "",
  broadcast = () => {}
) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));

  app.get("/blocks", (req, res) => res.json(chain));

  app.get("/block/:index", (req, res) => {
    const idx = Number(req.params.index);
    if (Number.isNaN(idx) || idx < 0 || idx >= chain.length)
      return res.status(404).json({ error: "not found" });
    res.json(chain[idx]);
  });

  app.get("/state/:address", (req, res) => {
    const addr = req.params.address;
    if (!/^[a-f0-9]{40}$/i.test(addr))
      return res.status(400).json({ error: "invalid address format" });
    const state = getChainState(chain);
    const acct = state.get(addr);
    res.json(acct ? { ...acct } : { balance: 0, nonce: 0 });
  });

  app.get("/mempool", (req, res) => {
    res.json({ size: mempoolSize(), transactions: getPending() });
  });

  app.post("/tx", async (req, res) => {
    try {
      const result = await addToMempool(req.body, chain);
      if (!result.ok)
        return res.status(400).json({ ok: false, error: result.error });
      return res.json({ ok: true, hash: result.hash, queued: mempoolSize() });
    } catch (e) {
      return res
        .status(400)
        .json({ ok: false, error: e?.message || String(e) });
    }
  });

  app.post("/mine", async (req, res) => {
    try {
      const txns = selectTransactions();
      const block = generateNextBlock(txns, stakes, minerAddress);
      const ok = await addBlock(block, stakes);
      if (ok) {
        removeConfirmed(block.txns);
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

  const { default: getPort, portNumbers } = await import("get-port");
  const port = await getPort({
    port: preferredPort ? Number(preferredPort) : portNumbers(8080, 8999),
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
