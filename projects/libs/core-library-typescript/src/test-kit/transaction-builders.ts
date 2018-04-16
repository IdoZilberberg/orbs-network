import { types } from "../common-library/types";
import  { Address, createContractAddress } from "../common-library/address";
import { createHash } from "crypto";
import { TransactionUtils } from "..";

export function aDummyTransaction(overrides: {timestamp?: number, senderPublicKey?: Buffer} = {}): types.Transaction {
  const senderPublicKey: Buffer = overrides.senderPublicKey == undefined ?
    createHash("sha256").update("dummyAccount").digest() : overrides.senderPublicKey;

    return {
    header: {
      version: 0,
      sender: new Address(senderPublicKey).toBuffer(),
      timestamp: (overrides.timestamp == undefined ? Date.now() : overrides.timestamp).toString(),
      contractAddress: createContractAddress("dummyContract").toBuffer()
    },
    payload: "{}"
  };
}

export function aDummyTransactionSet(numberOfTransactions = 3): types.Transaction[] {
  const transactions: types.Transaction[] = [];
  for (let i = 0; i < numberOfTransactions; i++) {
    const transaction = aDummyTransaction({senderPublicKey: createHash("sha256").update(`address${i}`).digest()});
    const txHash = TransactionUtils.calculateTransactionHash(transaction);
    transactions.push(transaction);
  }

  return transactions;
}