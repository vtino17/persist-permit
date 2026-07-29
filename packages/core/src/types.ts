export type Sensitivity = "public" | "internal" | "personal" | "health" | "financial" | "secret" | "credential";
export type SourceKind = "user" | "tool" | "model" | "system" | "import";
export type SourceTrust = "trusted" | "untrusted";
export type Severity = "info" | "warning" | "blocked";

export interface MemorySource {
  kind: SourceKind;
  origin: string;
  trust: SourceTrust;
}

export interface MemoryFact {
  key: string;
  value: string;
}

export interface MemoryProposal {
  id: string;
  content: string;
  purposeId: string;
  scope: string;
  subjectIds: string[];
  sensitivity: Sensitivity;
  source: MemorySource;
  facts: MemoryFact[];
  createdAt: string;
  expiresAt?: string;
  consentId?: string;
  supersedesIds: string[];
}

export interface MemoryBatch {
  schemaVersion: "1.0";
  collectionId: string;
  proposals: MemoryProposal[];
}

export interface StoredMemory extends MemoryProposal {
  contentHash: string;
  expiresAt: string;
}

export interface MemoryStore {
  storeVersion: "1.0";
  collectionId: string;
  entries: StoredMemory[];
}

export interface PurposeRule {
  id: string;
  maxTtlDays: number;
  allowedScopes: string[];
  allowedSensitivities: Sensitivity[];
  allowedSourceKinds: SourceKind[];
  allowedSourceTrust: SourceTrust[];
  requiresConsent: boolean;
}

export interface ConsentGrant {
  id: string;
  subjectIds: string[];
  purposeIds: string[];
  expiresAt: string;
}

export interface RetentionPolicy {
  policyVersion: "1.0";
  collectionId: string;
  maxContentChars: number;
  blockedSensitivities: Sensitivity[];
  rejectInstructionFromUntrusted: boolean;
  purposes: PurposeRule[];
  consents: ConsentGrant[];
}

export interface MemoryFinding {
  code: string;
  severity: Severity;
  message: string;
  detector?: string;
}

export interface MemoryDecision {
  proposalId: string;
  action: "persist" | "skip" | "reject";
  contentHash: string;
  assignedExpiresAt?: string;
  deletionIds: string[];
  findings: MemoryFinding[];
}

export interface DeletionItem {
  memoryId: string;
  deleteAt: string;
  reason: "retention-expiry" | "superseded";
  replacementId?: string;
}

export interface RetentionCompilation {
  collectionId: string;
  status: "clean" | "review" | "blocked";
  score: number;
  compiledAt: string;
  summary: {
    proposed: number;
    persisted: number;
    skipped: number;
    rejected: number;
  };
  decisions: MemoryDecision[];
  records: StoredMemory[];
  deletionSchedule: DeletionItem[];
  compilationHash: string;
}

export interface RetentionReceipt {
  receiptVersion: "1.0";
  collectionId: string;
  batchHash: string;
  storeHash: string;
  policyHash: string;
  compilationHash: string;
  compiledAt: string;
  issuedAt: string;
  persistedIds: string[];
  receiptHash: string;
}

export interface ReceiptVerification {
  valid: boolean;
  checks: Record<"receiptHash" | "batchHash" | "storeHash" | "policyHash" | "compilationHash", boolean>;
  errors: string[];
}
