// Block persistence using RocksDB
// Keys: block:<index> -> JSON block, meta:height -> latest block index

const path = require("path");
const rocksdb = require("rocksdb");

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "blocks");

let db = null;

function open() {
  return new Promise((resolve, reject) => {
    const fs = require("fs");
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = rocksdb(DB_PATH);
    db.open({ createIfMissing: true }, (err) => {
      if (err) return reject(err);
      console.log(`[db] opened at ${DB_PATH}`);
      resolve();
    });
  });
}

function close() {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

function putBlock(block) {
  return new Promise((resolve, reject) => {
    const batch = db.batch();
    batch.put(`block:${block.index}`, JSON.stringify(block));
    batch.put("meta:height", String(block.index));
    batch.write((err) => (err ? reject(err) : resolve()));
  });
}

function getBlock(index) {
  return new Promise((resolve, reject) => {
    db.get(`block:${index}`, { asBuffer: false }, (err, val) => {
      if (err) {
        if (err.notFound || err.message?.includes("NotFound")) return resolve(null);
        return reject(err);
      }
      resolve(JSON.parse(val));
    });
  });
}

function getHeight() {
  return new Promise((resolve, reject) => {
    db.get("meta:height", { asBuffer: false }, (err, val) => {
      if (err) {
        if (err.notFound || err.message?.includes("NotFound")) return resolve(-1);
        return reject(err);
      }
      resolve(Number(val));
    });
  });
}

/**
 * Load all blocks from index 0..height.
 * @returns {Promise<Array>} array of blocks in order
 */
async function loadAllBlocks() {
  const height = await getHeight();
  if (height < 0) return [];

  // Load in parallel batches for faster startup
  const BATCH = 50;
  const blocks = new Array(height + 1);
  for (let start = 0; start <= height; start += BATCH) {
    const end = Math.min(start + BATCH - 1, height);
    const promises = [];
    for (let i = start; i <= end; i++) {
      promises.push(getBlock(i).then((b) => (blocks[i] = b)));
    }
    await Promise.all(promises);
  }
  return blocks.filter((b) => b !== null && b !== undefined);
}

function isOpen() {
  return db !== null;
}

module.exports = { open, close, putBlock, getBlock, getHeight, loadAllBlocks, isOpen };
