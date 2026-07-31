/**
 * 四级 Target Picker 纯逻辑（Wave 4 / B.1.3）。
 *
 * CLI → Provider → Model → Reasoning 级联选择。
 * Catalog 以注入方式传入（端口），UI 层负责接入真实 provider/model registry；
 * 本模块不猜任何具体 CLI 的 catalog 形状（红线：不猜接口）。
 *
 * 级联规则：
 * - 换 CLI：重置 provider/model/reasoning。
 * - 换 Provider：重置 model/reasoning。
 * - 换 Model：保留 reasoning（仅当仍在新 model 可用集合内，由 UI 层判定）。
 */

import type { EngineType } from "../../../types/engine";
import type { ExecutionTarget, ReasoningSelection } from "./types";

export type TargetPickerLevel = "engine" | "provider" | "model" | "reasoning";

export type TargetPickerOption = {
  value: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
};

/** 每一级的可选项集合；缺省表示该级不可选。 */
export type TargetPickerCatalog = {
  engines: TargetPickerOption[];
  /** key = engine */
  providersByEngine: Record<string, TargetPickerOption[]>;
  /** key = `${engine}:${providerProfileId|"default"}` */
  modelsByBinding: Record<string, TargetPickerOption[]>;
  /** key = model value（缺省时回落到 binding 级 reasoning） */
  reasoningByModel: Record<string, TargetPickerOption[]>;
};

export type TargetPickerOptions = {
  engine: TargetPickerOption[];
  provider: TargetPickerOption[];
  model: TargetPickerOption[];
  reasoning: TargetPickerOption[];
};

function bindingSegment(providerProfileId: string | null | undefined): string {
  const provider = providerProfileId?.trim();
  return provider ? provider : "default";
}

function modelsKeyOf(
  target: Pick<ExecutionTarget, "engine" | "providerProfileId">,
): string {
  return `${target.engine}:${bindingSegment(target.providerProfileId)}`;
}

/** 计算当前选择下四级各自的可选项。 */
export function buildTargetPickerOptions(
  target: ExecutionTarget | null,
  catalog: TargetPickerCatalog,
): TargetPickerOptions {
  const engine = target?.engine ?? null;
  const provider =
    engine !== null ? (catalog.providersByEngine[engine] ?? []) : [];
  const model =
    engine !== null ? (catalog.modelsByBinding[modelsKeyOf({ engine, providerProfileId: target?.providerProfileId })] ?? []) : [];
  const modelValue = target?.model?.trim() ?? "";
  const reasoning =
    engine !== null
      ? (catalog.reasoningByModel[modelValue] ??
        catalog.reasoningByModel[modelsKeyOf({ engine, providerProfileId: target?.providerProfileId })] ??
        [])
      : [];
  return { engine: catalog.engines, provider, model, reasoning };
}

/**
 * 应用某一级的新选择，返回新的 ExecutionTarget。
 * 高级别变更会清空低级别；同级别变更只替换该级。
 */
export function applyPickerSelection(
  current: ExecutionTarget,
  level: TargetPickerLevel,
  value: string | null,
): ExecutionTarget {
  switch (level) {
    case "engine": {
      const engine = (value?.trim() ?? "") as EngineType;
      if (!engine) {
        return current;
      }
      return { engine };
    }
    case "provider":
      return {
        engine: current.engine,
        providerProfileId: value?.trim() ? value.trim() : null,
      };
    case "model":
      return {
        ...current,
        model: value?.trim() ? value.trim() : null,
      };
    case "reasoning": {
      const effort = value?.trim() ?? "";
      const reasoning: ReasoningSelection | null = effort ? { effort } : null;
      return { ...current, reasoning };
    }
  }
}

/** 校验当前选择是否仍然有效（provider/model 在 catalog 内）。 */
export function validatePickerSelection(
  target: ExecutionTarget,
  catalog: TargetPickerCatalog,
): { valid: boolean; invalidLevel?: TargetPickerLevel } {
  const options = buildTargetPickerOptions(target, catalog);
  if (!options.engine.some((option) => option.value === target.engine && !option.disabled)) {
    return { valid: false, invalidLevel: "engine" };
  }
  const provider = target.providerProfileId?.trim();
  if (
    provider &&
    !options.provider.some((option) => option.value === provider && !option.disabled)
  ) {
    return { valid: false, invalidLevel: "provider" };
  }
  const model = target.model?.trim();
  if (model && options.model.length > 0 && !options.model.some((option) => option.value === model && !option.disabled)) {
    return { valid: false, invalidLevel: "model" };
  }
  const effort = target.reasoning?.effort?.trim();
  if (effort && options.reasoning.length > 0 && !options.reasoning.some((option) => option.value === effort && !option.disabled)) {
    return { valid: false, invalidLevel: "reasoning" };
  }
  return { valid: true };
}
