// Minimal account state (balances + nonces) derived from chain

function emptyAccount() {
  return { balance: 0, nonce: 0 };
}

function buildStateFromChain(chain) {
  const state = new Map();
  for (const block of chain) {
    for (const tx of block.txns || []) {
      const from = state.get(tx.fromAddress) || emptyAccount();
      const to = state.get(tx.toAddress) || emptyAccount();

      from.balance -= tx.amount + tx.fee;
      from.nonce = Math.max(from.nonce, tx.nonce); // last seen nonce
      to.balance += tx.amount;

      state.set(tx.fromAddress, from);
      state.set(tx.toAddress, to);
    }
  }
  return state;
}

function getAccountState(stateMap, addr) {
  return stateMap.get(addr) || emptyAccount();
}

module.exports = {
  buildStateFromChain,
  getAccountState,
};
