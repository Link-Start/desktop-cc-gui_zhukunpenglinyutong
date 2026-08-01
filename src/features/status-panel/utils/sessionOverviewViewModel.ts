import type {
  ConversationItem,
  EngineType,
  RateLimitSnapshot,
  ThreadTokenUsage,
} from "../../../types";

export type SessionOverviewStatus = "running" | "compacting" | "idle";

export type SessionOverviewThreadStatus = {
  isProcessing?: boolean;
  isContextCompacting?: boolean;
  processingStartedAt?: number | null;
  lastDurationMs?: number | null;
} | null;

export type SessionOverviewInput = {
  engine: EngineType | null;
  model: string | null;
  workspaceName: string | null;
  workspacePath: string | null;
  isProcessing: boolean;
  threadStatus: SessionOverviewThreadStatus;
  items: readonly ConversationItem[];
  tokenUsage: ThreadTokenUsage | null;
  rateLimits: RateLimitSnapshot | null;
  pendingApprovals: number;
  pendingUserInputs: number;
  /** 注入时钟便于测试;运行中时长以该值减 processingStartedAt。 */
  nowMs: number;
};

export type SessionOverviewViewModel = {
  engine: EngineType | null;
  model: string | null;
  workspaceLabel: string | null;
  status: SessionOverviewStatus;
  durationMs: number | null;
  messageCount: number;
  turnCount: number;
  contextUsedPercent: number | null;
  contextUsedTokens: number | null;
  modelContextWindow: number | null;
  rateLimitPrimaryPercent: number | null;
  pendingApprovals: number;
  pendingUserInputs: number;
  hasAnyContent: boolean;
};

function resolveWorkspaceLabel(
  workspaceName: string | null,
  workspacePath: string | null,
): string | null {
  if (workspaceName && workspaceName.trim().length > 0) {
    return workspaceName;
  }
  if (!workspacePath) {
    return null;
  }
  const segments = workspacePath.split(/[\\/]/).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : null;
}

function resolveStatus(input: SessionOverviewInput): SessionOverviewStatus {
  if (input.threadStatus?.isContextCompacting) {
    return "compacting";
  }
  return input.isProcessing ? "running" : "idle";
}

function resolveDurationMs(
  input: SessionOverviewInput,
  status: SessionOverviewStatus,
): number | null {
  const startedAt = input.threadStatus?.processingStartedAt;
  if (status !== "idle" && typeof startedAt === "number" && startedAt > 0) {
    return Math.max(0, input.nowMs - startedAt);
  }
  const lastDuration = input.threadStatus?.lastDurationMs;
  if (status === "idle" && typeof lastDuration === "number" && lastDuration > 0) {
    return lastDuration;
  }
  return null;
}

export function buildSessionOverview(
  input: SessionOverviewInput,
): SessionOverviewViewModel {
  const status = resolveStatus(input);
  let messageCount = 0;
  let turnCount = 0;
  for (const item of input.items) {
    if (item.kind !== "message") {
      continue;
    }
    messageCount += 1;
    if (item.role === "user") {
      turnCount += 1;
    }
  }
  const contextUsedPercent =
    typeof input.tokenUsage?.contextUsedPercent === "number"
      ? Math.round(input.tokenUsage.contextUsedPercent)
      : null;
  const contextUsedTokens =
    typeof input.tokenUsage?.contextUsedTokens === "number"
      ? input.tokenUsage.contextUsedTokens
      : null;
  const modelContextWindow =
    typeof input.tokenUsage?.modelContextWindow === "number"
      ? input.tokenUsage.modelContextWindow
      : null;
  const rateLimitPrimaryPercent =
    typeof input.rateLimits?.primary?.usedPercent === "number"
      ? Math.round(input.rateLimits.primary.usedPercent)
      : null;

  const workspaceLabel = resolveWorkspaceLabel(
    input.workspaceName,
    input.workspacePath,
  );
  const durationMs = resolveDurationMs(input, status);

  const hasAnyContent =
    input.engine !== null ||
    workspaceLabel !== null ||
    messageCount > 0 ||
    contextUsedPercent !== null;

  return {
    engine: input.engine,
    model: input.model,
    workspaceLabel,
    status,
    durationMs,
    messageCount,
    turnCount,
    contextUsedPercent,
    contextUsedTokens,
    modelContextWindow,
    rateLimitPrimaryPercent,
    pendingApprovals: Math.max(0, input.pendingApprovals),
    pendingUserInputs: Math.max(0, input.pendingUserInputs),
    hasAnyContent,
  };
}
