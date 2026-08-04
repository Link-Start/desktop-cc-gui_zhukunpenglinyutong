/**
 * Shared recovery 错误前缀 → 可操作下一步（供 StatusBar / toast 映射 i18n key 后缀）。
 * 保留 raw message 供技术详情；不依赖完整 JSON 结构化错误一期。
 */

export type RecoveryErrorKind =
  | "recovery-active"
  | "recovery-active-requires-stop"
  | "recovery-owner-ambiguous"
  | "recovery-owner-missing"
  | "other";

export function classifyRecoveryError(error: unknown): {
  kind: RecoveryErrorKind;
  raw: string;
} {
  const raw =
    error instanceof Error && error.message
      ? error.message
      : String(error ?? "");
  const lower = raw.toLowerCase();
  if (
    lower.startsWith("recovery-active-requires-stop:") ||
    lower.includes("recovery-active-requires-stop:")
  ) {
    return { kind: "recovery-active-requires-stop", raw };
  }
  if (
    lower.startsWith("recovery-active:") ||
    lower.includes("still owned by runtime")
  ) {
    return { kind: "recovery-active", raw };
  }
  if (
    lower.startsWith("recovery-owner-ambiguous:") ||
    lower.includes("recovery-owner-ambiguous:")
  ) {
    return { kind: "recovery-owner-ambiguous", raw };
  }
  if (
    lower.startsWith("recovery-owner-missing:") ||
    lower.includes("recovery-owner-missing:")
  ) {
    return { kind: "recovery-owner-missing", raw };
  }
  return { kind: "other", raw };
}

/** begin / prepare 路径：明确 target 不可用且可安全视为无 ambiguous durable 时使用。 */
export function isExplicitTargetUnavailableMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.startsWith("target-unavailable:") ||
    normalized.startsWith("target-provider-rejected:") ||
    normalized.includes("provider removed") ||
    normalized.includes("missing-provider") ||
    normalized.includes("missing-runtime")
  );
}
