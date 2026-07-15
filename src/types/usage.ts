export type TokenUsageBreakdown = {
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
};

export type ThreadTokenUsage = {
  total: TokenUsageBreakdown;
  last: TokenUsageBreakdown;
  modelContextWindow: number | null;
  contextUsageSource?: string | null;
  contextUsageFreshness?:
    | "live"
    | "restored"
    | "estimated"
    | "pending"
    | string
    | null;
  contextUsedTokens?: number | null;
  contextUsedPercent?: number | null;
  contextRemainingPercent?: number | null;
  contextToolUsages?: Array<{
    name: string;
    server?: string | null;
    tokens: number;
  }> | null;
  contextToolUsagesTruncated?: boolean | null;
  contextCategoryUsages?: Array<{
    name: string;
    tokens: number;
    percent?: number | null;
  }> | null;
};

export type LocalUsageDay = {
  day: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  agentTimeMs: number;
  agentRuns: number;
};

export type LocalUsageTotals = {
  last7DaysTokens: number;
  last30DaysTokens: number;
  averageDailyTokens: number;
  cacheHitRatePercent: number;
  peakDay: string | null;
  peakDayTokens: number;
};

export type LocalUsageModel = {
  model: string;
  tokens: number;
  sharePercent: number;
};

export type LocalUsageSnapshot = {
  updatedAt: number;
  days: LocalUsageDay[];
  totals: LocalUsageTotals;
  topModels: LocalUsageModel[];
};

export type LocalUsageUsageData = {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
};

export type LocalUsageSessionSummary = {
  sessionId: string;
  sessionIdAliases?: string[];
  parentSessionId?: string | null;
  timestamp: number;
  model: string;
  usage: LocalUsageUsageData;
  cost: number;
  summary?: string | null;
  source?: string | null;
  provider?: string | null;
  providerProfileId?: string | null;
  providerProfileSource?: string | null;
  providerProfileName?: string | null;
  providerAvailability?: string | null;
  physicalPath?: string | null;
  fileSizeBytes?: number;
  modifiedLines?: number;
};

export type LocalUsageDailyUsage = {
  date: string;
  sessions: number;
  usage: LocalUsageUsageData;
  cost: number;
  modelsUsed: string[];
};

export type LocalUsageModelUsage = {
  model: string;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  sessionCount: number;
};

export type LocalUsageEngineUsage = {
  engine: string;
  count: number;
};

export type LocalUsageDailyCodeChange = {
  date: string;
  modifiedLines: number;
};

export type LocalUsageWeekData = {
  sessions: number;
  cost: number;
  tokens: number;
};

export type LocalUsageTrends = {
  sessions: number;
  cost: number;
  tokens: number;
};

export type LocalUsageWeeklyComparison = {
  currentWeek: LocalUsageWeekData;
  lastWeek: LocalUsageWeekData;
  trends: LocalUsageTrends;
};

export type LocalUsageStatistics = {
  projectPath: string;
  projectName: string;
  totalSessions: number;
  totalUsage: LocalUsageUsageData;
  estimatedCost: number;
  sessions: LocalUsageSessionSummary[];
  dailyUsage: LocalUsageDailyUsage[];
  weeklyComparison: LocalUsageWeeklyComparison;
  byModel: LocalUsageModelUsage[];
  totalEngineUsageCount: number;
  engineUsage: LocalUsageEngineUsage[];
  aiCodeModifiedLines: number;
  dailyCodeChanges: LocalUsageDailyCodeChange[];
  lastUpdated: number;
};

