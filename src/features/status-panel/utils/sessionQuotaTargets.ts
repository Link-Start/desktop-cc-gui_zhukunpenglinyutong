import type { ConversationItem, EngineType } from "../../../types";

export type SessionQuotaTarget = {
  /** `${engine}::${providerProfileId ?? "local"}` */
  key: string;
  engine: EngineType;
  providerProfileId: string | null;
  /** 展示用：本地配置 / Minimax-m3 / kimi */
  providerLabel: string;
  model: string | null;
};

export type SessionQuotaTargetFallback = {
  engine: EngineType | null;
  providerProfileId?: string | null;
  providerLabel?: string | null;
  model?: string | null;
};

export function buildSessionQuotaTargetKey(
  engine: EngineType | string,
  providerProfileId?: string | null,
): string {
  const profile = providerProfileId?.trim() || "local";
  return `${String(engine).trim().toLowerCase()}::${profile}`;
}

function isEngineType(value: unknown): value is EngineType {
  return (
    value === "codex" ||
    value === "claude" ||
    value === "gemini" ||
    value === "grok" ||
    value === "kimi" ||
    value === "opencode"
  );
}

/**
 * 从会话 items 的 executionTargetSnapshot 收集去重后的供应商目标。
 * 共享会话多引擎切换时用于并行查额度；原生会话通常只有 fallback 一条。
 */
export function collectSessionQuotaTargets(
  items: readonly ConversationItem[],
  fallback: SessionQuotaTargetFallback,
): SessionQuotaTarget[] {
  const ordered = new Map<string, SessionQuotaTarget>();

  for (const item of items) {
    if (item.kind !== "message") {
      continue;
    }
    const snap = item.executionTargetSnapshot;
    const engine =
      (snap?.engine && isEngineType(snap.engine) ? snap.engine : null) ??
      (item.engineSource && isEngineType(item.engineSource)
        ? item.engineSource
        : null);
    if (!engine) {
      continue;
    }
    const providerProfileId =
      typeof snap?.providerProfileId === "string" &&
      snap.providerProfileId.trim().length > 0
        ? snap.providerProfileId.trim()
        : null;
    const key = buildSessionQuotaTargetKey(engine, providerProfileId);
    if (ordered.has(key)) {
      continue;
    }
    const providerLabel =
      (typeof snap?.providerProfileNameSnapshot === "string" &&
      snap.providerProfileNameSnapshot.trim().length > 0
        ? snap.providerProfileNameSnapshot.trim()
        : null) ?? engine;
    const model =
      typeof snap?.model === "string" && snap.model.trim().length > 0
        ? snap.model.trim()
        : null;
    ordered.set(key, {
      key,
      engine,
      providerProfileId,
      providerLabel,
      model,
    });
  }

  if (fallback.engine && isEngineType(fallback.engine)) {
    const providerProfileId =
      typeof fallback.providerProfileId === "string" &&
      fallback.providerProfileId.trim().length > 0
        ? fallback.providerProfileId.trim()
        : null;
    const key = buildSessionQuotaTargetKey(fallback.engine, providerProfileId);
    if (!ordered.has(key)) {
      ordered.set(key, {
        key,
        engine: fallback.engine,
        providerProfileId,
        providerLabel:
          (typeof fallback.providerLabel === "string" &&
          fallback.providerLabel.trim().length > 0
            ? fallback.providerLabel.trim()
            : null) ?? fallback.engine,
        model:
          typeof fallback.model === "string" && fallback.model.trim().length > 0
            ? fallback.model.trim()
            : null,
      });
    }
  }

  return Array.from(ordered.values());
}

export function formatSessionQuotaTargetTitle(target: SessionQuotaTarget): string {
  const engineLabel =
    target.engine === "claude"
      ? "Claude"
      : target.engine === "codex"
        ? "Codex"
        : target.engine === "kimi"
          ? "Kimi"
          : target.engine === "grok"
            ? "Grok"
            : target.engine === "opencode"
              ? "OpenCode"
              : target.engine === "gemini"
                ? "Gemini"
                : target.engine;
  if (
    target.providerLabel &&
    target.providerLabel !== target.engine &&
    target.providerLabel.toLowerCase() !== engineLabel.toLowerCase()
  ) {
    return `${engineLabel} · ${target.providerLabel}`;
  }
  return engineLabel;
}
