type WorkspaceLastThreadMap = Record<string, string | null | undefined>;

let publishedLastThreadByWorkspace: WorkspaceLastThreadMap = {};

function normalizeThreadId(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function publishWorkspaceLastThreadMap(
  next: WorkspaceLastThreadMap,
): void {
  publishedLastThreadByWorkspace = { ...next };
}

export function peekWorkspaceLastThreadId(
  workspaceId: string,
): string | null {
  return normalizeThreadId(publishedLastThreadByWorkspace[workspaceId]);
}

export function resetWorkspaceLastThreadMapForTests(): void {
  publishedLastThreadByWorkspace = {};
}
