import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const fail = (message) => {
  throw new Error(`[opencode-retirement] ${message}`);
};

const forbiddenProductionPaths = [
  "src/styles/opencode-panel.css",
  "src/features/opencode/components/OpenCodeControlPanel.tsx",
  "src/features/opencode/hooks/useOpenCodeControlPanel.ts",
  "src/app-shell-parts/useOpenCodeSelection.ts",
  "src/app-shell-parts/useOpenCodeThreadBinding.ts",
];
for (const relativePath of forbiddenProductionPaths) {
  if (fs.existsSync(path.join(root, relativePath))) {
    fail(`retired production surface still exists: ${relativePath}`);
  }
}

const appShell = read("src/app-shell.tsx");
if (/useOpenCodeSelection|useOpenCodeThreadBinding/.test(appShell)) {
  fail("AppShell still mounts an OpenCode-specific root hook");
}
if (/enabledEngines\s*:/.test(appShell)) {
  fail("AppShell still owns a bypassable optional-engine gate");
}

const bootstrap = read("src/bootstrap.ts");
if (/opencode-panel\.css/.test(bootstrap)) {
  fail("OpenCode-only global CSS remains eagerly imported");
}

for (const relativePath of [
  "src-tauri/src/engine/mod.rs",
  "src-tauri/src/bin/cc_gui_daemon/engine_bridge.rs",
]) {
  const source = read(relativePath);
  if (!/EngineType::OpenCode\s*=>\s*false/.test(source)) {
    fail(`${relativePath} does not fail closed for OpenCode`);
  }
  if (!source.includes("soft-retired and blocked by runtime policy")) {
    fail(`${relativePath} does not expose the retirement diagnostic`);
  }
}

const settings = read("src/features/settings/hooks/useAppSettings.ts");
if (!/opencodeEnabled:\s*false/.test(settings)) {
  fail("frontend settings do not normalize legacy OpenCode enablement");
}
const engineController = read(
  "src/features/engine/hooks/useEngineController.ts",
);
const engineAvailability = read(
  "src/features/engine/hooks/engineControllerAvailability.ts",
);
if (
  !engineController.includes("ENABLED_ENGINE_TYPES") ||
  !/engineType !== "opencode"/.test(engineAvailability)
) {
  fail("engine controller availability owner can still reactivate OpenCode");
}

process.stdout.write("OpenCode soft-retirement boundary valid\n");
