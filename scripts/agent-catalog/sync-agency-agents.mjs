import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const expectedRevision = "459dce837db3bdfdc4763d3fefd1fd854e73c8f1";
const expectedDivisionCount = 17;
const expectedAgentCount = 248;
const providerId = "agency-agents";
const sourceUrl = "https://github.com/msitarzewski/agency-agents";
const defaultSourceRoot = path.resolve(repoRoot, "../agency-agents");
const defaultOutputRoot = path.resolve(
  repoRoot,
  "src-tauri/resources/agent-catalogs/agency-agents",
);
const overridesPath = path.join(
  scriptDir,
  "agency-agents-zh-CN.overrides.json",
);

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeScalarFields(frontmatter) {
  const lines = frontmatter.split(/\r?\n/);
  const scalarKeys = new Set(["name", "description", "color", "emoji", "vibe"]);
  const output = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match || !scalarKeys.has(match[1])) {
      output.push(line);
      continue;
    }

    const key = match[1];
    const values = [match[2].trim()];
    while (index + 1 < lines.length) {
      const next = lines[index + 1] ?? "";
      if (/^[A-Za-z][A-Za-z0-9_-]*:\s*/.test(next)) {
        break;
      }
      if (!/^\s+\S/.test(next)) {
        break;
      }
      values.push(next.trim());
      index += 1;
    }
    const combined = values.join(" ").trim().replace(/^(['"])(.*)\1$/, "$2");
    output.push(`${key}: ${JSON.stringify(combined)}`);
  }

  return output.join("\n");
}

function parseAgentFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error(`missing YAML frontmatter: ${filePath}`);
  }

  const normalizedFrontmatter = normalizeScalarFields(match[1]);
  const metadata = YAML.parse(normalizedFrontmatter);
  const body = raw.slice(match[0].length).trim();
  const name = String(metadata?.name ?? "").trim();
  const description = String(metadata?.description ?? "").replace(/\s+/g, " ").trim();

  if (!name || !description || !body) {
    throw new Error(`agent must have name, description and body: ${filePath}`);
  }

  return {
    name,
    description,
    color: String(metadata?.color ?? "").trim() || null,
    emoji: String(metadata?.emoji ?? "").trim() || null,
    vibe: String(metadata?.vibe ?? "").replace(/\s+/g, " ").trim() || null,
    body: `${body}\n`,
  };
}

function assertSafeRelativePath(relativePath, label) {
  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    relativePath.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`unsafe ${label}: ${relativePath}`);
  }
}

function resolveRevision(sourceRoot) {
  return execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

function buildCatalog(sourceRoot) {
  const revision = resolveRevision(sourceRoot);
  if (revision !== expectedRevision) {
    throw new Error(
      `agency-agents revision mismatch: expected ${expectedRevision}, got ${revision}`,
    );
  }

  const divisionsSource = readJson(path.join(sourceRoot, "divisions.json")).divisions;
  const upstreamZh = readJson(
    path.join(sourceRoot, "scripts/i18n/agent-names-zh.json"),
  );
  const overrides = readJson(overridesPath);
  const divisionIds = Object.keys(divisionsSource);

  if (divisionIds.length !== expectedDivisionCount) {
    throw new Error(
      `division count mismatch: expected ${expectedDivisionCount}, got ${divisionIds.length}`,
    );
  }

  const agents = [];
  const seenIds = new Set();
  const seenNames = new Set();
  const promptFiles = new Map();

  for (const divisionId of divisionIds) {
    const divisionDir = path.join(sourceRoot, divisionId);
    const files = fs
      .readdirSync(divisionDir)
      .filter((name) => name.endsWith(".md"))
      .sort((left, right) => left.localeCompare(right));

    for (const fileName of files) {
      const sourcePath = `${divisionId}/${fileName}`;
      assertSafeRelativePath(sourcePath, "sourcePath");
      const parsed = parseAgentFile(path.join(divisionDir, fileName));
      const sourceStem = fileName.slice(0, -3);
      const stableId = `${providerId}:${divisionId}/${sourceStem}`;
      const promptPath = `prompts/${divisionId}/${sourceStem}.md`;
      const localized = overrides.agents[parsed.name] ?? upstreamZh[parsed.name];

      if (!localized?.name?.trim() || !localized?.description?.trim()) {
        throw new Error(`missing zh-CN localization for ${parsed.name} (${sourcePath})`);
      }
      if (seenIds.has(stableId)) {
        throw new Error(`duplicate stable id: ${stableId}`);
      }
      if (seenNames.has(parsed.name)) {
        throw new Error(`duplicate English name: ${parsed.name}`);
      }
      seenIds.add(stableId);
      seenNames.add(parsed.name);
      assertSafeRelativePath(promptPath, "promptPath");

      promptFiles.set(promptPath, parsed.body);
      agents.push({
        id: stableId,
        providerId,
        divisionId,
        sourcePath,
        sourceRevision: revision,
        promptPath,
        promptHash: sha256(parsed.body),
        name: {
          en: parsed.name,
          "zh-CN": localized.name.trim(),
        },
        description: {
          en: parsed.description,
          "zh-CN": localized.description.trim(),
        },
        color: parsed.color,
        emoji: parsed.emoji,
        vibe: parsed.vibe,
      });
    }
  }

  agents.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  if (agents.length !== expectedAgentCount) {
    throw new Error(
      `agent count mismatch: expected ${expectedAgentCount}, got ${agents.length}`,
    );
  }

  const counts = new Map();
  for (const agent of agents) {
    counts.set(agent.divisionId, (counts.get(agent.divisionId) ?? 0) + 1);
  }

  const divisions = divisionIds.map((divisionId, order) => {
    const source = divisionsSource[divisionId];
    const zhLabel = String(overrides.divisions[divisionId] ?? "").trim();
    if (!zhLabel) {
      throw new Error(`missing zh-CN division label: ${divisionId}`);
    }
    return {
      id: divisionId,
      order,
      count: counts.get(divisionId) ?? 0,
      icon: String(source.icon ?? "").trim() || null,
      color: String(source.color ?? "").trim() || null,
      label: {
        en: String(source.label ?? divisionId).trim(),
        "zh-CN": zhLabel,
      },
    };
  });

  return {
    manifest: {
      schemaVersion: 1,
      providerId,
      displayName: "Agency Agents",
      sourceUrl,
      sourceRevision: revision,
      license: "MIT",
      divisionCount: divisions.length,
      agentCount: agents.length,
      divisions,
    },
    agents,
    promptFiles,
  };
}

function writeCatalog(outputRoot, catalog, sourceRoot) {
  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(
    path.join(outputRoot, "manifest.json"),
    `${JSON.stringify(catalog.manifest, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(outputRoot, "agents.json"),
    `${JSON.stringify({ schemaVersion: 1, agents: catalog.agents }, null, 2)}\n`,
  );
  for (const [relativePath, body] of catalog.promptFiles) {
    const destination = path.join(outputRoot, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, body);
  }
  fs.copyFileSync(path.join(sourceRoot, "LICENSE"), path.join(outputRoot, "LICENSE"));
}

function validatePackagedCatalog(outputRoot) {
  const manifest = readJson(path.join(outputRoot, "manifest.json"));
  const entries = readJson(path.join(outputRoot, "agents.json")).agents;
  const ids = new Set();
  const divisionIds = new Set(manifest.divisions.map((division) => division.id));

  if (
    manifest.providerId !== providerId ||
    manifest.sourceUrl !== sourceUrl ||
    manifest.sourceRevision !== expectedRevision ||
    manifest.divisionCount !== expectedDivisionCount ||
    manifest.agentCount !== expectedAgentCount ||
    entries.length !== expectedAgentCount
  ) {
    throw new Error("packaged catalog manifest counts or identity are invalid");
  }

  for (const entry of entries) {
    if (ids.has(entry.id)) {
      throw new Error(`duplicate packaged id: ${entry.id}`);
    }
    ids.add(entry.id);
    if (!divisionIds.has(entry.divisionId)) {
      throw new Error(`unknown packaged division: ${entry.divisionId}`);
    }
    if (
      !entry.name?.en?.trim() ||
      !entry.name?.["zh-CN"]?.trim() ||
      !entry.description?.en?.trim() ||
      !entry.description?.["zh-CN"]?.trim()
    ) {
      throw new Error(`incomplete packaged localization: ${entry.id}`);
    }
    assertSafeRelativePath(entry.promptPath, "packaged promptPath");
    const body = fs.readFileSync(path.join(outputRoot, entry.promptPath), "utf8");
    if (sha256(body) !== entry.promptHash) {
      throw new Error(`packaged prompt hash mismatch: ${entry.id}`);
    }
  }

  return {
    providerId,
    revision: manifest.sourceRevision,
    divisions: manifest.divisionCount,
    agents: entries.length,
    localizedZhCN: entries.filter(
      (entry) => entry.name?.["zh-CN"] && entry.description?.["zh-CN"],
    ).length,
  };
}

const args = process.argv.slice(2);
const validateOnly = args.includes("--validate");
const sourceArgIndex = args.indexOf("--source");
const outputArgIndex = args.indexOf("--output");
const sourceRoot =
  sourceArgIndex >= 0 ? path.resolve(args[sourceArgIndex + 1]) : defaultSourceRoot;
const outputRoot =
  outputArgIndex >= 0 ? path.resolve(args[outputArgIndex + 1]) : defaultOutputRoot;

if (!validateOnly) {
  const catalog = buildCatalog(sourceRoot);
  writeCatalog(outputRoot, catalog, sourceRoot);
}

const summary = validatePackagedCatalog(outputRoot);
console.log(JSON.stringify(summary, null, 2));
