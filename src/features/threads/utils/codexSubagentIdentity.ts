function normalizeMetadataString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asMetadataRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function codexAgentPathBasename(value: unknown) {
  const path = normalizeMetadataString(value)?.replace(/[\\/]+$/, "");
  return path?.split(/[\\/]/).filter(Boolean).at(-1) ?? null;
}

export function isCodexSubagentActivityItem(
  item: Record<string, unknown>,
): boolean {
  const type = normalizeMetadataString(item.type);
  return type === "subAgentActivity" || type === "sub_agent_activity";
}

export function resolveCodexSubagentIdentity(
  threadId: string,
  thread: Record<string, unknown>,
): { parentThreadId?: string; name?: string } {
  const source = asMetadataRecord(thread.source);
  const subagent = asMetadataRecord(source?.subagent ?? source?.subAgent);
  const threadSpawn = asMetadataRecord(
    subagent?.thread_spawn ?? subagent?.threadSpawn,
  );
  const parentThreadId =
    normalizeMetadataString(thread.parentThreadId) ??
    normalizeMetadataString(thread.parent_thread_id) ??
    normalizeMetadataString(
      threadSpawn?.parent_thread_id ?? threadSpawn?.parentThreadId,
    );
  const name =
    normalizeMetadataString(thread.agentNickname) ??
    normalizeMetadataString(thread.agent_nickname) ??
    normalizeMetadataString(
      threadSpawn?.agent_nickname ?? threadSpawn?.agentNickname,
    ) ??
    codexAgentPathBasename(
      threadSpawn?.agent_path ?? threadSpawn?.agentPath,
    );

  return {
    ...(parentThreadId && parentThreadId !== threadId ? { parentThreadId } : {}),
    ...(name ? { name } : {}),
  };
}
