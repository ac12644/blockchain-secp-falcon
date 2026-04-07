"use strict";

const { httpGet } = require("../http");

exports.alias = "mp";
exports.description = "Show pending transactions in mempool";

exports.run = async function (opts) {
  const base = `http://localhost:${opts.port}`;
  const data = await httpGet(`${base}/mempool`);

  console.log(`Mempool: ${data.size} pending transaction(s)\n`);

  if (data.transactions && data.transactions.length > 0) {
    for (const tx of data.transactions) {
      console.log(`  ${tx.fromAddress.slice(0, 8)}... -> ${tx.toAddress.slice(0, 8)}...  amount=${tx.amount}  fee=${tx.fee}  nonce=${tx.nonce}`);
    }
  }
};
