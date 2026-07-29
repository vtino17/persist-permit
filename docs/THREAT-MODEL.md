# Threat model

PersistPermit protects the boundary between short-lived agent context and
persistent memory.

| Threat | Control |
| --- | --- |
| Tool output stores a delayed instruction | Untrusted instruction-residue detector |
| Credential becomes long-term memory | Secret-pattern and sensitivity blocks |
| PII is labeled public | Sensitivity under-declaration detection |
| Personal data lacks consent | Subject, purpose, and consent validation |
| Memory lives indefinitely | Purpose-bound TTL assignment and deletion schedule |
| Stale fact conflicts with current state | Structured contradiction and supersession |
| Repeated content inflates retrieval | Normalized content deduplication |
| Receipt reused for another batch | Content-addressed compilation hashes |

## Trust assumptions

- The batch includes every proposed persistent write.
- Purpose, source provenance, subjects, and structured facts are accurate.
- Existing store inventory is complete.
- Policy and consent grants are controlled by a trusted process.

## Limitations

Detectors use deterministic patterns and can miss obfuscated or unfamiliar
content. They may also flag legitimate examples. PersistPermit does not
semantically judge whether a memory is useful or true.

Content hashes are integrity identifiers, not encryption. Store content using
appropriate encryption and access control. Receipts do not authenticate the
reviewer.

Use additional retrieval-time screening because a safe memory can become risky
when combined with a later toolset or query.
