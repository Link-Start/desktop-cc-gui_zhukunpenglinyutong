/**
 * Turn Badge 纯逻辑（Wave 4 / B.1.4，上游设计 §14.5.4）。
 *
 * Badge 只读 `TurnExecutionSnapshot`（Turn 创建时固化），
 * 绝不读取 Picker 当前值。Provider 被删除后仍显示 name snapshot，
 * 并标记 unavailable（历史可解释性，D10）。
 */

import type { TurnExecutionSnapshot } from "./types";
import { resolveSnapshotProviderLabel } from "./types";

export type TurnBadgeUnavailableReason =
  | "provider-deleted"
  | "provider-missing"
  | "runtime-missing";

export type TurnBadgeModel = {
  engine: TurnExecutionSnapshot["engine"];
  providerLabel: string;
  modelLabel: string | null;
  reasoningLabel: string | null;
  unavailable: boolean;
  unavailableReason: TurnBadgeUnavailableReason | null;
};

export type TurnBadgeAvailability = {
  /** Provider profile 当前是否仍存在（删除 → 仅显示 name snapshot）。 */
  providerExists: boolean;
  /** Provider profile 当前是否可用（配置缺失/被禁用）。 */
  providerAvailable: boolean;
  /** Engine runtime 是否可用。 */
  runtimeAvailable: boolean;
};

const FULLY_AVAILABLE: TurnBadgeAvailability = {
  providerExists: true,
  providerAvailable: true,
  runtimeAvailable: true,
};

/** 从固化快照解析 Badge 视图模型。 */
export function resolveTurnBadge(
  snapshot: TurnExecutionSnapshot,
  availability: TurnBadgeAvailability = FULLY_AVAILABLE,
): TurnBadgeModel {
  const providerLabel = resolveSnapshotProviderLabel(snapshot);
  const modelLabel = snapshot.model?.trim() ? snapshot.model.trim() : null;
  const reasoningLabel = snapshot.reasoning?.effort?.trim()
    ? snapshot.reasoning.effort.trim()
    : null;

  let unavailableReason: TurnBadgeUnavailableReason | null = null;
  if (!availability.providerExists) {
    unavailableReason = "provider-deleted";
  } else if (!availability.providerAvailable) {
    unavailableReason = "provider-missing";
  } else if (!availability.runtimeAvailable) {
    unavailableReason = "runtime-missing";
  }

  return {
    engine: snapshot.engine,
    providerLabel,
    modelLabel,
    reasoningLabel,
    unavailable: unavailableReason !== null,
    unavailableReason,
  };
}
