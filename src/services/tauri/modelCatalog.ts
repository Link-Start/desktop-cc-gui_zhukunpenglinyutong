import { invoke } from "@tauri-apps/api/core";
import { traceStartupCommand, type StartupWorkspaceScope } from "../../features/startup-orchestration/utils/startupTrace";

function workspaceScope(workspaceId: string): StartupWorkspaceScope {
  return { workspaceId };
}

function traceStartupInvoke<T>(
  commandLabel: string,
  scope: StartupWorkspaceScope,
  run: () => Promise<T>,
) {
  return traceStartupCommand(commandLabel, scope, run);
}

export async function getModelList(workspaceId: string) {
  return traceStartupInvoke("model_list", workspaceScope(workspaceId), () =>
    invoke<{
      data?: Record<string, unknown>[];
      result?: { data?: Record<string, unknown>[]; [key: string]: unknown };
      [key: string]: unknown;
    }>("model_list", { workspaceId }),
  );
}

export async function discoverCodexModels(
  workspaceId: string,
  providerProfileId?: string | null,
) {
  const normalizedProviderProfileId = providerProfileId?.trim();
  return invoke<{
    data?: Record<string, unknown>[];
    result?: { data?: Record<string, unknown>[]; [key: string]: unknown };
    [key: string]: unknown;
  }>("discover_codex_models", {
    workspaceId,
    providerProfileId: normalizedProviderProfileId || null,
  });
}

export async function generateRunMetadata(workspaceId: string, prompt: string) {
  return invoke<{ title: string; worktreeName: string }>("generate_run_metadata", {
    workspaceId,
    prompt,
  });
}

export async function getCollaborationModes(workspaceId: string) {
  return traceStartupInvoke("collaboration_mode_list", workspaceScope(workspaceId), () =>
    invoke<{
      data?: Record<string, unknown>[];
      result?: { data?: Record<string, unknown>[]; [key: string]: unknown };
      [key: string]: unknown;
    }>("collaboration_mode_list", { workspaceId }),
  );
}

export async function getAccountRateLimits(workspaceId: string) {
  return invoke<{
    rateLimits?: unknown;
    rate_limits?: unknown;
    result?: {
      rateLimits?: unknown;
      rate_limits?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }>("account_rate_limits", { workspaceId });
}

export async function getAccountInfo(workspaceId: string) {
  return invoke<Record<string, unknown> | null>("account_read", {
    workspaceId,
  });
}

export async function runCodexLogin(workspaceId: string) {
  return invoke<{ output: string }>("codex_login", { workspaceId });
}

export async function cancelCodexLogin(workspaceId: string) {
  return invoke<{ canceled: boolean }>("codex_login_cancel", { workspaceId });
}
