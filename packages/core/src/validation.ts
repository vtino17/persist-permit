import type {
  MemoryBatch,
  MemoryStore,
  RetentionPolicy,
} from "./types.js";

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");
const values = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === "string" && allowed.includes(value as T);
const valueArray = <T extends string>(value: unknown, allowed: readonly T[]): value is T[] =>
  Array.isArray(value) && value.every((entry) => values(entry, allowed));
const validDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const sensitivities = [
  "public", "internal", "personal", "health", "financial", "secret", "credential",
] as const;
const sourceKinds = ["user", "tool", "model", "system", "import"] as const;
const sourceTrust = ["trusted", "untrusted"] as const;

const assertProposal = (value: unknown): void => {
  if (!object(value)) throw new Error("Memory proposal must be an object.");
  for (const field of ["id", "content", "purposeId", "scope", "sensitivity", "createdAt"]) {
    if (typeof value[field] !== "string") throw new Error(`Proposal field "${field}" must be a string.`);
  }
  if (!strings(value.subjectIds) || !strings(value.supersedesIds)) throw new Error("Proposal subjects and supersedes must be arrays.");
  if (!values(value.sensitivity, sensitivities)) throw new Error("Proposal sensitivity is invalid.");
  if (
    !object(value.source)
    || !values(value.source.kind, sourceKinds)
    || typeof value.source.origin !== "string"
    || !values(value.source.trust, sourceTrust)
  ) {
    throw new Error("Proposal source is invalid.");
  }
  if (!Array.isArray(value.facts) || !value.facts.every((fact) => object(fact) && typeof fact.key === "string" && typeof fact.value === "string")) {
    throw new Error("Proposal facts are invalid.");
  }
  if (!validDate(value.createdAt)) throw new Error("Proposal createdAt must be a valid date.");
  if (value.expiresAt !== undefined && !validDate(value.expiresAt)) {
    throw new Error("Proposal expiresAt must be a valid date.");
  }
  if (value.consentId !== undefined && typeof value.consentId !== "string") {
    throw new Error("Proposal consentId must be a string.");
  }
};

export function assertBatch(value: unknown): asserts value is MemoryBatch {
  if (!object(value) || value.schemaVersion !== "1.0" || typeof value.collectionId !== "string" || !Array.isArray(value.proposals)) {
    throw new Error("Invalid memory batch.");
  }
  const ids = new Set<string>();
  for (const proposal of value.proposals) {
    assertProposal(proposal);
    const id = (proposal as { id: string }).id;
    if (ids.has(id)) throw new Error(`Duplicate proposal id: ${id}`);
    ids.add(id);
  }
}

export function assertStore(value: unknown): asserts value is MemoryStore {
  if (!object(value) || value.storeVersion !== "1.0" || typeof value.collectionId !== "string" || !Array.isArray(value.entries)) {
    throw new Error("Invalid memory store.");
  }
  for (const entry of value.entries) {
    assertProposal(entry);
    if (!object(entry) || typeof entry.contentHash !== "string" || typeof entry.expiresAt !== "string") throw new Error("Stored memory is invalid.");
  }
}

export function assertPolicy(value: unknown): asserts value is RetentionPolicy {
  if (!object(value) || value.policyVersion !== "1.0" || typeof value.collectionId !== "string") throw new Error("Invalid retention policy.");
  if (!Number.isSafeInteger(value.maxContentChars) || Number(value.maxContentChars) < 1) throw new Error("maxContentChars must be positive.");
  if (!valueArray(value.blockedSensitivities, sensitivities) || typeof value.rejectInstructionFromUntrusted !== "boolean") throw new Error("Policy controls are invalid.");
  if (!Array.isArray(value.purposes) || !Array.isArray(value.consents)) throw new Error("Policy purposes and consents must be arrays.");
  const purposeIds = new Set<string>();
  for (const purpose of value.purposes) {
    if (
      !object(purpose)
      || typeof purpose.id !== "string"
      || purpose.id === ""
      || !Number.isSafeInteger(purpose.maxTtlDays)
      || Number(purpose.maxTtlDays) < 1
      || !strings(purpose.allowedScopes)
      || !valueArray(purpose.allowedSensitivities, sensitivities)
      || !valueArray(purpose.allowedSourceKinds, sourceKinds)
      || !valueArray(purpose.allowedSourceTrust, sourceTrust)
      || typeof purpose.requiresConsent !== "boolean"
    ) throw new Error("Invalid purpose rule.");
    if (purposeIds.has(purpose.id)) throw new Error(`Duplicate purpose id: ${purpose.id}`);
    purposeIds.add(purpose.id);
  }
  const consentIds = new Set<string>();
  for (const consent of value.consents) {
    if (
      !object(consent)
      || typeof consent.id !== "string"
      || consent.id === ""
      || !strings(consent.subjectIds)
      || !strings(consent.purposeIds)
      || !validDate(consent.expiresAt)
    ) throw new Error("Invalid consent grant.");
    const unknownPurposes = consent.purposeIds.filter((id) => !purposeIds.has(id));
    if (unknownPurposes.length > 0) {
      throw new Error(`Consent references unknown purposes: ${unknownPurposes.join(", ")}`);
    }
    if (consentIds.has(consent.id)) throw new Error(`Duplicate consent id: ${consent.id}`);
    consentIds.add(consent.id);
  }
}
