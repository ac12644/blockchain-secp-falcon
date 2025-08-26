const crypto = require("crypto");
const Swarm = require("discovery-swarm");
const defaults = require("dat-swarm-defaults");
const getPort = require("get-port");
const {
  chain,
  addBlock,
  replaceChain,
  getLatestBlock,
  generateNextBlock,
} = require("../core/chain");

const MessageType = {
  REQUEST_BLOCK: "requestBlock",
  RECEIVE_NEXT_BLOCK: "receiveNextBlock",
  REQUEST_FULL_CHAIN: "requestFullChain",
  RECEIVE_FULL_CHAIN: "receiveFullChain",
  RECEIVE_NEW_BLOCK: "receiveNewBlock",
  HEARTBEAT: "heartbeat",
};

function startP2P(stakes = []) {
  const myPeerId = crypto.randomBytes(32);
  const config = defaults({ id: myPeerId });
  const swarm = Swarm(config);
  const peers = {};
  let connSeq = 0;

  const send = (toId, type, data) => {
    if (!peers[toId]) return;
    try {
      peers[toId].conn.write(JSON.stringify({ type, data }));
    } catch {}
  };
  const broadcast = (type, data) => {
    Object.keys(peers).forEach((id) => send(id, type, data));
  };

  (async () => {
    const port = await getPort();
    swarm.listen(port);
    console.log(`[p2p] listening on ${port}`);
    swarm.join("myBlockchain");

    swarm.on("connection", (conn, info) => {
      const seq = connSeq++;
      const peerId = info.id.toString("hex");
      peers[peerId] = { conn, seq };
      console.log(`[p2p] connected #${seq} to peer ${peerId}`);

      if (info.initiator)
        try {
          conn.setKeepAlive(true, 600);
        } catch {}

      // ask for next block and also full chain (simple)
      setTimeout(() => {
        broadcast(MessageType.REQUEST_BLOCK, {
          index: getLatestBlock().index + 1,
        });
        send(peerId, MessageType.REQUEST_FULL_CHAIN, {});
      }, 500);

      conn.on("data", async (raw) => {
        let msg;
        try {
          msg = JSON.parse(String(raw));
        } catch {
          return;
        }
        switch (msg.type) {
          case MessageType.REQUEST_BLOCK: {
            const idx = msg.data.index;
            const b = chain[idx];
            if (b) send(peerId, MessageType.RECEIVE_NEXT_BLOCK, b);
            break;
          }
          case MessageType.RECEIVE_NEXT_BLOCK: {
            const b = msg.data;
            const ok = await addBlock(b, stakes);
            if (!ok) send(peerId, MessageType.REQUEST_FULL_CHAIN, {});
            break;
          }
          case MessageType.REQUEST_FULL_CHAIN: {
            send(peerId, MessageType.RECEIVE_FULL_CHAIN, chain);
            break;
          }
          case MessageType.RECEIVE_FULL_CHAIN: {
            const ok = replaceChain(msg.data, stakes);
            if (ok) console.log("[p2p] chain replaced from peer");
            break;
          }
          case MessageType.RECEIVE_NEW_BLOCK: {
            const b = msg.data;
            const ok = await addBlock(b, stakes);
            if (!ok) send(peerId, MessageType.REQUEST_FULL_CHAIN, {});
            break;
          }
          case MessageType.HEARTBEAT: {
            // ignore
            break;
          }
          default:
            break;
        }
      });

      conn.on("close", () => {
        if (peers[peerId]?.seq === seq) {
          delete peers[peerId];
          console.log(`[p2p] disconnected peer ${peerId}`);
        }
      });
    });

    // periodic heartbeat & next-block request (helps late joiners)
    setInterval(() => {
      broadcast(MessageType.HEARTBEAT, { tip: getLatestBlock().index });
      broadcast(MessageType.REQUEST_BLOCK, {
        index: getLatestBlock().index + 1,
      });
    }, 5000);

    // demo miner: every 10s with 30% chance (visible) — PoW difficulty is handled by HTTP /mine too
    setInterval(async () => {
      if (Math.random() < 0.3) {
        console.log("[miner] attempting to propose a block...");
        const block = generateNextBlock([], stakes);
        const ok = await addBlock(block, stakes);
        if (ok) {
          console.log("[miner] proposed block, broadcasting to peers");
          broadcast(MessageType.RECEIVE_NEW_BLOCK, block);
        } else {
          console.log("[miner] proposal failed validation");
        }
      }
    }, 10_000);
  })();

  // expose broadcaster so HTTP can announce mined blocks
  return { MessageType, broadcast };
}

module.exports = { startP2P };
