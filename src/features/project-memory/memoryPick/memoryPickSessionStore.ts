import type {
  MemoryPickComposerMode,
  MemoryPickSessionPolicy,
} from "./memoryPickTypes";
import {
  applyComposerMode,
  applyFirstPickCompleted,
  applySessionDismissed,
  createDefaultSessionPolicy,
} from "./memoryPickPolicy";

function sessionKey(workspaceId: string, threadId: string) {
  return `${workspaceId}\u0000${threadId}`;
}

const policies = new Map<string, MemoryPickSessionPolicy>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getMemoryPickSessionPolicy(
  workspaceId: string,
  threadId: string,
): MemoryPickSessionPolicy {
  const key = sessionKey(workspaceId, threadId);
  const existing = policies.get(key);
  if (existing) return existing;
  const created = createDefaultSessionPolicy("off", { firstPickRequired: true });
  policies.set(key, created);
  return created;
}

export function setMemoryPickComposerMode(
  workspaceId: string,
  threadId: string,
  composerMode: MemoryPickComposerMode,
) {
  const key = sessionKey(workspaceId, threadId);
  const prev = getMemoryPickSessionPolicy(workspaceId, threadId);
  // 同 mode 重复写入（每轮 send 同步）不得清掉 session dismissed
  if (prev.composerMode === composerMode) {
    return;
  }
  policies.set(key, applyComposerMode(prev, composerMode));
  emit();
}

/**
 * 用户从 Composer 菜单显式切换模式（含 off）。
 * off 时写入 session，覆盖 gate 固化的 pick，真正关闭后续闸门。
 */
export function forceMemoryPickComposerModeFromMenu(
  workspaceId: string,
  threadId: string,
  composerMode: MemoryPickComposerMode,
) {
  const key = sessionKey(workspaceId, threadId);
  const prev = getMemoryPickSessionPolicy(workspaceId, threadId);
  if (composerMode === "off") {
    policies.set(key, {
      ...prev,
      composerMode: "off",
      // 显式关闭不等于 dismiss；仍可被 firstPick 触发（若仍 firstPick）
    });
    emit();
    return;
  }
  policies.set(key, applyComposerMode(prev, composerMode));
  emit();
}

export function markMemoryPickFirstPickDone(
  workspaceId: string,
  threadId: string,
) {
  const key = sessionKey(workspaceId, threadId);
  const prev = getMemoryPickSessionPolicy(workspaceId, threadId);
  policies.set(key, applyFirstPickCompleted(prev));
  emit();
}

export function markMemoryPickSessionDismissed(
  workspaceId: string,
  threadId: string,
) {
  const key = sessionKey(workspaceId, threadId);
  const prev = getMemoryPickSessionPolicy(workspaceId, threadId);
  policies.set(key, applySessionDismissed(prev));
  emit();
}

/** 一直开启：记住用户本次确认勾选数量，供下轮按相关分预勾 */
export function setMemoryPickAlwaysPreferredCount(
  workspaceId: string,
  threadId: string,
  count: number,
) {
  const key = sessionKey(workspaceId, threadId);
  const prev = getMemoryPickSessionPolicy(workspaceId, threadId);
  const next = Math.max(0, Math.floor(count));
  if (prev.alwaysPreferredCount === next) return;
  policies.set(key, { ...prev, alwaysPreferredCount: next });
  emit();
}

export function clearMemoryPickSessionDismissed(
  workspaceId: string,
  threadId: string,
) {
  const key = sessionKey(workspaceId, threadId);
  const prev = getMemoryPickSessionPolicy(workspaceId, threadId);
  policies.set(key, { ...prev, dismissed: false });
  emit();
}

/** 新 thread 应调用以重置 session 级状态（保留 composerMode 可由调用方写入） */
export function resetMemoryPickSessionPolicy(
  workspaceId: string,
  threadId: string,
  composerMode: MemoryPickComposerMode = "off",
) {
  const key = sessionKey(workspaceId, threadId);
  policies.set(
    key,
    createDefaultSessionPolicy(composerMode, { firstPickRequired: true }),
  );
  emit();
}

export function subscribeMemoryPickSessionStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 测试用 */
export function __resetMemoryPickSessionStoreForTests() {
  policies.clear();
  emit();
}
