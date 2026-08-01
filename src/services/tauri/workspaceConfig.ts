import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceInfo } from "../../types";
import { isMissingTauriInvokeError } from "./runtimeMode";

export interface WorkspacesRecoveryNotice {
  backupFileName: string | null;
}

export async function listWorkspaces(): Promise<WorkspaceInfo[]> {
  try {
    return await invoke<WorkspaceInfo[]>("list_workspaces");
  } catch (error) {
    if (isMissingTauriInvokeError(error)) {
      // In non-Tauri environments (e.g., Electron/web previews), the invoke
      // bridge may be missing. Treat this as "no workspaces" instead of crashing.
      console.warn("Tauri invoke bridge unavailable; returning empty workspaces list.");
      return [];
    }
    throw error;
  }
}

export async function takeWorkspacesRecoveryNotice(): Promise<WorkspacesRecoveryNotice | null> {
  return invoke<WorkspacesRecoveryNotice | null>("take_workspaces_recovery_notice");
}

export async function getConfigModel(workspaceId: string): Promise<string | null> {
  const response = await invoke<{ model?: string | null }>("get_config_model", {
    workspaceId,
  });
  const model = response?.model;
  if (typeof model !== "string") {
    return null;
  }
  const trimmed = model.trim();
  return trimmed.length > 0 ? trimmed : null;
}
