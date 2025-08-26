require("dotenv").config();

const { startHttpServer } = require("./network/http");
const { startP2P } = require("./network/p2p");
const { initWallet } = require("./wallet/wallet");

(async () => {
  try {
    const consensus = (process.env.CONSENSUS_MODE || "pow").toLowerCase();
    const cryptoMode = (process.env.CRYPTO_MODE || "secp256k1").toLowerCase();

    console.log("===========================================");
    console.log("   Blockchain Node Starting...");
    console.log("   Consensus Mode:", consensus.toUpperCase());
    console.log("   Crypto Algorithm:", cryptoMode);
    console.log("===========================================");

    const myWallet = await initWallet();
    console.log("[wallet] address:", myWallet.address);

    const stakes = [{ address: myWallet.address, stake: 100 }];

    // Start P2P first to get broadcaster
    const p2p = startP2P(stakes);
    const preferredPort = process.env.HTTP_PORT
      ? Number(process.env.HTTP_PORT)
      : undefined;

    await startHttpServer(preferredPort, stakes, (type, data) => {
      // normalise type name for our p2p switch
      if (type === "receiveNewBlock") {
        p2p.broadcast("receiveNewBlock", data);
      } else {
        p2p.broadcast(type, data);
      }
    });
  } catch (err) {
    console.error("[fatal] failed to start node:", err);
    process.exit(1);
  }
})();
