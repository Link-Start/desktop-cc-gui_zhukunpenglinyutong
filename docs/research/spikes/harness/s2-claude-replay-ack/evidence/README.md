# Evidence policy

Raw Claude NDJSON transcripts and metadata are intentionally not committed because
they can contain local paths, session identifiers, tool/MCP/skill inventories, and
authentication-source metadata. Re-run `../probe.mjs` to generate local evidence.

The repository retains only the reviewed conclusions and sanitized golden fixtures.
