/**
 * bindingsByTarget 数据模型与迁移（Wave 4 / B.2）。
 *
 * Binding Key = Engine + ProviderProfile（Model 不入 Key，上游设计 §5.4）。
 * 旧 `bindingsByEngine` 一律迁移为 default-provider 语义
 * （`providerProfileId = null`），不猜 managed Provider。
 */

import type { EngineType } from "../../../types/engine";
import { bindingKeyOf } from "./types";

export type SharedBindingAvailability =
  | "provisioning"
  | "ready"
  | "missing-provider"
  | "missing-runtime"
  | "degraded"
  | "recovery-required";

export type SharedTargetBinding = {
  bindingKey: string;
  engine: EngineType;
  providerProfileId: string | null;
  nativeThreadId: string | null;
  nativeSessionId: string | null;
  availability: SharedBindingAvailability;
};

export type BindingsByTarget = Record<string, SharedTargetBinding>;

/** 旧 V0 meta 的 engine 索引 binding（只需要迁移所需的最小字段）。 */
export type LegacyEngineBinding = {
  nativeThreadId?: string | null;
  nativeSessionId?: string | null;
};

function makeBinding(
  engine: EngineType,
  providerProfileId: string | null,
  fields?: Partial<Pick<SharedTargetBinding, "nativeThreadId" | "nativeSessionId" | "availability">>,
): SharedTargetBinding {
  return {
    bindingKey: bindingKeyOf({ engine, providerProfileId }),
    engine,
    providerProfileId,
    nativeThreadId: fields?.nativeThreadId ?? null,
    nativeSessionId: fields?.nativeSessionId ?? null,
    availability: fields?.availability ?? "ready",
  };
}

/** 查找目标对应的 Binding；不存在返回 null。 */
export function findBinding(
  bindings: BindingsByTarget,
  target: { engine: EngineType; providerProfileId?: string | null },
): SharedTargetBinding | null {
  return bindings[bindingKeyOf(target)] ?? null;
}

/** 写入/更新 Binding（按 bindingKey 幂等）。 */
export function upsertBinding(
  bindings: BindingsByTarget,
  binding: SharedTargetBinding,
): BindingsByTarget {
  return { ...bindings, [binding.bindingKey]: binding };
}

/** 为目标创建默认 Binding（ready 之前的占位用 provisioning）。 */
export function createBinding(
  target: { engine: EngineType; providerProfileId?: string | null },
  fields?: Partial<Pick<SharedTargetBinding, "nativeThreadId" | "nativeSessionId" | "availability">>,
): SharedTargetBinding {
  return makeBinding(target.engine, target.providerProfileId ?? null, fields);
}

/**
 * 旧 `bindingsByEngine` → `bindingsByTarget` 迁移。
 * 每个 engine binding 归位到 default-provider 语义；不伪造 managed Provider 身份。
 */
export function migrateBindingsByEngine(
  legacy: Partial<Record<EngineType, LegacyEngineBinding>>,
): BindingsByTarget {
  const migrated: BindingsByTarget = {};
  for (const [engine, binding] of Object.entries(legacy)) {
    if (!binding) {
      continue;
    }
    const target = makeBinding(engine as EngineType, null, {
      nativeThreadId: binding.nativeThreadId ?? null,
      nativeSessionId: binding.nativeSessionId ?? null,
    });
    migrated[target.bindingKey] = target;
  }
  return migrated;
}
