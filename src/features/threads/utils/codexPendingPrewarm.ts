// Codex 乐观创建会话的预热登记表。
//
// 点「新建 Codex 会话」时前端先造 `codex-pending-*` 假线程秒开 UI，同时后台
// 预热真实的 thread/start。app-server 起线程后会主动推送 `thread/started`
// 通知，事件里带的是**真实 thread id**：若照常走 onThreadStarted → ensureThread，
// 侧边栏就会在 pending 之外再多出一条空会话（真 id 无引擎前缀，reducer 的
// pending 内联改绑分支只认 claude:/gemini:/opencode:，接不住它）。
//
// pending → 真 id 的换绑要等首次发消息时的 finalizeCodexPendingThread 才做
// （绝不在打字中途换绑），所以创建到首发之间必须把预热自己触发的
// thread/started 挡在侧边栏之外。
//
// 时序注意：notification 可能早于 thread/start 的 response 到达，那一刻我们还
// 拿不到真 id，无从判断事件是不是自己人。因此 in-flight 期间按 workspace 粒度
// 抑制，拿到真 id 后收窄为按 id 精确抑制。

type CodexPrewarmEntry = {
  workspaceId: string;
  /** null 表示 thread/start 仍在飞行中，真 id 未知。 */
  realThreadId: string | null;
};

const prewarmByPendingThreadId = new Map<string, CodexPrewarmEntry>();

export function registerCodexPrewarm(
  workspaceId: string,
  pendingThreadId: string,
): void {
  prewarmByPendingThreadId.set(pendingThreadId, {
    workspaceId,
    realThreadId: null,
  });
}

export function settleCodexPrewarm(
  pendingThreadId: string,
  realThreadId: string | null,
): void {
  const entry = prewarmByPendingThreadId.get(pendingThreadId);
  if (!entry) {
    return;
  }
  if (!realThreadId) {
    // 预热失败，没有真 id 可挡。继续留着只会无差别抑制本 workspace 的其他线程。
    prewarmByPendingThreadId.delete(pendingThreadId);
    return;
  }
  prewarmByPendingThreadId.set(pendingThreadId, { ...entry, realThreadId });
}

export function releaseCodexPrewarm(pendingThreadId: string): void {
  prewarmByPendingThreadId.delete(pendingThreadId);
}

/**
 * 这条 thread/started 是否由尚未换绑的预热线程触发。
 * 是则不该让它单独进侧边栏——它稍后会经 finalize 换绑到 pending 条目上。
 */
export function isCodexPrewarmThreadStart(
  workspaceId: string,
  threadId: string,
): boolean {
  for (const entry of prewarmByPendingThreadId.values()) {
    if (entry.workspaceId !== workspaceId) {
      continue;
    }
    if (entry.realThreadId === null || entry.realThreadId === threadId) {
      return true;
    }
  }
  return false;
}

export function resetCodexPendingPrewarmForTests(): void {
  prewarmByPendingThreadId.clear();
}
