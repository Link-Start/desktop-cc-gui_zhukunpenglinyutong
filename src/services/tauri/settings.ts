import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, CodexUnifiedExecExternalStatus } from "../../types";

export interface CodexRuntimeReloadResult {
  status: string;
  stage: string;
  restartedSessions: number;
  message?: string | null;
}

export interface SettingsRecoveryNotice {
  backupFileName: string | null;
}

export async function getCodexConfigPath(): Promise<string> {
  return invoke<string>("get_codex_config_path");
}

export async function getAppSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_app_settings");
}

export async function takeSettingsRecoveryNotice(): Promise<SettingsRecoveryNotice | null> {
  return invoke<SettingsRecoveryNotice | null>("take_settings_recovery_notice");
}

export async function updateAppSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke<AppSettings>("update_app_settings", { settings });
}

export async function getCodexUnifiedExecExternalStatus(): Promise<CodexUnifiedExecExternalStatus> {
  return invoke<CodexUnifiedExecExternalStatus>(
    "get_codex_unified_exec_external_status",
  );
}

export async function restoreCodexUnifiedExecOfficialDefault(): Promise<CodexUnifiedExecExternalStatus> {
  return invoke<CodexUnifiedExecExternalStatus>(
    "restore_codex_unified_exec_official_default",
  );
}

export async function setCodexUnifiedExecOfficialOverride(
  enabled: boolean,
): Promise<CodexUnifiedExecExternalStatus> {
  return invoke<CodexUnifiedExecExternalStatus>(
    "set_codex_unified_exec_official_override",
    { enabled },
  );
}

export async function reloadCodexRuntimeConfig(): Promise<CodexRuntimeReloadResult> {
  return invoke<CodexRuntimeReloadResult>("reload_codex_runtime_config");
}

export type DockIconApplyResult = {
  iconId: string;
  applied: boolean;
  platform: string;
  /** Windows/Linux: number of windows whose chrome icon was updated. */
  windowsUpdated?: number;
  reason?: string | null;
};

export async function setDockIcon(payload: {
  iconId: string;
  /**
   * Prefer `Uint8Array` over `number[]` — catalog icons are ~250KB each and a
   * dense typed array keeps IPC/serialization cost reasonable on all platforms.
   */
  pngBytes?: Uint8Array | number[] | null;
}): Promise<DockIconApplyResult> {
  return invoke<DockIconApplyResult>("set_dock_icon", {
    iconId: payload.iconId,
    pngBytes: payload.pngBytes ?? null,
  });
}
