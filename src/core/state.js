// Minimal account state (balances + nonces) derived from chain
// Maintains an incremental cache to avoid rebuilding from genesis.

const COINBASE_ADDRESS = "0".repeat(40);

function emptyAccount() {
  return { balance: 0, nonce: 0 };
}

// --- Incremental cache ---
let cachedState = new Map();
let cachedHeight = -1; // index of last block applied

function applyBlock(state, block) {
  for (const tx of block.txns || []) {
    if (tx.type === "coinbase" && tx.fromAddress === COINBASE_ADDRESS) {
      const to = state.get(tx.toAddress) || emptyAccount();
      to.balance += tx.amount;
      state.set(tx.toAddress, to);
      continue;
    }

    const from = state.get(tx.fromAddress) || emptyAccount();
    const to = state.get(tx.toAddress) || emptyAccount();

    from.balance -= tx.amount + tx.fee;
    from.nonce = Math.max(from.nonce, tx.nonce);
    to.balance += tx.amount;

    state.set(tx.fromAddress, from);
    state.set(tx.toAddress, to);
  }
}

/**
 * Get current chain state, using incremental cache.
 * Only processes blocks added since last call.
 */
function getChainState(chain) {
  const chainTip = chain.length - 1;

  // If chain was replaced (shorter or diverged), rebuild from scratch
  if (chainTip < cachedHeight) {
    cachedState = new Map();
    cachedHeight = -1;
  }

  // Apply only new blocks
  for (let i = cachedHeight + 1; i <= chainTip; i++) {
    applyBlock(cachedState, chain[i]);
  }
  cachedHeight = chainTip;

  return cachedState;
}

/**
 * Get a snapshot copy of current state (safe for mutation by callers).
 */
function getChainStateSnapshot(chain) {
  const live = getChainState(chain);
  const snapshot = new Map();
  for (const [addr, acct] of live) {
    snapshot.set(addr, { ...acct });
  }
  return snapshot;
}

/**
 * Rebuild state from scratch (no cache). Used for chain validation.
 */
function buildStateFromChain(chain) {
  const state = new Map();
  for (const block of chain) {
    applyBlock(state, block);
  }
  return state;
}

/**
 * Invalidate cache (call after replaceChain).
 */
function invalidateCache() {
  cachedState = new Map();
  cachedHeight = -1;
}

function getAccountState(stateMap, addr) {
  return stateMap.get(addr) || emptyAccount();
}

module.exports = {
  buildStateFromChain,
  getChainState,
  getChainStateSnapshot,
  getAccountState,
  invalidateCache,
};
