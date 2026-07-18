export type AgentConfig = {
  id: string;
  name: string;
  prompt?: string | null;
  icon?: string | null;
  createdAt?: number | null;
};

export type BuiltInAgentDivision = {
  id: string;
  order: number;
  count: number;
  enabledCount: number;
  icon?: string | null;
  color?: string | null;
  label: string;
  labelEn: string;
};

export type BuiltInAgent = {
  id: string;
  providerId: string;
  divisionId: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  color?: string | null;
  emoji?: string | null;
  sourcePath: string;
  sourceRevision: string;
  promptHash: string;
  enabled: boolean;
};

export type BuiltInAgentCatalog = {
  providerId: string;
  displayName: string;
  sourceUrl: string;
  sourceRevision: string;
  license: string;
  divisions: BuiltInAgentDivision[];
  agents: BuiltInAgent[];
};

export type BuiltInAgentPrompt = {
  id: string;
  providerId: string;
  sourceRevision: string;
  promptHash: string;
  prompt: string;
};

export type AgentImportPreviewItem = {
  data: AgentConfig;
  status: "new" | "update";
  conflict: boolean;
};

export type AgentImportPreviewResult = {
  items: AgentImportPreviewItem[];
  summary: {
    total: number;
    newCount: number;
    updateCount: number;
  };
};

export type AgentImportApplyResult = {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export type ModelOption = {
  id: string;
  model: string;
  displayName: string;
  description: string;
  source: string;
  providerProfileId?: string | null;
  supportedReasoningEfforts: { reasoningEffort: string; description: string }[];
  defaultReasoningEffort: string | null;
  isDefault: boolean;
};

export type CollaborationModeOption = {
  id: string;
  label: string;
  mode: string;
  model: string;
  reasoningEffort: string | null;
  developerInstructions: string | null;
  value: Record<string, unknown>;
};

export type SkillOption = {
  name: string;
  path: string;
  description?: string;
  source?: string;
  /**
   * Whether the user has enabled this skill. Defaults to `true` for the
   * 12 source buckets that existed before v0.5.14; curated skills use
   * this field to expose their on/off state to the UI.
   */
  enabled?: boolean;
};

/**
 * One curated skill bundled with the client (v0.5.14+). Sourced from
 * `src-tauri/resources/curated-skills/<id>/` and gated by
 * `skills-lock.json` `kind: "curated"`. Frontend fetches the full list
 * via the `get_curated_skills` IPC and the live `enabled` flag separately
 * via `get_enabled_curated_skill_ids`.
 */
export type CuratedSkillOption = {
  name: string;
  displayName: string;
  version: string;
  description: string;
  icon: string;
  category: "code-style" | "ui-design" | "review" | "debug";
  tokenEstimate: number;
  source: string;
  /**
   * Optional absolute URL pointing at the upstream source
   * repository. Present when the curated skill is a copy of an
   * existing public skill (e.g. `lazy-senior-dev` → the
   * `DietrichGebert/ponytail` repo). The Settings UI surfaces this
   * as an inline "View on GitHub" link. `undefined` (not `null`)
   * keeps the field consistent with optional fields elsewhere in
   * the bundle.
   */
  sourceUrl?: string;
  license: string;
  enabled: boolean;
};

export type CustomPromptOption = {
  name: string;
  path: string;
  description?: string;
  argumentHint?: string;
  content: string;
  scope?: "workspace" | "global";
};

export type CustomCommandOption = {
  name: string;
  path: string;
  description?: string;
  argumentHint?: string;
  content: string;
  source?: string;
};

export type OpenCodeAgentOption = {
  id: string;
  description?: string;
  isPrimary: boolean;
};
