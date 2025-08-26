const CryptoAdapter = require("../src/crypto/cryptoAdapter");
const { verifyTransaction, signTransferTx } = require("../src/tx/transaction");
const { getAccountState } = require("../src/core/state");

describe("Transactions", () => {
  test("sign & verify with nonce/balance rules", async () => {
    const { privateKey, publicKey } = await CryptoAdapter.generateKeyPair();
    const fromAddress = CryptoAdapter.getAddress(publicKey);
    const toAddress = "b".repeat(40);

    // create tx (nonce 1)
    const tx = await signTransferTx({
      fromAddress,
      toAddress,
      amount: 10,
      fee: 1,
      nonce: 1,
      privateKey,
      publicKey,
    });

    // chain state: give the sender enough balance and nonce 0
    const state = new Map();
    state.set(fromAddress, { balance: 100, nonce: 0 });
    state.set(toAddress, { balance: 0, nonce: 0 });

    expect(await verifyTransaction(tx, state)).toBe(true);

    // wrong nonce should fail (expecting 1)
    const badNonceTx = { ...tx, nonce: 3 };
    expect(await verifyTransaction(badNonceTx, state)).toBe(false);

    // insufficient balance should fail
    const poorState = new Map([[fromAddress, { balance: 5, nonce: 0 }]]);
    expect(await verifyTransaction(tx, poorState)).toBe(false);
  });

  test("address must match public key", async () => {
    const { privateKey, publicKey } = await CryptoAdapter.generateKeyPair();
    const fromAddress = "0".repeat(40); // wrong
    const toAddress = "1".repeat(40);

    const tx = await signTransferTx({
      fromAddress,
      toAddress,
      amount: 1,
      fee: 0,
      nonce: 1,
      privateKey,
      publicKey,
    });

    const state = new Map([[fromAddress, { balance: 10, nonce: 0 }]]);
    expect(await verifyTransaction(tx, state)).toBe(false);
  });
});
