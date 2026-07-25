import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, CuratedSkillOption } from "../../types";
import { traceStartupCommand, type StartupWorkspaceScope } from "../../features/startup-orchestration/utils/startupTrace";

function workspaceScope(workspaceId: string): StartupWorkspaceScope {
  return { workspaceId };
}

function traceStartupInvoke<T>(
  commandLabel: string,
  scope: StartupWorkspaceScope | "global",
  run: () => Promise<T>,
) {
  return traceStartupCommand(commandLabel, scope, run);
}

export async function getSkillsList(
  workspaceId: string,
  customSkillRoots?: string[],
) {
  return traceStartupInvoke("skills_list", workspaceScope(workspaceId), () =>
    invoke<unknown>("skills_list", {
      workspaceId,
      customSkillRoots: customSkillRoots ?? [],
    }),
  );
}

export async function getCuratedSkills() {
  return invoke<CuratedSkillOption[]>("get_curated_skills");
}

export async function setCuratedSkillEnabled(
  skillId: string,
  enabled: boolean,
) {
  return invoke<AppSettings>("set_curated_skill_enabled", {
    skillId,
    enabled,
  });
}

export async function getEnabledCuratedSkillIds() {
  return invoke<string[]>("get_enabled_curated_skill_ids");
}

export async function getCuratedSkillBodies() {
  return invoke<Array<[string, string]>>("get_curated_skill_bodies");
}

export async function getClaudeCommandsList(workspaceId?: string | null) {
  return traceStartupInvoke(
    "claude_commands_list",
    workspaceId ? workspaceScope(workspaceId) : "global",
    () =>
      invoke<unknown>("claude_commands_list", {
        workspaceId: workspaceId ?? null,
      }),
  );
}

export async function getOpenCodeCommandsList(refresh = false) {
  return traceStartupInvoke("opencode_commands_list", "global", () =>
    invoke<unknown>("opencode_commands_list", { refresh }),
  );
}

export async function startClaudeCommandsWatch(workspaceId?: string | null) {
  return invoke<void>("claude_commands_watch_start", {
    workspaceId: workspaceId ?? null,
  });
}

export async function stopClaudeCommandsWatch(workspaceId?: string | null) {
  return invoke<void>("claude_commands_watch_stop", {
    workspaceId: workspaceId ?? null,
  });
}

export async function getOpenCodeAgentsList(refresh = false) {
  return traceStartupInvoke("opencode_agents_list", "global", () =>
    invoke<unknown>("opencode_agents_list", { refresh }),
  );
}
