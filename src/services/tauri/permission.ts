import { invoke } from "@tauri-apps/api/core";

export async function respondToServerRequest(
  workspaceId: string,
  requestId: number | string,
  decision: "accept" | "decline",
  /** Wave 4 / B.5：Shared Thread 的 binding provider；缺省为 null（旧 default 会话路由）。 */
  providerProfileId?: string | null,
) {
  return invoke("respond_to_server_request", {
    workspaceId,
    requestId,
    result: { decision },
    providerProfileId: providerProfileId ?? null,
  });
}

export async function respondToUserInputRequest(
  workspaceId: string,
  requestId: number | string,
  answers: Record<string, { answers: string[] }>,
  options?: {
    threadId?: string | null;
    turnId?: string | null;
    skippedQuestionIds?: string[];
  },
) {
  const result: Record<string, unknown> = { answers };
  if (options?.skippedQuestionIds?.length) {
    result.skippedQuestionIds = options.skippedQuestionIds;
  }
  return invoke("respond_to_server_request", {
    workspaceId,
    requestId,
    result,
    threadId: options?.threadId ?? null,
    turnId: options?.turnId ?? null,
  });
}

export async function rememberApprovalRule(workspaceId: string, command: string[]) {
  return invoke("remember_approval_rule", { workspaceId, command });
}
