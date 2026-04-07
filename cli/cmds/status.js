"use strict";

const { httpGet } = require("../http");

exports.alias = "s";
exports.description = "Show node status overview";

exports.run = async function (opts) {
  const base = `http://localhost:${opts.port}`;

  const [latest, mempool] = await Promise.all([
    httpGet(`${base}/latest`),
    httpGet(`${base}/mempool`),
  ]);

  console.log("Node Status");
  console.log("───────────────────────────────────────");
  console.log(`  Chain height:   ${latest.index}`);
  console.log(`  Latest hash:    ${latest.hash}`);
  console.log(`  Block time:     ${new Date(latest.blockHeader.time * 1000).toISOString()}`);
  console.log(`  Difficulty:     0x${latest.blockHeader.nBits.toString(16)}`);
  console.log(`  Transactions:   ${(latest.txns || []).length} in latest block`);
  console.log(`  Mempool:        ${mempool.size} pending`);
  console.log(`  Port:           ${opts.port}`);
};
