"use strict";

const { httpGet } = require("../http");

exports.alias = "b";
exports.description = "Query blocks from running node";

exports.run = async function (opts) {
  const base = `http://localhost:${opts.port}`;

  if (opts.latest) {
    const data = await httpGet(`${base}/latest`);
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (opts.index !== undefined) {
    const data = await httpGet(`${base}/block/${opts.index}`);
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (opts.all) {
    const data = await httpGet(`${base}/blocks`);
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log(
    "Usage: cli block [options]\n\n" +
      "  --index <n>   Get block by index\n" +
      "  --latest      Get latest block\n" +
      "  --all         Get entire chain\n" +
      "  --port <n>    Node port (default: 8080)"
  );
};
