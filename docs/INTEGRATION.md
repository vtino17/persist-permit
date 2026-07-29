# Integration guide

Place PersistPermit immediately before the durable memory store:

```bash
persist-permit compile proposed.json \
  --store current-store.json \
  --policy retention-policy.json \
  --json > compilation.json
```

Only write `records` from a clean or reviewed compilation. Never write rejected
proposals. Schedule every `deletionSchedule` item with an idempotent deletion
worker.

Use the CLI exit code as a gate:

- `0`: clean;
- `2`: blocked;
- `3`: review required;
- `5`: malformed configuration.

After persistence, archive a receipt:

```bash
persist-permit receipt proposed.json \
  --store current-store.json \
  --policy retention-policy.json \
  --output retention-receipt.json
```

The receipt binds batch, pre-write store, policy, and compilation through
SHA-256. It is tamper-evident, not digitally signed.

Re-run policy checks during retrieval. A write-time permit does not guarantee
that the memory remains appropriate for every future query or context.
