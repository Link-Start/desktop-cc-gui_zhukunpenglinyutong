/**
 * Execution Target 类型（Wave 4 / B.1）。
 *
 * 与 Rust `TurnExecutionSnapshot`（`shared_event_log::canonical::types`）对齐。
 * `ExecutionTarget` 是可变选择；`TurnExecutionSnapshot` 在 Turn Attempt 创建时
 * 固化，之后不可变（上游设计 §5.1/§5.2）。
 */

import type { EngineType } from "../../../types/engine";

export type ReasoningSelection = {
  effort: string;
};

/** “下一 Turn 要发给谁”的可变选择。发送时必须固化为 Snapshot。 */
export type ExecutionTarget = {
  engine: EngineType;
  providerProfileId?: string | null;
  model?: string | null;
  reasoning?: ReasoningSelection | null;
};

/** 一次 Turn Attempt 创建时固化的不可变目标快照。 */
export type TurnExecutionSnapshot = {
  engine: EngineType;
  providerProfileId?: string | null;
  model?: string | null;
  reasoning?: ReasoningSelection | null;
  providerProfileNameSnapshot?: string | null;
  providerProfileSource?: string | null;
  runtimeCapabilityFingerprint?: string | null;
};

/** Binding Key = Engine + ProviderProfile；Model 不进 Key（上游设计 §5.4）。 */
export function bindingKeyOf(
  target: Pick<ExecutionTarget, "engine" | "providerProfileId">,
): string {
  const provider = target.providerProfileId?.trim();
  return `${target.engine}:${provider ? provider : "default"}`;
}

/** 把可变选择固化为不可变快照（创建后不得修改）。 */
export function freezeTurnSnapshot(
  target: ExecutionTarget,
  providerMeta?: {
    providerProfileNameSnapshot?: string | null;
    providerProfileSource?: string | null;
    runtimeCapabilityFingerprint?: string | null;
  },
): TurnExecutionSnapshot {
  const snapshot: TurnExecutionSnapshot = {
    engine: target.engine,
    providerProfileId: target.providerProfileId ?? null,
    model: target.model ?? null,
    reasoning: target.reasoning ? { ...target.reasoning } : null,
    providerProfileNameSnapshot: providerMeta?.providerProfileNameSnapshot ?? null,
    providerProfileSource: providerMeta?.providerProfileSource ?? null,
    runtimeCapabilityFingerprint:
      providerMeta?.runtimeCapabilityFingerprint ?? null,
  };
  return Object.freeze(snapshot);
}

/** Provider 被删除后，Badge 仍可通过 name snapshot 解释。 */
export function resolveSnapshotProviderLabel(
  snapshot: TurnExecutionSnapshot,
): string {
  const name = snapshot.providerProfileNameSnapshot?.trim();
  if (name) {
    return name;
  }
  const id = snapshot.providerProfileId?.trim();
  return id ? id : "本地配置";
}
