---
type: evidence
status: historical
---

# Evidence policy

Raw app-server transcripts and rollout excerpts are intentionally not committed:
they can contain local paths, session identifiers, model reasoning, tool inventory,
and host configuration. Re-run `../harness.mjs` to produce local evidence under
`/tmp/mossx-s1-spike/evidence`.

Only the minimal schema subset required to reproduce the protocol conclusion is
retained in `schema-snapshot/`, with checksums in `SHA256SUMS.txt`.
