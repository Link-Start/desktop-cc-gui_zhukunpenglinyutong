export type WorkspaceNavigationThreadPlan =
  | { action: "restore"; threadId: string }
  | { action: "fallback"; threadId: string }
  | { action: "keep-map" };

export type PlanWorkspaceNavigationThreadInput = {
  lastThreadId?: string | null;
  firstListedThreadId?: string | null;
  allowFirstListedFallback?: boolean;
};

function normalizeThreadId(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Workspace navigation must keep the last selected thread.
 * Sidebar click never invents a first-listed fallback.
 * Keyboard cycle may land on the first listed thread only when that
 * workspace has never recorded a last thread.
 */
export function planWorkspaceNavigationThread(
  input: PlanWorkspaceNavigationThreadInput,
): WorkspaceNavigationThreadPlan {
  const lastThreadId = normalizeThreadId(input.lastThreadId);
  if (lastThreadId) {
    return { action: "restore", threadId: lastThreadId };
  }
  if (input.allowFirstListedFallback) {
    const firstListedThreadId = normalizeThreadId(input.firstListedThreadId);
    if (firstListedThreadId) {
      return { action: "fallback", threadId: firstListedThreadId };
    }
  }
  return { action: "keep-map" };
}

export function applyWorkspaceNavigationThreadPlan(
  plan: WorkspaceNavigationThreadPlan,
  workspaceId: string,
  setActiveThreadId: (threadId: string, workspaceId: string) => void,
): void {
  if (plan.action === "keep-map") {
    return;
  }
  setActiveThreadId(plan.threadId, workspaceId);
}
