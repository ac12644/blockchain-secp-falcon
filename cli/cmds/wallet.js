"use strict";

const logger = require("../logger");
const { request } = require("undici");

function Wallet(options) {
  this.options = options;
}

Wallet.DETAILS = {
  alias: "w",
  description: "wallet tools",
  commands: ["create", "show", "state"],
  options: {
    create: Boolean, // --create  (init wallet via server if supported)
    show: Boolean, // --show    (GET /wallet if exposed)
    state: Boolean, // --state   (GET /state/:address)
    address: String, // --address <addr>  (for --state)
    port: Number, // --port <number>
  },
  shorthands: {
    c: ["--create"],
    s: ["--show"],
    a: ["--address"],
    p: ["--port"],
  },
  payload: function () {},
};

async function httpJson(url, method = "GET", body) {
  const res = await request(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.body.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

Wallet.prototype.run = async function () {
  const options = this.options;
  const port = Number(options.port || process.env.HTTP_PORT || 8080);

  try {
    if (options.create) {
      // if your API doesn’t expose a create endpoint, you can remove this
      const url = `http://localhost:${port}/wallet`;
      const data = await httpJson(url, "POST", {}); // or GET depending on your server
      logger.log(JSON.stringify(data, null, 2));
      return;
    }

    if (options.show) {
      const url = `http://localhost:${port}/wallet`;
      const data = await httpJson(url);
      logger.log(JSON.stringify(data, null, 2));
      return;
    }

    if (options.state) {
      if (!options.address) {
        logger.error("Missing --address <addr> for --state");
      }
      const url = `http://localhost:${port}/state/${options.address}`;
      const data = await httpJson(url);
      logger.log(JSON.stringify(data, null, 2));
      return;
    }

    logger.log(
      "usage: cli wallet --show [--port 8080] | --state --address <addr> [--port 8080]"
    );
  } catch (err) {
    logger.error(err.message || String(err));
  }
};

exports.Impl = Wallet;
