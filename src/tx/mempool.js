// Transaction mempool: pending tx pool with fee-sorted selection

const { verifyTransaction, canonicalMessage } = require("./transaction");
const { getChainStateSnapshot } = require("../core/state");

const pending = new Map(); // txHash -> tx

const { createHash } = require("crypto");

function txHash(tx) {
  return createHash("sha256")
    .update(canonicalMessage(tx) + "|" + (tx.signature || ""))
    .digest("hex");
}

/**
 * Add a transaction to the mempool after validation.
 * @param {object} tx - signed transaction
 * @param {Array} chain - current chain (for state)
 * @returns {{ ok: boolean, error?: string, hash?: string }}
 */
async function addToMempool(tx, chain) {
  const state = getChainStateSnapshot(chain);

  // apply pending txs from same sender to state so nonce checks work
  for (const [, ptx] of pending) {
    if (ptx.fromAddress === tx.fromAddress) {
      const acc = state.get(ptx.fromAddress) || { balance: 0, nonce: 0 };
      acc.balance -= ptx.amount + ptx.fee;
      acc.nonce = ptx.nonce;
      state.set(ptx.fromAddress, acc);
    }
  }

  const valid = await verifyTransaction(tx, state);
  if (!valid) return { ok: false, error: "transaction validation failed" };

  const hash = txHash(tx);
  if (pending.has(hash)) return { ok: false, error: "duplicate transaction" };

  pending.set(hash, tx);
  return { ok: true, hash };
}

/**
 * Select up to `limit` transactions from mempool, sorted by fee descending.
 */
function selectTransactions(limit = 50) {
  const sorted = [...pending.values()].sort((a, b) => b.fee - a.fee);
  return sorted.slice(0, limit);
}

/**
 * Remove confirmed transactions (by matching canonical fields).
 */
function removeConfirmed(txns) {
  for (const tx of txns) {
    const hash = txHash(tx);
    pending.delete(hash);
  }
}

/**
 * Number of pending transactions.
 */
function size() {
  return pending.size;
}

/**
 * Get all pending transactions (for inspection).
 */
function getPending() {
  return [...pending.values()];
}

module.exports = { addToMempool, selectTransactions, removeConfirmed, size, getPending };
