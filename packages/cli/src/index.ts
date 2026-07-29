#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  adversarialBatch,
  compileRetention,
  compileRetentionReceipt,
  safeBatch,
  samplePolicy,
  sampleStore,
  scanContent,
  verifyRetentionReceipt,
} from "@persistpermit/core";
import type { RetentionReceipt } from "@persistpermit/core";
import { formatCompilation, formatSchedule } from "./format.js";

const help = `PersistPermit — retention compiler for persistent AI memory

Usage:
  persist-permit scan <text-file> [--json]
  persist-permit compile <batch.json> --store <store.json> --policy <policy.json> [--at <ISO date>] [--json]
  persist-permit explain <batch.json> --store <store.json> --policy <policy.json> --proposal <id> [--at <ISO date>]
  persist-permit schedule <batch.json> --store <store.json> --policy <policy.json> [--at <ISO date>] [--json]
  persist-permit receipt <batch.json> --store <store.json> --policy <policy.json> --output <receipt.json> [--at <ISO date>]
  persist-permit verify <receipt.json> [--batch <json>] [--store <json>] [--policy <json>]
  persist-permit demo [safe|adversarial] [--json]
  persist-permit init [directory]

Exit codes: 0 clean/valid, 2 blocked, 3 review required, 5 invalid input.`;

const option = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const text = async (path: string): Promise<string> => readFile(resolve(path), "utf8");
const json = async (path: string): Promise<unknown> => JSON.parse(await text(path)) as unknown;
const outputJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};
const dateOption = (args: string[]): Date => {
  const raw = option(args, "--at");
  if (!raw) return new Date();
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid --at date: ${raw}`);
  return date;
};
const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(resolve(path), `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const compileInput = async (batchPath: string, args: string[]) => {
  const storePath = option(args, "--store");
  const policyPath = option(args, "--policy");
  if (!storePath || !policyPath) throw new Error("Command requires --store <json> and --policy <json>.");
  const batch = await json(batchPath);
  const store = await json(storePath);
  const policy = await json(policyPath);
  const compilation = await compileRetention({ batch, store, policy, compiledAt: dateOption(args) });
  return { batch, store, policy, compilation };
};
const statusCode = (status: "clean" | "review" | "blocked"): number =>
  status === "clean" ? 0 : status === "blocked" ? 2 : 3;

async function run(args: string[]): Promise<number> {
  const [command, first] = args;
  if (!command || ["help", "--help", "-h"].includes(command)) {
    console.log(help);
    return 0;
  }
  if (command === "scan") {
    if (!first || first.startsWith("--")) throw new Error("scan requires a text file.");
    const hits = scanContent(await text(first));
    if (args.includes("--json")) outputJson(hits);
    else console.log(hits.length > 0 ? hits.map((hit) => `${hit.kind.toUpperCase()} · ${hit.detector}`).join("\n") : "No deterministic signals detected.");
    return hits.length > 0 ? 3 : 0;
  }
  if (["compile", "explain", "schedule", "receipt"].includes(command)) {
    if (!first || first.startsWith("--")) throw new Error(`${command} requires a batch.`);
    const input = await compileInput(first, args);
    if (command === "compile") {
      if (args.includes("--json")) outputJson(input.compilation);
      else console.log(formatCompilation(input.compilation));
    }
    if (command === "explain") {
      const id = option(args, "--proposal");
      if (!id) throw new Error("explain requires --proposal <id>.");
      const found = input.compilation.decisions.find((item) => item.proposalId === id);
      if (!found) throw new Error(`Unknown proposal: ${id}`);
      outputJson(found);
    }
    if (command === "schedule") {
      if (args.includes("--json")) outputJson(input.compilation.deletionSchedule);
      else console.log(formatSchedule(input.compilation));
    }
    if (command === "receipt") {
      const target = option(args, "--output");
      if (!target) throw new Error("receipt requires --output <receipt.json>.");
      const receipt = await compileRetentionReceipt({ ...input, issuedAt: dateOption(args) });
      await writeJson(target, receipt);
      console.log(`Retention receipt: ${resolve(target)}`);
    }
    return statusCode(input.compilation.status);
  }
  if (command === "verify") {
    if (!first || first.startsWith("--")) throw new Error("verify requires a receipt.");
    const batchPath = option(args, "--batch");
    const storePath = option(args, "--store");
    const policyPath = option(args, "--policy");
    const result = await verifyRetentionReceipt({
      receipt: await json(first) as RetentionReceipt,
      ...(batchPath ? { batch: await json(batchPath) } : {}),
      ...(storePath ? { store: await json(storePath) } : {}),
      ...(policyPath ? { policy: await json(policyPath) } : {}),
    });
    outputJson(result);
    return result.valid ? 0 : 2;
  }
  if (command === "demo") {
    const safe = first === "safe";
    const compilation = await compileRetention({
      batch: safe ? safeBatch : adversarialBatch,
      store: sampleStore,
      policy: samplePolicy,
      compiledAt: dateOption(args),
    });
    if (args.includes("--json")) outputJson(compilation);
    else console.log(formatCompilation(compilation));
    return statusCode(compilation.status);
  }
  if (command === "init") {
    const directory = resolve(first ?? ".persist-permit");
    await mkdir(directory, { recursive: true });
    await writeJson(resolve(directory, "batch.json"), adversarialBatch);
    await writeJson(resolve(directory, "store.json"), sampleStore);
    await writeJson(resolve(directory, "policy.json"), samplePolicy);
    console.log(`Created starter files in ${directory}`);
    return 0;
  }
  throw new Error(`Unknown command: ${command}\n\n${help}`);
}

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(`PersistPermit error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 5;
  });
