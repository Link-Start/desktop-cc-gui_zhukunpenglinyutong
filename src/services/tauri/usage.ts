import { invoke } from "@tauri-apps/api/core";
import type { LocalUsageSnapshot } from "../../types";

export async function localUsageSnapshot(days?: number, workspacePath?: string | null): Promise<LocalUsageSnapshot> {
  const payload: { days: number; workspacePath?: string } = {
    days: days ?? 30,
  };
  if (workspacePath) {
    payload.workspacePath = workspacePath;
  }
  return invoke("local_usage_snapshot", payload);
}
