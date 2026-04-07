// Transaction model + verification (requires publicKey, nonce, fee)

const CryptoAdapter = require("../crypto/cryptoAdapter");
const { getAccountState } = require("../core/state");

// Block reward (halves every HALVING_INTERVAL blocks)
const INITIAL_REWARD = 50;
const HALVING_INTERVAL = 210_000;
const COINBASE_ADDRESS = "0".repeat(40);

function blockReward(blockIndex) {
  const halvings = Math.floor(blockIndex / HALVING_INTERVAL);
  if (halvings >= 64) return 0;
  return INITIAL_REWARD / 2 ** halvings;
}

function createCoinbaseTx(minerAddress, blockIndex, fees = 0) {
  return {
    type: "coinbase",
    fromAddress: COINBASE_ADDRESS,
    toAddress: minerAddress,
    amount: blockReward(blockIndex) + fees,
    fee: 0,
    nonce: 0,
  };
}

function isCoinbase(tx) {
  return tx.type === "coinbase" && tx.fromAddress === COINBASE_ADDRESS;
}

function verifyCoinbaseTx(tx, blockIndex, txns) {
  if (!tx || tx.fromAddress !== COINBASE_ADDRESS) return false;
  if (tx.type !== "coinbase") return false;
  if (!tx.toAddress || typeof tx.toAddress !== "string") return false;
  if (tx.fee !== 0 || tx.nonce !== 0) return false;

  const fees = txns.reduce((sum, t) => sum + (t.fee || 0), 0);
  const expected = blockReward(blockIndex) + fees;
  if (tx.amount !== expected) return false;
  return true;
}

function canonicalMessage(tx) {
  // Order matters: changing order breaks signatures
  return [tx.fromAddress, tx.toAddress, tx.amount, tx.fee, tx.nonce].join("|");
}

async function verifyTransaction(tx, chainState) {
  // coinbase txs are validated separately
  if (isCoinbase(tx)) return false;

  // shape and bounds
  const MAX_SAFE = Number.MAX_SAFE_INTEGER;
  const okShape =
    tx &&
    typeof tx.fromAddress === "string" &&
    /^[a-f0-9]{40}$/i.test(tx.fromAddress) &&
    typeof tx.toAddress === "string" &&
    /^[a-f0-9]{40}$/i.test(tx.toAddress) &&
    Number.isFinite(tx.amount) &&
    tx.amount > 0 &&
    tx.amount <= MAX_SAFE &&
    Number.isFinite(tx.fee) &&
    tx.fee >= 0 &&
    tx.fee <= MAX_SAFE &&
    Number.isInteger(tx.nonce) &&
    tx.nonce > 0 &&
    tx.publicKey &&
    tx.signature;
  if (!okShape) return false;

  // address must derive from public key
  const derived = CryptoAdapter.getAddress(tx.publicKey);
  if (derived !== tx.fromAddress) return false;

  // signature
  const msg = canonicalMessage(tx);
  const sigOk = await CryptoAdapter.verify(msg, tx.signature, tx.publicKey);
  if (!sigOk) return false;

  // nonce and balance
  const acct = getAccountState(chainState, tx.fromAddress);
  if (acct.nonce + 1 !== tx.nonce) return false;
  if (acct.balance < tx.amount + tx.fee) return false;

  return true;
}

// helper to construct & sign a tx
async function signTransferTx({
  fromAddress,
  toAddress,
  amount,
  fee,
  nonce,
  privateKey,
  publicKey,
}) {
  const tx = { fromAddress, toAddress, amount, fee, nonce, publicKey };
  const msg = canonicalMessage(tx);
  tx.signature = await CryptoAdapter.sign(msg, privateKey);
  return tx;
}

module.exports = {
  verifyTransaction,
  signTransferTx,
  canonicalMessage,
  createCoinbaseTx,
  verifyCoinbaseTx,
  isCoinbase,
  blockReward,
  COINBASE_ADDRESS,
  INITIAL_REWARD,
  HALVING_INTERVAL,
};
