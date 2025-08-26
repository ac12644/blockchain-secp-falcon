// Wallet key persistence (simple FS)

const fs = require("fs");
const path = require("path");
const CryptoAdapter = require("./cryptoAdapter");

const WALLET_DIR = path.join(process.cwd(), "wallet");
const PRIV = path.join(WALLET_DIR, "private_key");
const PUB = path.join(WALLET_DIR, "public_key");

async function loadOrCreateKeys() {
  if (!fs.existsSync(WALLET_DIR)) fs.mkdirSync(WALLET_DIR, { recursive: true });

  let privateKey, publicKey;
  if (fs.existsSync(PRIV) && fs.existsSync(PUB)) {
    privateKey = fs.readFileSync(PRIV);
    publicKey = fs.readFileSync(PUB);
  } else {
    const kp = await CryptoAdapter.generateKeyPair();
    privateKey = kp.privateKey;
    publicKey = kp.publicKey;
    fs.writeFileSync(PRIV, privateKey);
    fs.writeFileSync(PUB, publicKey);
  }
  const address = CryptoAdapter.getAddress(publicKey);
  return { privateKey, publicKey, address };
}

module.exports = { loadOrCreateKeys };
