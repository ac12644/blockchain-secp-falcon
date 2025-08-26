// Pluggable crypto: secp256k1 (default) and Falcon-512 (optional via pqclean)

const { createHash } = require("crypto");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

const CRYPTO_MODE = process.env.CRYPTO_MODE || "secp256k1";

let pqclean;
try {
  pqclean = require("pqclean");
} catch {
  pqclean = null;
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest();
}

function getAddress(publicKey) {
  // Support Buffer/Uint8Array or hex string
  const buf = Buffer.isBuffer(publicKey)
    ? publicKey
    : typeof publicKey === "string"
    ? Buffer.from(publicKey.replace(/^0x/, ""), "hex")
    : Buffer.from(publicKey);
  return sha256(buf).toString("hex").slice(0, 40);
}

async function generateKeyPair() {
  if (CRYPTO_MODE === "falcon") {
    if (!pqclean) throw new Error("pqclean not installed");
    const { sign } = pqclean;
    const kp = await sign.generateKeyPair("falcon-512");
    return {
      privateKey: Buffer.from(kp.privateKey.export()),
      publicKey: Buffer.from(kp.publicKey.export()),
    };
  }
  const key = ec.genKeyPair();
  return {
    privateKey: Buffer.from(key.getPrivate("hex"), "hex"),
    publicKey: Buffer.from(key.getPublic("hex"), "hex"),
  };
}

async function sign(message, privateKey) {
  if (CRYPTO_MODE === "falcon") {
    const { sign } = pqclean || {};
    const sk = new sign.PrivateKey("falcon-512", Buffer.from(privateKey));
    const sig = await sk.sign(Buffer.from(message, "utf8"));
    return Buffer.from(sig).toString("hex");
  }
  const key = ec.keyFromPrivate(Buffer.from(privateKey).toString("hex"), "hex");
  const msgHash = sha256(Buffer.from(message, "utf8"));
  return key.sign(msgHash).toDER("hex");
}

async function verify(message, signatureHex, publicKey) {
  if (CRYPTO_MODE === "falcon") {
    const { sign } = pqclean || {};
    const pk = new sign.PublicKey("falcon-512", Buffer.from(publicKey));
    return pk.verify(
      Buffer.from(message, "utf8"),
      Buffer.from(signatureHex, "hex")
    );
  }
  const key = ec.keyFromPublic(Buffer.from(publicKey).toString("hex"), "hex");
  const msgHash = sha256(Buffer.from(message, "utf8"));
  return key.verify(msgHash, signatureHex);
}

module.exports = { generateKeyPair, getAddress, sign, verify };
