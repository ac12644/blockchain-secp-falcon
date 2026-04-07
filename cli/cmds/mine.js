"use strict";

const { httpPost } = require("../http");

exports.alias = "m";
exports.description = "Mine a new block (includes mempool txs)";

exports.run = async function (opts) {
  const base = `http://localhost:${opts.port}`;
  const data = await httpPost(`${base}/mine`);

  if (data.ok) {
    console.log(`Block #${data.block.index} mined successfully`);
    console.log(`  Hash:  ${data.block.hash}`);
    console.log(`  Txns:  ${data.block.txns.length}`);
  } else {
    console.error("Mining failed:", data.error || "unknown error");
    process.exit(1);
  }
};
