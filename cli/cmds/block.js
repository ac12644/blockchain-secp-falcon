"use strict";

const logger = require("../logger");
const nopt = require("nopt");

// use undici (fast native) or node-fetch if you prefer
const { request } = require("undici");

function Block(options) {
  this.options = options;
}

Block.DETAILS = {
  alias: "b",
  description: "block operations",
  commands: ["get", "all"],
  options: {
    get: Boolean, // --get
    all: Boolean, // --all
    port: Number, // --port <number>
    index: Number, // --index <number>
  },
  shorthands: {
    g: ["--get"],
    a: ["--all"],
    p: ["--port"],
    i: ["--index"],
  },
  payload: function (payload, options) {
    // allow: cli block --get --index 1 --port 8080
    // no positional hacks
  },
};

async function httpJson(url) {
  const res = await request(url, { method: "GET" });
  const text = await res.body.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

Block.prototype.run = async function () {
  const options = this.options;
  const port = Number(options.port || process.env.HTTP_PORT || 8080);

  try {
    if (options.get) {
      if (typeof options.index !== "number") {
        logger.error("Missing --index <number> for --get");
      }
      const url = `http://localhost:${port}/block/${options.index}`;
      logger.log(`[cli] GET ${url}`);
      const data = await httpJson(url);
      logger.log(JSON.stringify(data, null, 2));
      return;
    }

    if (options.all) {
      const url = `http://localhost:${port}/blocks`;
      logger.log(`[cli] GET ${url}`);
      const data = await httpJson(url);
      logger.log(JSON.stringify(data, null, 2));
      return;
    }

    // default help if no option picked
    logger.log(
      "usage: cli block --get --index <n> [--port 8080] | --all [--port 8080]"
    );
  } catch (err) {
    logger.error(err.message || String(err));
  }
};

exports.Impl = Block;
