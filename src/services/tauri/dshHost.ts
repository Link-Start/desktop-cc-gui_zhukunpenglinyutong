import { invoke } from "@tauri-apps/api/core";
import type { DshHostDescribeSnapshot } from "../../types";

export type DshHostEnsureResult = {
  origin: string;
  host: string;
  port: number;
  ownership: "adopted" | "spawned";
  describe: DshHostDescribeSnapshot | null;
};

export async function ensureDshHost(): Promise<DshHostEnsureResult> {
  return invoke<DshHostEnsureResult>("ensure_dsh_host");
}

export async function cancelDshHost(): Promise<void> {
  await invoke("cancel_dsh_host");
}
