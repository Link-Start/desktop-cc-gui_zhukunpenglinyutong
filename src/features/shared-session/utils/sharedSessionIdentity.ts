/**
 * Shared Session 身份判定的唯一真相（id-first, kind-second）。
 *
 * `shared:` id 前缀在 create 时即确定，是身份 hard gate；
 * `threadKind` 只是线程列表 merge 投影，可能丢失/默认 native，
 * MUST NOT 单独充当身份判定依据。
 *
 * 调研：docs/analysis/shared-session-model-picker-native-fallback-2026-08-02.md
 * OpenSpec：fix-shared-session-identity-id-first
 */
export function isSharedSessionThreadId(
  threadId: string | null | undefined,
): boolean {
  return Boolean(threadId?.trim().startsWith("shared:"));
}

export function resolveIsSharedSession(
  threadId: string | null | undefined,
  summary: { threadKind?: "native" | "shared" } | null | undefined,
): boolean {
  return isSharedSessionThreadId(threadId) || summary?.threadKind === "shared";
}
