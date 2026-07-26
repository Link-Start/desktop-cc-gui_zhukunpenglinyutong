import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const relativePath = "src/features/engine/hooks/useEngineController.ts";
const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
const lineCount = source.split(/\r?\n/).length;
const fail = (message) => {
  throw new Error(`[engine-controller-facade] ${message}`);
};

if (lineCount > 600) {
  fail(`${relativePath} is ${lineCount} lines; governance threshold is 600`);
}

for (const forbidden of [
  "ENGINE_DISPLAY_MAP",
  "getGeneratedModelFallbacks",
  "PROVIDER_STORAGE_KEYS",
  "pushGlobalRuntimeNotice",
  "readClaudeCustomModelsFromStorage",
  "setInterval(",
  "addEventListener(",
  "liveAssistantTextChannel",
]) {
  if (source.includes(forbidden)) {
    fail(`facade still owns forbidden concern: ${forbidden}`);
  }
}

for (const requiredOwner of [
  "engineControllerAvailability",
  "engineControllerCatalog",
  "engineControllerSelection",
  "useEngineRuntimeNotices",
  "useEngineCatalogRevision",
]) {
  if (!source.includes(requiredOwner)) {
    fail(`facade does not delegate to ${requiredOwner}`);
  }
}

process.stdout.write(
  `engine controller facade valid: ${lineCount} lines, low-frequency owners delegated\n`,
);
