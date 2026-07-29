# Memory batch reference

A batch contains proposed persistent writes. It does not mutate storage.

Each proposal requires:

- `id`: unique write identifier.
- `content`: exact memory text.
- `purposeId`: approved retention purpose.
- `scope`: retrieval boundary such as `profile` or `ticket`.
- `subjectIds`: people or entities described.
- `sensitivity`: declared data class.
- `source`: kind, origin, and trust.
- `facts`: structured keys used for deterministic contradiction checks.
- `createdAt`: source event time.
- `expiresAt`: optional requested deletion time.
- `consentId`: optional consent grant.
- `supersedesIds`: existing memories intentionally replaced.

Sensitivity classes are `public`, `internal`, `personal`, `health`,
`financial`, `secret`, and `credential`.

Source kinds are `user`, `tool`, `model`, `system`, and `import`. Trust is
`trusted` or `untrusted`.

Avoid storing entire conversations. Proposals should contain the minimum stable
fact needed for the declared purpose.
