// Wallet key persistence (simple FS)

const fs = require("fs");
const path = require("path");
const CryptoAdapter = require("./cryptoAdapter");

const WALLET_DIR = path.join(process.cwd(), "wallet");
const PRIV = path.join(WALLET_DIR, "private_key");
const PUB = path.join(WALLET_DIR, "public_key");
const META = path.join(WALLET_DIR, "meta.json");

async function loadOrCreateKeys() {
  if (!fs.existsSync(WALLET_DIR)) fs.mkdirSync(WALLET_DIR, { recursive: true });

  let privateKey, publicKey;

  if (fs.existsSync(PRIV) && fs.existsSync(PUB)) {
    // Check for crypto mode mismatch
    if (fs.existsSync(META)) {
      const meta = JSON.parse(fs.readFileSync(META, "utf8"));
      if (meta.cryptoType !== CryptoAdapter.CRYPTO_MODE) {
        console.error(
          `[wallet] Existing wallet uses ${meta.cryptoType} but node is running ${CryptoAdapter.CRYPTO_MODE}.\n` +
          `         Delete ./wallet/ to generate new keys, or change CRYPTO_MODE.`
        );
        process.exit(1);
      }
    }
    privateKey = fs.readFileSync(PRIV);
    publicKey = fs.readFileSync(PUB);
  } else {
    const kp = await CryptoAdapter.generateKeyPair();
    privateKey = kp.privateKey;
    publicKey = kp.publicKey;
    fs.writeFileSync(PRIV, privateKey);
    fs.writeFileSync(PUB, publicKey);
    fs.writeFileSync(META, JSON.stringify({ cryptoType: CryptoAdapter.CRYPTO_MODE }));
    console.log(`[wallet] generated new ${CryptoAdapter.CRYPTO_MODE} keypair`);
  }

  const address = CryptoAdapter.getAddress(publicKey);
  return { privateKey, publicKey, address };
}

const initWallet = loadOrCreateKeys;

module.exports = { loadOrCreateKeys, initWallet };
