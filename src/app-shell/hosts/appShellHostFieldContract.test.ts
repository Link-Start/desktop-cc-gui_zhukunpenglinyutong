import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

function read(rel: string): string {
  return readFileSync(join(currentDir, rel), "utf8");
}

function extractConstArray(source: string, name: string): string[] {
  const match = source.match(
    new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const`),
  );
  if (!match) {
    return [];
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function extractUsedAssemblyFields(source: string): string[] {
  const used = new Set<string>();
  for (const match of source.matchAll(
    /\b(?:merged|session|catalog|git|runtime|composer|flows)\.([A-Za-z0-9_]+)/g,
  )) {
    used.add(match[1]);
  }
  return [...used].sort();
}

function extractPublishedKeys(source: string): string[] {
  const start = source.search(
    /const (session|catalog|git|runtime|composer|flows) = \{/,
  );
  if (start < 0) {
    return [];
  }
  const after = source.slice(start);
  const brace = after.indexOf("{");
  let depth = 0;
  let end = -1;
  for (let index = brace; index < after.length; index += 1) {
    if (after[index] === "{") {
      depth += 1;
    } else if (after[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  const body = after.slice(brace + 1, end);
  const keys: string[] = [];
  for (const line of body.split("\n")) {
    const match =
      line.match(/^\s*([A-Za-z0-9_]+),?\s*$/) ||
      line.match(/^\s*([A-Za-z0-9_]+):/);
    if (match) {
      keys.push(match[1]);
    }
  }
  return keys;
}

const HOSTS = [
  ["session", "useAppShellSessionHost.ts", []],
  ["catalog", "useAppShellCatalogHost.ts", ["SESSION_FIELDS", "GIT_FIELDS"]],
  ["git", "useAppShellGitSurfaceHost.ts", ["SESSION_FIELDS", "RUNTIME_FIELDS"]],
  ["runtime", "useAppShellRuntimeThreadHost.ts", ["SESSION_FIELDS", "CATALOG_FIELDS", "GIT_FIELDS"]],
  ["composer", "useAppShellComposerHost.ts", ["SESSION_FIELDS", "CATALOG_FIELDS", "GIT_FIELDS", "RUNTIME_FIELDS"]],
  ["flows", "useAppShellWorkspaceFlowsHost.ts", ["SESSION_FIELDS", "CATALOG_FIELDS", "GIT_FIELDS", "RUNTIME_FIELDS", "COMPOSER_FIELDS"]],
] as const;

const ASSEMBLY_FIELD_FILE = "appShellAssemblyHostFields.ts";
const ASSEMBLY_FIELD_CONSTS = [
  "SESSION_FIELDS",
  "CATALOG_FIELDS",
  "GIT_FIELDS",
  "RUNTIME_FIELDS",
  "COMPOSER_FIELDS",
  "FLOWS_FIELDS",
] as const;

const FIELD_OWNER = {
  SESSION_FIELDS: "session",
  CATALOG_FIELDS: "catalog",
  GIT_FIELDS: "git",
  RUNTIME_FIELDS: "runtime",
  COMPOSER_FIELDS: "composer",
  FLOWS_FIELDS: "flows",
} as const;

describe("appShellHostFieldContract", () => {
  it("does not let a host subscribe to a field nobody publishes", () => {
    const published = new Map<string, Set<string>>();
    const missing: string[] = [];
    for (const [name, file] of HOSTS) {
      published.set(name, new Set(extractPublishedKeys(read(file))));
    }
    for (const [host, file, fieldConsts] of HOSTS) {
      const source = read(file);
      for (const fieldConst of fieldConsts) {
        const owner = FIELD_OWNER[fieldConst];
        const ownerKeys = published.get(owner) ?? new Set<string>();
        for (const field of extractConstArray(source, fieldConst)) {
          if (!ownerKeys.has(field)) {
            missing.push(`${host} reads ${owner}.${field}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("does not let assembly subscribe to a field nobody publishes", () => {
    const published = new Map<string, Set<string>>();
    for (const [name, file] of HOSTS) {
      published.set(name, new Set(extractPublishedKeys(read(file))));
    }
    const source = read(ASSEMBLY_FIELD_FILE);
    const missing: string[] = [];
    for (const fieldConst of ASSEMBLY_FIELD_CONSTS) {
      const owner = FIELD_OWNER[fieldConst];
      const ownerKeys = published.get(owner) ?? new Set<string>();
      for (const field of extractConstArray(source, fieldConst)) {
        if (!ownerKeys.has(field)) {
          missing.push(`assembly reads ${owner}.${field}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps streaming-hot unused runtime fields off the assembly subscription", () => {
    const runtimeFields = extractConstArray(
      read(ASSEMBLY_FIELD_FILE),
      "RUNTIME_FIELDS",
    );
    expect(runtimeFields).not.toContain("lastAgentMessageByThread");
    expect(runtimeFields).not.toContain("threadsController");
    expect(runtimeFields).toContain("activeItems");
    expect(runtimeFields).toContain("isProcessing");
  });

  it("subscribes to every field assembly actually reads", () => {
    const source = read(ASSEMBLY_FIELD_FILE);
    const subscribed = new Set<string>();
    for (const fieldConst of ASSEMBLY_FIELD_CONSTS) {
      for (const field of extractConstArray(source, fieldConst)) {
        subscribed.add(field);
      }
    }
    const used = extractUsedAssemblyFields(read("useAppShellAssemblyHost.ts"));
    expect(used.filter((field) => !subscribed.has(field))).toEqual([]);
  });
});
