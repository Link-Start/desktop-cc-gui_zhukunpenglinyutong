import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

function resolveIsolatedPort() {
  const rawPort = process.env.MOSS_DEV_PORT ?? "";
  const port = rawPort.trim() === "" ? 1430 : Number(rawPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`tauri-dev-isolated: invalid MOSS_DEV_PORT "${rawPort}"`);
    process.exit(1);
  }
  return String(port);
}

const isolatedPort = resolveIsolatedPort();
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tauriCli = createRequire(import.meta.url).resolve("@tauri-apps/cli/tauri.js");
const isolatedConfig = JSON.stringify({
  build: {
    devUrl: `http://localhost:${isolatedPort}`,
  },
});

const child = spawn(
  process.execPath,
  [
    tauriCli,
    "dev",
    "--config",
    "src-tauri/tauri.dev.conf.json",
    "--config",
    isolatedConfig,
  ],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      MOSS_DEV_PORT: isolatedPort,
      MOSS_DEV_PORT_ISOLATED: "1",
    },
    stdio: "inherit",
  },
);

child.once("error", (error) => {
  console.error(`tauri-dev-isolated: failed to start tauri\n${error.message}`);
  process.exit(1);
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
