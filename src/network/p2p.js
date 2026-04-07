const crypto = require("crypto");
const Hyperswarm = require("hyperswarm");
const {
  chain,
  addBlock,
  replaceChain,
  getLatestBlock,
  generateNextBlock,
} = require("../core/chain");
const { selectTransactions, removeConfirmed } = require("../tx/mempool");

const MessageType = {
  REQUEST_BLOCK: "requestBlock",
  RECEIVE_NEXT_BLOCK: "receiveNextBlock",
  REQUEST_FULL_CHAIN: "requestFullChain",
  RECEIVE_FULL_CHAIN: "receiveFullChain",
  RECEIVE_NEW_BLOCK: "receiveNewBlock",
  HEARTBEAT: "heartbeat",
};

const CONSENSUS_MODE = (process.env.CONSENSUS_MODE || "pow").toLowerCase();
const MAX_PEERS = 50;
const MAX_MSG_SIZE = 10 * 1024 * 1024; // 10 MB

// 32-byte topic derived from network name
const TOPIC = crypto.createHash("sha256").update("myBlockchain").digest();

function startP2P(stakes = [], minerAddress = "") {
  const swarm = new Hyperswarm({ maxPeers: MAX_PEERS });
  const peers = new Map(); // remotePublicKey hex -> conn
  let connSeq = 0;

  const send = (peerId, type, data) => {
    const conn = peers.get(peerId);
    if (!conn) return;
    try {
      conn.write(JSON.stringify({ type, data }));
    } catch (err) {
      console.warn(`[p2p] write error to ${peerId.slice(0, 8)}...:`, err.message);
    }
  };

  const broadcast = (type, data) => {
    for (const id of peers.keys()) {
      send(id, type, data);
    }
  };

  // Join the network
  swarm.join(TOPIC, { server: true, client: true });
  console.log(`[p2p] joining topic ${TOPIC.toString("hex").slice(0, 16)}...`);

  swarm.on("connection", (conn, info) => {
    const seq = connSeq++;
    const peerId = conn.remotePublicKey.toString("hex");

    if (peers.size >= MAX_PEERS) {
      console.warn(`[p2p] max peers (${MAX_PEERS}) reached, rejecting`);
      conn.destroy();
      return;
    }

    peers.set(peerId, conn);
    console.log(`[p2p] connected #${seq} to peer ${peerId.slice(0, 12)}...`);

    // Ask for next block and full chain on connect
    setTimeout(() => {
      broadcast(MessageType.REQUEST_BLOCK, {
        index: getLatestBlock().index + 1,
      });
      send(peerId, MessageType.REQUEST_FULL_CHAIN, {});
    }, 500);

    conn.on("data", async (raw) => {
      if (raw.length > MAX_MSG_SIZE) {
        console.warn(`[p2p] oversized message (${raw.length}B) from ${peerId.slice(0, 8)}...`);
        return;
      }
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        console.warn(`[p2p] malformed JSON from ${peerId.slice(0, 8)}...`);
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
          const ok = await addBlock(msg.data, stakes);
          if (!ok) send(peerId, MessageType.REQUEST_FULL_CHAIN, {});
          break;
        }
        case MessageType.REQUEST_FULL_CHAIN: {
          send(peerId, MessageType.RECEIVE_FULL_CHAIN, chain);
          break;
        }
        case MessageType.RECEIVE_FULL_CHAIN: {
          const ok = await replaceChain(msg.data, stakes);
          if (ok) console.log("[p2p] chain replaced from peer");
          break;
        }
        case MessageType.RECEIVE_NEW_BLOCK: {
          const ok = await addBlock(msg.data, stakes);
          if (!ok) send(peerId, MessageType.REQUEST_FULL_CHAIN, {});
          break;
        }
        case MessageType.HEARTBEAT:
          break;
        default:
          break;
      }
    });

    conn.on("close", () => {
      peers.delete(peerId);
      console.log(`[p2p] disconnected peer ${peerId.slice(0, 12)}...`);
    });

    conn.on("error", (err) => {
      console.warn(`[p2p] conn error ${peerId.slice(0, 8)}...:`, err.message);
    });
  });

  // Periodic heartbeat & next-block request
  setInterval(() => {
    broadcast(MessageType.HEARTBEAT, { tip: getLatestBlock().index });
    broadcast(MessageType.REQUEST_BLOCK, {
      index: getLatestBlock().index + 1,
    });
  }, 5000);

  // Demo miner: PoW only, every 10s with 30% chance
  setInterval(async () => {
    if (CONSENSUS_MODE !== "pow") return;
    if (Math.random() < 0.3) {
      console.log("[miner] attempting to propose a block...");
      const txns = selectTransactions();
      const block = generateNextBlock(txns, stakes, minerAddress);
      const ok = await addBlock(block, stakes);
      if (ok) {
        removeConfirmed(block.txns);
        console.log("[miner] proposed block, broadcasting to peers");
        broadcast(MessageType.RECEIVE_NEW_BLOCK, block);
      } else {
        console.log("[miner] proposal failed validation");
      }
    }
  }, 10_000);

  return { MessageType, broadcast, swarm };
}

module.exports = { startP2P };
