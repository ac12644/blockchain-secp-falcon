"use strict";

const { request } = require("undici");

async function httpGet(url) {
  if (process.env.VERBOSE) console.log(`  GET ${url}`);
  const res = await request(url);
  const text = await res.body.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function httpPost(url, body = {}) {
  if (process.env.VERBOSE) console.log(`  POST ${url}`);
  const res = await request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.body.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

module.exports = { httpGet, httpPost };
