#!/usr/bin/env node
/**
 * Split CHANGELOG.md into a light index + per-version JSON bodies so cold start
 * only loads the current release entry instead of the full 5k-line markdown.
 *
 * Output:
 *   src/features/update/generated/index.json
 *   src/features/update/generated/entries/<version>.json
 */
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseChangelogEntries,
  releaseNotesEntryFileStem,
} from "./lib/changelogParser.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const changelogPath = join(repoRoot, "CHANGELOG.md");
const outDir = join(repoRoot, "src/features/update/generated");
const entriesDir = join(outDir, "entries");

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function main() {
  const markdown = readFileSync(changelogPath, "utf8");
  const entries = parseChangelogEntries(markdown);
  if (entries.length === 0) {
    throw new Error(
      "[generate-release-notes] CHANGELOG.md has no parseable release entries.",
    );
  }

  mkdirSync(entriesDir, { recursive: true });

  const keepFiles = new Set();
  for (const entry of entries) {
    const stem = releaseNotesEntryFileStem(entry.version);
    const fileName = `${stem}.json`;
    keepFiles.add(fileName);
    writeFileSync(
      join(entriesDir, fileName),
      `${JSON.stringify(entry, null, 2)}\n`,
      "utf8",
    );
  }

  for (const fileName of readdirSync(entriesDir)) {
    if (!fileName.endsWith(".json") || keepFiles.has(fileName)) {
      continue;
    }
    rmSync(join(entriesDir, fileName), { force: true });
  }

  const index = {
    generatedAt: new Date().toISOString(),
    source: "CHANGELOG.md",
    sourceSha256: sha256(markdown),
    entryCount: entries.length,
    entries: entries.map((entry) => ({
      id: entry.id,
      tagName: entry.tagName,
      version: entry.version,
      title: entry.title,
      dateLabel: entry.dateLabel,
      file: `entries/${releaseNotesEntryFileStem(entry.version)}.json`,
    })),
  };

  writeFileSync(join(outDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");

  console.log(
    `[generate-release-notes] wrote ${entries.length} entries → src/features/update/generated/`,
  );
}

try {
  main();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
}
