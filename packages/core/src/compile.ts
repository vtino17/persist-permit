import { hashValue, sha256 } from "./canonical.js";
import { scanContent } from "./detectors.js";
import type {
  DeletionItem,
  MemoryDecision,
  MemoryFact,
  MemoryFinding,
  RetentionCompilation,
  Sensitivity,
  StoredMemory,
} from "./types.js";
import { assertBatch, assertPolicy, assertStore } from "./validation.js";

const day = 86_400_000;
const finding = (code: string, severity: MemoryFinding["severity"], message: string, detector?: string): MemoryFinding => ({
  code,
  severity,
  message,
  ...(detector ? { detector } : {}),
});
const validDate = (value: string, field: string): Date => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid ${field}: ${value}`);
  return date;
};
const factKey = (scope: string, fact: MemoryFact): string => `${scope}:${fact.key.trim().toLowerCase()}`;
const sensitivityRank: Record<Sensitivity, number> = {
  public: 0,
  internal: 1,
  personal: 2,
  health: 3,
  financial: 3,
  secret: 4,
  credential: 5,
};

export async function compileRetention(input: {
  batch: unknown;
  store: unknown;
  policy: unknown;
  compiledAt?: Date;
}): Promise<RetentionCompilation> {
  assertBatch(input.batch);
  assertStore(input.store);
  assertPolicy(input.policy);
  const batch = input.batch;
  const store = input.store;
  const policy = input.policy;
  if (batch.collectionId !== store.collectionId || batch.collectionId !== policy.collectionId) {
    throw new Error("Batch, store, and policy target different collections.");
  }
  const now = input.compiledAt ?? new Date();
  const purposes = new Map(policy.purposes.map((purpose) => [purpose.id, purpose]));
  const consents = new Map(policy.consents.map((consent) => [consent.id, consent]));
  const storedById = new Map(store.entries.map((entry) => [entry.id, entry]));
  const knownHashes = new Set(store.entries.map((entry) => entry.contentHash));
  const facts = new Map<string, Array<{ id: string; value: string }>>();
  for (const entry of store.entries) {
    for (const fact of entry.facts) {
      const key = factKey(entry.scope, fact);
      facts.set(key, [...(facts.get(key) ?? []), { id: entry.id, value: fact.value }]);
    }
  }
  const decisions: MemoryDecision[] = [];
  const records: StoredMemory[] = [];
  const deletions: DeletionItem[] = store.entries.map((entry) => ({
    memoryId: entry.id,
    deleteAt: entry.expiresAt,
    reason: "retention-expiry",
  }));

  for (const proposal of batch.proposals) {
    const contentHash = await sha256(proposal.content.trim().replace(/\s+/g, " ").toLowerCase());
    const findings: MemoryFinding[] = [];
    const deletionIds: string[] = [];
    const purpose = purposes.get(proposal.purposeId);
    const created = validDate(proposal.createdAt, "createdAt");
    let assignedExpiresAt: string | undefined;
    if (!purpose) {
      findings.push(finding("unknown-purpose", "blocked", `Purpose "${proposal.purposeId}" is not approved.`));
    } else {
      if (!purpose.allowedScopes.includes(proposal.scope)) findings.push(finding("scope-not-approved", "blocked", `Scope "${proposal.scope}" is not allowed for this purpose.`));
      if (!purpose.allowedSensitivities.includes(proposal.sensitivity)) findings.push(finding("sensitivity-not-approved", "blocked", `${proposal.sensitivity} data is not allowed for this purpose.`));
      if (!purpose.allowedSourceKinds.includes(proposal.source.kind) || !purpose.allowedSourceTrust.includes(proposal.source.trust)) {
        findings.push(finding("source-not-approved", "blocked", "The source kind or trust level is not approved for this purpose."));
      }
      const maximum = new Date(created.getTime() + purpose.maxTtlDays * day);
      if (proposal.expiresAt) {
        const requested = validDate(proposal.expiresAt, "expiresAt");
        if (requested.getTime() > maximum.getTime()) {
          assignedExpiresAt = maximum.toISOString();
          findings.push(finding("ttl-clamped", "warning", `Requested expiry exceeded ${purpose.maxTtlDays} days and was clamped.`));
        } else {
          assignedExpiresAt = requested.toISOString();
        }
      } else {
        assignedExpiresAt = maximum.toISOString();
        findings.push(finding("ttl-assigned", "info", `Assigned the purpose maximum of ${purpose.maxTtlDays} days.`));
      }
      if (assignedExpiresAt && new Date(assignedExpiresAt).getTime() <= now.getTime()) findings.push(finding("already-expired", "blocked", "The compiled retention deadline has already passed."));
      const personalClass = ["personal", "health", "financial"].includes(proposal.sensitivity);
      if (purpose.requiresConsent || personalClass) {
        const consent = proposal.consentId ? consents.get(proposal.consentId) : undefined;
        if (!consent) {
          findings.push(finding("consent-missing", "blocked", "This purpose requires a valid consent grant."));
        } else {
          if (!consent.purposeIds.includes(proposal.purposeId) || !proposal.subjectIds.every((id) => consent.subjectIds.includes(id))) {
            findings.push(finding("consent-scope-mismatch", "blocked", "Consent does not cover the purpose or every subject."));
          }
          if (validDate(consent.expiresAt, "consent expiresAt").getTime() <= now.getTime()) findings.push(finding("consent-expired", "blocked", "The consent grant has expired."));
        }
      }
    }
    if (proposal.content.length > policy.maxContentChars) findings.push(finding("content-budget-exceeded", "blocked", `Content exceeds ${policy.maxContentChars} characters.`));
    if (policy.blockedSensitivities.includes(proposal.sensitivity)) findings.push(finding("blocked-sensitivity", "blocked", `${proposal.sensitivity} data cannot be persisted.`));
    const hits = scanContent(proposal.content);
    for (const hit of hits) {
      if (hit.kind === "credential") findings.push(finding("credential-material-detected", "blocked", "Credential-like material cannot enter persistent memory.", hit.detector));
      if (hit.kind === "instruction" && proposal.source.trust === "untrusted" && policy.rejectInstructionFromUntrusted) {
        findings.push(finding("untrusted-instruction-residue", "blocked", "Untrusted content contains a durable instruction pattern.", hit.detector));
      }
      if (hit.kind === "personal" && sensitivityRank[proposal.sensitivity] < sensitivityRank.personal) {
        findings.push(finding("sensitivity-underdeclared", "blocked", "Personal data was detected but the proposal declares a lower sensitivity.", hit.detector));
      }
    }
    if (knownHashes.has(contentHash)) findings.push(finding("duplicate-memory", "warning", "Equivalent normalized content already exists."));
    for (const id of proposal.supersedesIds) {
      if (!storedById.has(id)) {
        findings.push(finding("unknown-superseded-memory", "blocked", `Superseded memory "${id}" does not exist.`));
      } else {
        deletionIds.push(id);
      }
    }
    for (const fact of proposal.facts) {
      const previous = facts.get(factKey(proposal.scope, fact)) ?? [];
      const conflicts = previous.filter((item) => item.value !== fact.value && !proposal.supersedesIds.includes(item.id));
      if (conflicts.length > 0) findings.push(finding("fact-contradiction", "blocked", `Fact "${fact.key}" conflicts with ${conflicts.map((item) => item.id).join(", ")}.`));
    }
    const rejected = findings.some((item) => item.severity === "blocked");
    const duplicate = findings.some((item) => item.code === "duplicate-memory");
    const action = rejected ? "reject" as const : duplicate ? "skip" as const : "persist" as const;
    decisions.push({
      proposalId: proposal.id,
      action,
      contentHash,
      ...(assignedExpiresAt ? { assignedExpiresAt } : {}),
      deletionIds,
      findings,
    });
    if (action === "persist" && assignedExpiresAt) {
      const record: StoredMemory = { ...proposal, expiresAt: assignedExpiresAt, contentHash };
      records.push(record);
      knownHashes.add(contentHash);
      storedById.set(record.id, record);
      deletions.push({ memoryId: record.id, deleteAt: assignedExpiresAt, reason: "retention-expiry" });
      for (const id of deletionIds) deletions.push({ memoryId: id, deleteAt: now.toISOString(), reason: "superseded", replacementId: record.id });
      for (const fact of proposal.facts) {
        const key = factKey(proposal.scope, fact);
        facts.set(key, [...(facts.get(key) ?? []), { id: proposal.id, value: fact.value }]);
      }
    }
  }
  const rejected = decisions.filter((item) => item.action === "reject").length;
  const skipped = decisions.filter((item) => item.action === "skip").length;
  const warnings = decisions.flatMap((item) => item.findings).filter((item) => item.severity === "warning").length;
  const base = {
    collectionId: batch.collectionId,
    status: rejected > 0 ? "blocked" as const : skipped > 0 || warnings > 0 ? "review" as const : "clean" as const,
    score: Math.max(0, 100 - rejected * 25 - skipped * 8 - warnings * 3),
    compiledAt: now.toISOString(),
    summary: {
      proposed: batch.proposals.length,
      persisted: records.length,
      skipped,
      rejected,
    },
    decisions,
    records,
    deletionSchedule: deletions.sort((left, right) => left.deleteAt.localeCompare(right.deleteAt) || left.memoryId.localeCompare(right.memoryId)),
  };
  return { ...base, compilationHash: await hashValue(base) };
}
