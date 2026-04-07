"use strict";

const { httpGet } = require("../http");

exports.alias = "w";
exports.description = "Query wallet balance and state";

exports.run = async function (opts) {
  const base = `http://localhost:${opts.port}`;

  if (opts.address) {
    const data = await httpGet(`${base}/state/${opts.address}`);
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log(
    "Usage: cli wallet [options]\n\n" +
      "  --address <hex>  Get balance & nonce for address\n" +
      "  --port <n>       Node port (default: 8080)"
  );
};
