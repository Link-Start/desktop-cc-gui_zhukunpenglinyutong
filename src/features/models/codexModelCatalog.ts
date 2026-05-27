export type CodexModelCatalogEntry = {
  id: string;
  label: string;
  description: string;
  supportedReasoningEfforts?: { reasoningEffort: string; description: string }[];
  defaultReasoningEffort?: string | null;
};

const STANDARD_CODEX_REASONING_EFFORTS = [
  { reasoningEffort: "low", description: "Quick responses with basic reasoning" },
  { reasoningEffort: "medium", description: "Balanced thinking" },
  { reasoningEffort: "high", description: "Deep reasoning for complex tasks" },
  { reasoningEffort: "xhigh", description: "Extra high reasoning depth" },
];

export const CODEX_MODEL_CATALOG: CodexModelCatalogEntry[] = [
  {
    id: "gpt-5.5",
    label: "gpt-5.5",
    description: "Frontier model for complex coding, research, and real-world work.",
    supportedReasoningEfforts: STANDARD_CODEX_REASONING_EFFORTS,
    defaultReasoningEffort: "medium",
  },
  {
    id: "gpt-5.4",
    label: "gpt-5.4",
    description: "Strong model for everyday coding.",
    supportedReasoningEfforts: STANDARD_CODEX_REASONING_EFFORTS,
    defaultReasoningEffort: "medium",
  },
  {
    id: "gpt-5.4-mini",
    label: "gpt-5.4-mini",
    description: "Small, fast, and cost-efficient model for simpler coding tasks.",
    supportedReasoningEfforts: STANDARD_CODEX_REASONING_EFFORTS,
    defaultReasoningEffort: "medium",
  },
  {
    id: "gpt-5.3-codex",
    label: "gpt-5.3-codex",
    description: "Coding-optimized model.",
    supportedReasoningEfforts: STANDARD_CODEX_REASONING_EFFORTS,
    defaultReasoningEffort: "medium",
  },
  {
    id: "gpt-5.3-codex-spark",
    label: "gpt-5.3-codex-spark",
    description: "Ultra-fast coding model.",
    supportedReasoningEfforts: STANDARD_CODEX_REASONING_EFFORTS,
    defaultReasoningEffort: "high",
  },
  {
    id: "gpt-5.2",
    label: "gpt-5.2",
    description: "Optimized for professional work and long-running agents.",
    supportedReasoningEfforts: STANDARD_CODEX_REASONING_EFFORTS,
    defaultReasoningEffort: "medium",
  },
];
