// Transaction model + verification (requires publicKey, nonce, fee)

const CryptoAdapter = require("../crypto/cryptoAdapter");
const { getAccountState } = require("../core/state");

function canonicalMessage(tx) {
  // Order matters: changing order breaks signatures
  return [tx.fromAddress, tx.toAddress, tx.amount, tx.fee, tx.nonce].join("|");
}

async function verifyTransaction(tx, chainState) {
  // shape
  const okShape =
    tx &&
    tx.fromAddress &&
    tx.toAddress &&
    Number.isFinite(tx.amount) &&
    tx.amount >= 0 &&
    Number.isFinite(tx.fee) &&
    tx.fee >= 0 &&
    Number.isInteger(tx.nonce) &&
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

module.exports = { verifyTransaction, signTransferTx, canonicalMessage };
