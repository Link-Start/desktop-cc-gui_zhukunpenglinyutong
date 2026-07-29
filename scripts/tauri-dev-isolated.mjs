import { spawn } from "node:child_process";
import process from "node:process";

const isolatedPort = process.env.MOSS_DEV_PORT || "1430";
const tauriBin = process.platform === "win32" ? "tauri.cmd" : "tauri";

const child = spawn(
  tauriBin,
  ["dev", "--config", "src-tauri/tauri.dev.conf.json"],
  {
    env: {
      ...process.env,
      MOSS_DEV_PORT: isolatedPort,
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
