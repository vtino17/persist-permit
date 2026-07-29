import type { RetentionCompilation } from "@persistpermit/core";

const icon = (action: string): string => ({ persist: "✓", skip: "○", reject: "×" })[action] ?? "·";

export const formatCompilation = (compilation: RetentionCompilation): string => {
  const lines = [
    `PersistPermit · ${compilation.collectionId}`,
    `Status: ${compilation.status.toUpperCase()} · score ${compilation.score}/100`,
    `${compilation.summary.persisted} persist · ${compilation.summary.skipped} skip · ${compilation.summary.rejected} reject`,
    "",
  ];
  for (const decision of compilation.decisions) {
    lines.push(`${icon(decision.action)} ${decision.proposalId} · ${decision.action.toUpperCase()}`);
    for (const item of decision.findings) lines.push(`  ${item.severity.toUpperCase()} ${item.code}: ${item.message}`);
    if (decision.assignedExpiresAt) lines.push(`  expires ${decision.assignedExpiresAt}`);
  }
  return lines.join("\n");
};

export const formatSchedule = (compilation: RetentionCompilation): string => [
  `Deletion schedule · ${compilation.collectionId}`,
  ...compilation.deletionSchedule.map((item) =>
    `${item.deleteAt} · ${item.memoryId} · ${item.reason}${item.replacementId ? ` → ${item.replacementId}` : ""}`),
].join("\n");
