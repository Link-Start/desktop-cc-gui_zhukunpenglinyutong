#!/usr/bin/env node
/**
 * Release packaging binary contract gate.
 *
 * Prevents a class of Tauri multi-bin packaging failures:
 * - `package.default-run` MUST be the always-built main binary (`cc-gui`).
 * - Feature-gated bins (e.g. `cc-gui-debug` + `debug-bin`) MUST NOT be
 *   default-run: tauri-cli re-injects default-run into the bundle list even
 *   when required-features were not enabled, then AppImage/NSIS/macOS fails with
 *   "Failed to copy binary ... does not exist".
 * - Release workflows/scripts MUST NOT enable `debug-bin`.
 * - Linux AppImage paths MUST keep NO_STRIP so updater markers survive.
 *
 * Affects: macOS .app, Linux AppImage, Windows NSIS — same get_binaries path.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_MAIN_BIN = "cc-gui";
const DEV_ONLY_BIN = "cc-gui-debug";
const DEV_ONLY_FEATURE = "debug-bin";

const errors = [];

function read(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function parseCargoDefaultRun(cargoToml) {
  const match = cargoToml.match(/^\s*default-run\s*=\s*"([^"]+)"/m);
  return match?.[1] ?? null;
}

function parseCargoFeatureGatedBins(cargoToml) {
  /** @type {{ name: string, requiredFeatures: string[] }[]} */
  const bins = [];
  const binBlocks = cargoToml.split(/^\[\[bin\]\]/m).slice(1);
  for (const block of binBlocks) {
    const name = block.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1];
    if (!name) continue;
    const requiredFeaturesRaw = block.match(
      /^\s*required-features\s*=\s*\[([^\]]*)\]/m,
    )?.[1];
    const requiredFeatures = requiredFeaturesRaw
      ? [...requiredFeaturesRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1])
      : [];
    bins.push({ name, requiredFeatures });
  }
  return bins;
}

// --- Cargo.toml -----------------------------------------------------------
const cargoToml = read("src-tauri/Cargo.toml");
const defaultRun = parseCargoDefaultRun(cargoToml);
assert(
  defaultRun === RELEASE_MAIN_BIN,
  `src-tauri/Cargo.toml default-run must be "${RELEASE_MAIN_BIN}" (got ${JSON.stringify(defaultRun)}). ` +
    `Pointing default-run at a feature-gated bin makes tauri-cli force-package a missing binary on AppImage/NSIS/macOS.`,
);

const bins = parseCargoFeatureGatedBins(cargoToml);
const debugBin = bins.find((b) => b.name === DEV_ONLY_BIN);
assert(
  debugBin !== undefined,
  `src-tauri/Cargo.toml must declare [[bin]] name = "${DEV_ONLY_BIN}" for local Dock-label dev runs.`,
);
assert(
  debugBin?.requiredFeatures.includes(DEV_ONLY_FEATURE) === true,
  `src-tauri/Cargo.toml [[bin]] "${DEV_ONLY_BIN}" must set required-features = ["${DEV_ONLY_FEATURE}"] so release builds do not compile it.`,
);

for (const bin of bins) {
  if (bin.requiredFeatures.length === 0) continue;
  assert(
    bin.name !== defaultRun,
    `src-tauri/Cargo.toml default-run "${defaultRun}" must not be a required-features bin (${bin.name} needs ${bin.requiredFeatures.join(",")}).`,
  );
}

// --- tauri release config -------------------------------------------------
const tauriConf = JSON.parse(read("src-tauri/tauri.conf.json"));
assert(
  tauriConf.mainBinaryName === RELEASE_MAIN_BIN,
  `src-tauri/tauri.conf.json mainBinaryName must be "${RELEASE_MAIN_BIN}" (got ${JSON.stringify(tauriConf.mainBinaryName)}).`,
);

const tauriDevConf = JSON.parse(read("src-tauri/tauri.dev.conf.json"));
assert(
  tauriDevConf.mainBinaryName === DEV_ONLY_BIN,
  `src-tauri/tauri.dev.conf.json mainBinaryName must stay "${DEV_ONLY_BIN}" for Dock tooltip (got ${JSON.stringify(tauriDevConf.mainBinaryName)}).`,
);

// --- package.json scripts -------------------------------------------------
const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts ?? {};

const releaseBuildScripts = [
  "tauri:build",
  "tauri:build:win",
  "build:appimage",
  "build:mac-arm64",
  "build:mac-x64",
  "build:mac-universal",
  "build:win-x64",
  "build:linux-x64",
  "build:linux-arm64",
  "build:all",
];

for (const name of releaseBuildScripts) {
  const cmd = scripts[name];
  if (typeof cmd !== "string") continue;
  assert(
    !cmd.includes(DEV_ONLY_FEATURE),
    `package.json scripts.${name} must not enable --features ${DEV_ONLY_FEATURE} (release packaging path).`,
  );
}

assert(
  typeof scripts["build:appimage"] === "string" &&
    scripts["build:appimage"].includes("NO_STRIP=1"),
  'package.json scripts.build:appimage must set NO_STRIP=1 (updater/plugin binary markers).',
);

const devScripts = ["tauri:dev", "tauri:dev:hot"];
for (const name of devScripts) {
  const cmd = scripts[name];
  assert(
    typeof cmd === "string" && cmd.includes(DEV_ONLY_FEATURE),
    `package.json scripts.${name} must pass --features ${DEV_ONLY_FEATURE} for Dock-label debug binary.`,
  );
  assert(
    typeof cmd === "string" && cmd.includes("tauri.dev.conf.json"),
    `package.json scripts.${name} must load tauri.dev.conf.json (mainBinaryName=${DEV_ONLY_BIN}).`,
  );
}

// --- release workflow -----------------------------------------------------
const releaseYml = read(".github/workflows/release.yml");
// Only flag real command lines (not comments) that enable the debug feature.
const releaseCommandLines = releaseYml
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#") && !line.startsWith("- name:"));
const releaseEnablesDebugBin = releaseCommandLines.some(
  (line) =>
    /(?:^|[\s"'])--features(?:\s+|=)[^\n]*\bdebug-bin\b/.test(line) ||
    (line.includes("features") &&
      line.includes(DEV_ONLY_FEATURE) &&
      /tauri|cargo/.test(line) &&
      !line.startsWith("#")),
);
assert(
  !releaseEnablesDebugBin,
  `.github/workflows/release.yml must not enable --features ${DEV_ONLY_FEATURE} on any platform job.`,
);

// AppImage job should set NO_STRIP (env key or inline assignment).
const appimageBuildIdx = releaseYml.indexOf("build AppImage");
assert(appimageBuildIdx >= 0, ".github/workflows/release.yml must contain a build AppImage step.");
const appimageWindow = releaseYml.slice(appimageBuildIdx, appimageBuildIdx + 800);
assert(
  /NO_STRIP\s*[:=]/.test(appimageWindow) || appimageWindow.includes("NO_STRIP=1"),
  ".github/workflows/release.yml AppImage build step must set NO_STRIP=1 (matches local build:appimage).",
);

// Explicit build commands must not target the debug binary name as the only product.
assert(
  !releaseCommandLines.some((line) => /tauri\s+--\s+build/.test(line) && line.includes(DEV_ONLY_BIN)),
  ".github/workflows/release.yml must not pass cc-gui-debug to tauri build.",
);

// --- local platform builder -----------------------------------------------
const buildPlatform = read("scripts/build-platform.mjs");
const buildPlatformCommands = buildPlatform
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("//") && !line.startsWith("*"));
assert(
  !buildPlatformCommands.some((line) =>
    /--features(?:\s+|=)[^\n]*\bdebug-bin\b/.test(line),
  ),
  "scripts/build-platform.mjs must not enable debug-bin for packaging.",
);
assert(
  buildPlatform.includes("NO_STRIP=1"),
  "scripts/build-platform.mjs Linux AppImage path must keep NO_STRIP=1.",
);

// --- report ---------------------------------------------------------------
if (errors.length > 0) {
  console.error("check-release-package-bins: FAILED\n");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  console.error(
    "\nSee src-tauri/Cargo.toml comments and scripts/check-release-package-bins.mjs.",
  );
  process.exit(1);
}

console.log("check-release-package-bins: OK");
console.log(
  `  default-run=${defaultRun}, mainBinaryName=${tauriConf.mainBinaryName}, dev mainBinaryName=${tauriDevConf.mainBinaryName}`,
);
process.exit(0);
