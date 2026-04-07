// Pluggable crypto: secp256k1 via Node built-in crypto (default) and Falcon-512 (optional via pqclean)

const { createHash, generateKeyPairSync, sign, verify, createPublicKey, createPrivateKey } = require("crypto");

const SUPPORTED = ["secp256k1", "falcon"];
const CRYPTO_MODE = (process.env.CRYPTO_MODE || "secp256k1").toLowerCase();

// Validate on load — fail fast on typos
if (!SUPPORTED.includes(CRYPTO_MODE)) {
  console.error(`[crypto] Invalid CRYPTO_MODE="${CRYPTO_MODE}". Must be one of: ${SUPPORTED.join(", ")}`);
  process.exit(1);
}

let pqclean;
try {
  pqclean = require("pqclean");
} catch {
  pqclean = null;
}

if (CRYPTO_MODE === "falcon" && !pqclean) {
  console.error('[crypto] CRYPTO_MODE=falcon requires "pqclean" package. Install with: npm install pqclean');
  process.exit(1);
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest();
}

function getAddress(publicKey) {
  const buf = Buffer.isBuffer(publicKey)
    ? publicKey
    : typeof publicKey === "string"
    ? Buffer.from(publicKey.replace(/^0x/, ""), "hex")
    : Buffer.from(publicKey);
  return sha256(buf).toString("hex").slice(0, 40);
}

async function generateKeyPair() {
  if (CRYPTO_MODE === "falcon") {
    const { sign: falconSign } = pqclean;
    const kp = await falconSign.generateKeyPair("falcon-512");
    return {
      privateKey: Buffer.from(kp.privateKey.export()),
      publicKey: Buffer.from(kp.publicKey.export()),
    };
  }

  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "secp256k1",
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });

  return {
    privateKey: Buffer.from(privateKey),
    publicKey: Buffer.from(publicKey),
  };
}

async function signMessage(message, privateKey) {
  if (CRYPTO_MODE === "falcon") {
    const { sign: falconSign } = pqclean;
    const sk = new falconSign.PrivateKey("falcon-512", Buffer.from(privateKey));
    const sig = await sk.sign(Buffer.from(message, "utf8"));
    return Buffer.from(sig).toString("hex");
  }

  const keyObj = createPrivateKey({
    key: Buffer.from(privateKey),
    format: "der",
    type: "pkcs8",
  });

  const msgBuf = Buffer.from(message, "utf8");
  const sig = sign("sha256", msgBuf, keyObj);
  return sig.toString("hex");
}

async function verifyMessage(message, signatureHex, publicKey) {
  if (CRYPTO_MODE === "falcon") {
    const { sign: falconSign } = pqclean;
    const pk = new falconSign.PublicKey("falcon-512", Buffer.from(publicKey));
    return pk.verify(
      Buffer.from(message, "utf8"),
      Buffer.from(signatureHex, "hex")
    );
  }

  const keyObj = createPublicKey({
    key: Buffer.from(publicKey),
    format: "der",
    type: "spki",
  });

  const msgBuf = Buffer.from(message, "utf8");
  const sigBuf = Buffer.from(signatureHex, "hex");
  return verify("sha256", msgBuf, keyObj, sigBuf);
}

module.exports = { generateKeyPair, getAddress, sign: signMessage, verify: verifyMessage, CRYPTO_MODE };
