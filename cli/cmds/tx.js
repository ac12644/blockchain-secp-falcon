"use strict";

const fs = require("fs");
const path = require("path");
const { httpPost, httpGet } = require("../http");

exports.alias = "t";
exports.description = "Submit a signed transaction";

exports.run = async function (opts) {
  const base = `http://localhost:${opts.port}`;

  if (!opts.to || opts.amount === undefined) {
    console.log(
      "Usage: cli tx [options]\n\n" +
        "  --to <address>      Recipient address (40-char hex)\n" +
        "  --amount <n>        Amount to send\n" +
        "  --fee <n>           Fee (default: 1)\n" +
        "  --wallet <path>     Wallet directory (default: ./wallet)\n" +
        "  --port <n>          Node port (default: 8080)"
    );
    return;
  }

  const walletDir = opts.wallet || path.join(process.cwd(), "wallet");
  const privPath = path.join(walletDir, "private_key");
  const pubPath = path.join(walletDir, "public_key");

  if (!fs.existsSync(privPath) || !fs.existsSync(pubPath)) {
    console.error(
      `Wallet not found at ${walletDir}\n` +
        "Start the node once to auto-generate keys, or specify --wallet <path>"
    );
    process.exit(1);
  }

  const privateKey = fs.readFileSync(privPath);
  const publicKey = fs.readFileSync(pubPath);

  const CryptoAdapter = require("../../src/crypto/cryptoAdapter");
  const { signTransferTx } = require("../../src/tx/transaction");

  const fromAddress = CryptoAdapter.getAddress(publicKey);
  const fee = opts.fee !== undefined ? Number(opts.fee) : 1;

  // Fetch current nonce from node
  const acct = await httpGet(`${base}/state/${fromAddress}`);
  const nonce = (acct.nonce || 0) + 1;

  const tx = await signTransferTx({
    fromAddress,
    toAddress: opts.to,
    amount: Number(opts.amount),
    fee,
    nonce,
    privateKey,
    publicKey,
  });

  const result = await httpPost(`${base}/tx`, tx);

  if (result.ok) {
    console.log("Transaction submitted");
    console.log(`  Hash:    ${result.hash}`);
    console.log(`  From:    ${fromAddress}`);
    console.log(`  To:      ${opts.to}`);
    console.log(`  Amount:  ${opts.amount}`);
    console.log(`  Fee:     ${fee}`);
    console.log(`  Nonce:   ${nonce}`);
    console.log(`  Queued:  ${result.queued} pending`);
  } else {
    console.error("Transaction failed:", result.error || "unknown error");
    process.exit(1);
  }
};
