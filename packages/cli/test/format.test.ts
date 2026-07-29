import { describe, expect, it } from "vitest";
import {
  adversarialBatch,
  compileRetention,
  safeBatch,
  samplePolicy,
  sampleStore,
} from "@persistpermit/core";
import { formatCompilation, formatSchedule } from "../src/format.js";

describe("CLI formatting", () => {
  it("renders clean decisions", async () => {
    const result = await compileRetention({ batch: safeBatch, store: sampleStore, policy: samplePolicy });
    expect(formatCompilation(result)).toContain("PERSIST");
  });

  it("renders blocked finding codes", async () => {
    const result = await compileRetention({ batch: adversarialBatch, store: sampleStore, policy: samplePolicy });
    expect(formatCompilation(result)).toContain("untrusted-instruction-residue");
  });

  it("renders deletion deadlines", async () => {
    const result = await compileRetention({ batch: safeBatch, store: sampleStore, policy: samplePolicy });
    expect(formatSchedule(result)).toContain("retention-expiry");
  });
});
