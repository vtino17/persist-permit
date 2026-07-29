import { canonicalJson, hashValue, sha256 } from "./canonical.js";
import { compileRetention } from "./compile.js";
import type {
  ReceiptVerification,
  RetentionCompilation,
  RetentionReceipt,
} from "./types.js";
import { assertBatch, assertPolicy, assertStore } from "./validation.js";

export async function compileRetentionReceipt(input: {
  batch: unknown;
  store: unknown;
  policy: unknown;
  compilation: RetentionCompilation;
  issuedAt?: Date;
}): Promise<RetentionReceipt> {
  assertBatch(input.batch);
  assertStore(input.store);
  assertPolicy(input.policy);
  const expected = await compileRetention({
    batch: input.batch,
    store: input.store,
    policy: input.policy,
    compiledAt: new Date(input.compilation.compiledAt),
  });
  if (canonicalJson(expected) !== canonicalJson(input.compilation)) throw new Error("Compilation does not match a fresh evaluation.");
  if (input.compilation.status === "blocked") throw new Error("Cannot certify blocked memory writes.");
  const base = {
    receiptVersion: "1.0" as const,
    collectionId: input.compilation.collectionId,
    batchHash: await hashValue(input.batch),
    storeHash: await hashValue(input.store),
    policyHash: await hashValue(input.policy),
    compilationHash: input.compilation.compilationHash,
    compiledAt: input.compilation.compiledAt,
    issuedAt: (input.issuedAt ?? new Date()).toISOString(),
    persistedIds: input.compilation.records.map((record) => record.id),
  };
  return { ...base, receiptHash: await sha256(canonicalJson(base)) };
}

export async function verifyRetentionReceipt(input: {
  receipt: RetentionReceipt;
  batch?: unknown;
  store?: unknown;
  policy?: unknown;
}): Promise<ReceiptVerification> {
  const receipt = input.receipt;
  const base: Omit<RetentionReceipt, "receiptHash"> = {
    receiptVersion: receipt.receiptVersion,
    collectionId: receipt.collectionId,
    batchHash: receipt.batchHash,
    storeHash: receipt.storeHash,
    policyHash: receipt.policyHash,
    compilationHash: receipt.compilationHash,
    compiledAt: receipt.compiledAt,
    issuedAt: receipt.issuedAt,
    persistedIds: receipt.persistedIds,
  };
  const checks = {
    receiptHash: await sha256(canonicalJson(base)) === receipt.receiptHash,
    batchHash: true,
    storeHash: true,
    policyHash: true,
    compilationHash: true,
  };
  if (input.batch !== undefined) {
    assertBatch(input.batch);
    checks.batchHash = await hashValue(input.batch) === receipt.batchHash;
  }
  if (input.store !== undefined) {
    assertStore(input.store);
    checks.storeHash = await hashValue(input.store) === receipt.storeHash;
  }
  if (input.policy !== undefined) {
    assertPolicy(input.policy);
    checks.policyHash = await hashValue(input.policy) === receipt.policyHash;
  }
  if (input.batch !== undefined && input.store !== undefined && input.policy !== undefined) {
    const compilation = await compileRetention({
      batch: input.batch,
      store: input.store,
      policy: input.policy,
      compiledAt: new Date(receipt.compiledAt),
    });
    checks.compilationHash = compilation.compilationHash === receipt.compilationHash;
  }
  const errors = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => `${name} check failed`);
  return { valid: errors.length === 0, checks, errors };
}
