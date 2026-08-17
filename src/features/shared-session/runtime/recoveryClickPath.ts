export type RecoveryOwner =
  | { kind: "attempt"; attemptId: string; bindingKey: string }
  | { kind: "binding"; bindingKey: string }
  | { kind: "clear" }
  | { kind: "ambiguous" };

const recoveryOwnerPrefetchByScope = new Map<string, Promise<RecoveryOwner>>();

export function recoveryOwnerCacheKey(
  workspaceId: string,
  threadId: string,
): string {
  return `${workspaceId}\u0000${threadId}`;
}

export function prefetchRecoveryOwner(
  workspaceId: string,
  threadId: string,
  lookup: () => Promise<RecoveryOwner>,
): Promise<RecoveryOwner> {
  const key = recoveryOwnerCacheKey(workspaceId, threadId);
  const existing = recoveryOwnerPrefetchByScope.get(key);
  if (existing) {
    return existing;
  }
  const pending = lookup().catch((error: unknown) => {
    recoveryOwnerPrefetchByScope.delete(key);
    throw error;
  });
  recoveryOwnerPrefetchByScope.set(key, pending);
  return pending;
}

export async function takePrefetchedRecoveryOwner(
  workspaceId: string,
  threadId: string,
): Promise<RecoveryOwner | null> {
  const key = recoveryOwnerCacheKey(workspaceId, threadId);
  const pending = recoveryOwnerPrefetchByScope.get(key);
  if (!pending) {
    return null;
  }
  recoveryOwnerPrefetchByScope.delete(key);
  return pending;
}

export function invalidateRecoveryOwnerPrefetch(
  workspaceId: string,
  threadId: string,
): void {
  recoveryOwnerPrefetchByScope.delete(
    recoveryOwnerCacheKey(workspaceId, threadId),
  );
}

export function resetRecoveryOwnerPrefetchForTests(): void {
  recoveryOwnerPrefetchByScope.clear();
}

/** Yield one frame so the recovery click can paint before serial IPC. */
export function yieldRecoveryClickPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    queueMicrotask(resolve);
  });
}
