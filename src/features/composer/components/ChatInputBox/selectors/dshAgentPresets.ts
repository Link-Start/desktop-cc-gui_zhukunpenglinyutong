export const DSH_AGENT_PRESET_IDS = [
  "standard",
  "code",
  "minimal",
  "cordis",
] as const;

export type DshAgentPresetId = (typeof DSH_AGENT_PRESET_IDS)[number];

export const DEFAULT_DSH_AGENT_PRESET: DshAgentPresetId = "standard";

export type DshAgentPresetOption = {
  id: DshAgentPresetId;
  shortKey: string;
  shortFallback: string;
  labelKey: string;
  labelFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
};

export const DSH_AGENT_PRESET_OPTIONS: readonly DshAgentPresetOption[] = [
  {
    id: "standard",
    shortKey: "composer.dshAgentPreset.standard.short",
    shortFallback: "标准",
    labelKey: "composer.dshAgentPreset.standard.label",
    labelFallback: "标准模式",
    descriptionKey: "composer.dshAgentPreset.standard.description",
    descriptionFallback: "文件、Shell、检索、Skills、计划、目标、子代理、工作流。",
  },
  {
    id: "code",
    shortKey: "composer.dshAgentPreset.code.short",
    shortFallback: "PTC",
    labelKey: "composer.dshAgentPreset.code.label",
    labelFallback: "PTC 模式",
    descriptionKey: "composer.dshAgentPreset.code.description",
    descriptionFallback: "标准能力 + Code Mode SDK，模型写一个程序串起多步操作。",
  },
  {
    id: "minimal",
    shortKey: "composer.dshAgentPreset.minimal.short",
    shortFallback: "极简",
    labelKey: "composer.dshAgentPreset.minimal.label",
    labelFallback: "极简模式",
    descriptionKey: "composer.dshAgentPreset.minimal.description",
    descriptionFallback: "持久 bash 与 str_replace_editor。没有 Skills / Goal / 子代理。",
  },
  {
    id: "cordis",
    shortKey: "composer.dshAgentPreset.cordis.short",
    shortFallback: "创造",
    labelKey: "composer.dshAgentPreset.cordis.label",
    labelFallback: "创造模式",
    descriptionKey: "composer.dshAgentPreset.cordis.description",
    descriptionFallback: "标准能力 + 运行时检查、插件实验和 preset 创作指导。",
  },
];

export function isDshAgentPresetId(value: string | null | undefined): value is DshAgentPresetId {
  return (
    typeof value === "string" &&
    (DSH_AGENT_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function normalizeDshAgentPreset(
  value: string | null | undefined,
): DshAgentPresetId {
  const trimmed = value?.trim() ?? "";
  return isDshAgentPresetId(trimmed) ? trimmed : DEFAULT_DSH_AGENT_PRESET;
}

export function resolveDshAgentPresetOption(
  value: string | null | undefined,
): DshAgentPresetOption {
  const id = normalizeDshAgentPreset(value);
  return (
    DSH_AGENT_PRESET_OPTIONS.find((option) => option.id === id) ??
    DSH_AGENT_PRESET_OPTIONS[0]
  );
}

export function displayDshAgentPreset(
  value: string | null | undefined,
): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : DEFAULT_DSH_AGENT_PRESET;
}
