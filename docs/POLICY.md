# Retention policy reference

A purpose rule specifies maximum TTL, scopes, sensitivities, source kinds,
source trust, and whether consent is mandatory.

Personal, health, and financial proposals always require a consent grant,
regardless of the purpose setting. The grant must cover every subject and the
exact purpose and must remain valid at compilation time.

`blockedSensitivities` provides a global denylist. Credentials and secrets
should normally be blocked for every purpose.

`maxContentChars` enforces data minimization. `rejectInstructionFromUntrusted`
blocks known durable instruction patterns when the source is not trusted.

Retention is compiled from `createdAt`. Missing expiry receives the purpose
maximum. A later requested expiry is clamped and marked for review. An expiry
that has already passed blocks persistence.

Policies and consent grants should come from protected, independently reviewed
configuration.
