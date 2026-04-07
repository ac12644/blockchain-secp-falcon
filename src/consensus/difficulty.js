// Difficulty adjustment: retarget every ADJUSTMENT_INTERVAL blocks
// based on actual vs target block time (Bitcoin-style).

const { targetFromNBits } = require("./pow");

const ADJUSTMENT_INTERVAL = 10; // retarget every 10 blocks (short for educational demo)
const TARGET_BLOCK_TIME = 10; // 10 seconds target per block
const TARGET_TIMESPAN = ADJUSTMENT_INTERVAL * TARGET_BLOCK_TIME; // 100 seconds
const MAX_ADJUST = 4; // max 4x adjustment per retarget

/**
 * Compute nBits from a BigInt target value.
 * Inverse of targetFromNBits.
 */
function nBitsFromTarget(target) {
  if (target <= 0n) return 0;

  let hex = target.toString(16);
  if (hex.length % 2 !== 0) hex = "0" + hex;

  const bytes = Buffer.from(hex, "hex");
  const exp = bytes.length;

  // mantissa is top 3 bytes
  let mant;
  if (bytes.length >= 3) {
    mant = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  } else if (bytes.length === 2) {
    mant = (bytes[0] << 16) | (bytes[1] << 8);
  } else {
    mant = bytes[0] << 16;
  }

  // if high bit of mantissa is set, shift right and increase exponent
  if (mant & 0x800000) {
    mant >>= 8;
    return ((exp + 1) << 24) | mant;
  }
  return (exp << 24) | mant;
}

/**
 * Calculate the next difficulty (nBits) based on the chain.
 * @param {Array} chain - the current blockchain
 * @param {number} genesisNBits - genesis/initial nBits
 * @returns {number} the nBits to use for the next block
 */
function getNextNBits(chain, genesisNBits, upToLength) {
  const height = upToLength !== undefined ? upToLength : chain.length;

  // not at retarget boundary — use same nBits as last block
  if (height < ADJUSTMENT_INTERVAL || height % ADJUSTMENT_INTERVAL !== 0) {
    if (height <= 1) return genesisNBits;
    return chain[height - 1].blockHeader.nBits;
  }

  // retarget: compare actual timespan of last ADJUSTMENT_INTERVAL blocks
  const lastBlock = chain[height - 1];
  const firstBlock = chain[height - ADJUSTMENT_INTERVAL];
  let actualTimespan = lastBlock.blockHeader.time - firstBlock.blockHeader.time;

  // clamp to prevent extreme adjustments
  if (actualTimespan < TARGET_TIMESPAN / MAX_ADJUST)
    actualTimespan = Math.floor(TARGET_TIMESPAN / MAX_ADJUST);
  if (actualTimespan > TARGET_TIMESPAN * MAX_ADJUST)
    actualTimespan = TARGET_TIMESPAN * MAX_ADJUST;

  // new target = old target * actualTimespan / TARGET_TIMESPAN
  const oldTarget = targetFromNBits(lastBlock.blockHeader.nBits);
  let newTarget =
    (oldTarget * BigInt(actualTimespan)) / BigInt(TARGET_TIMESPAN);

  // don't exceed max target (easiest difficulty)
  const maxTarget = targetFromNBits(genesisNBits);
  if (newTarget > maxTarget) newTarget = maxTarget;

  return nBitsFromTarget(newTarget);
}

module.exports = {
  getNextNBits,
  nBitsFromTarget,
  ADJUSTMENT_INTERVAL,
  TARGET_BLOCK_TIME,
  TARGET_TIMESPAN,
};
