import type {
  ConversationItem,
  EngineType,
  RateLimitSnapshot,
  RateLimitWindow,
  ThreadTokenUsage,
} from "../../../types";
import { formatRateLimitWindowLabel } from "../../../utils/rateLimitLabels";

export type SessionOverviewStatus = "running" | "compacting" | "idle";

export type SessionOverviewThreadStatus = {
  isProcessing?: boolean;
  isContextCompacting?: boolean;
  processingStartedAt?: number | null;
  lastDurationMs?: number | null;
} | null;

/**
 * official_cli: Codex 官方 runtime（account/rateLimits）
 * coding_plan: Kimi/MiniMax/智谱等供应商 API
 * none: 官方无 plan（如 Claude 官方）— UI 应隐藏额度块
 * unsupported / empty / error: 无可用额度
 */
export type SessionOverviewQuotaSource =
  | "official_cli"
  | "coding_plan"
  | "unsupported"
  | "empty"
  | "error"
  | "none";

export type SessionOverviewQuotaWindowView = {
  id: string;
  /** 窗口标签，如 5小时 / 7天 / 5h limit */
  label: string;
  /** 用于进度条与百分比文案的展示值（已按 remaining 设置翻转） */
  displayPercent: number;
  usedPercent: number;
  resetsAt: number | null;
};

export type SessionOverviewQuotaView = {
  source: SessionOverviewQuotaSource;
  /** 展示用供应商名：codex / kimi / minimax / zhipu */
  providerLabel: string | null;
  showRemaining: boolean;
  planType: string | null;
  windows: SessionOverviewQuotaWindowView[];
  creditsBalance: string | null;
  creditsUnlimited: boolean;
  hasCredits: boolean;
  error: string | null;
  loading: boolean;
};

export type CodingPlanQuotaInput = {
  source: string;
  success: boolean;
  error?: string | null;
  planLabel?: string | null;
  windows: Array<{
    id: string;
    usedPercent: number;
    remainingPercent: number;
    resetsAt?: string | null;
  }>;
} | null;

export type SessionOverviewInput = {
  sessionId: string | null;
  engine: EngineType | null;
  model: string | null;
  workspaceName: string | null;
  workspacePath: string | null;
  /** 会话 transcript / 落盘文件路径；没有则不展示。 */
  sessionDiskPath: string | null;
  isProcessing: boolean;
  threadStatus: SessionOverviewThreadStatus;
  items: readonly ConversationItem[];
  tokenUsage: ThreadTokenUsage | null;
  rateLimits: RateLimitSnapshot | null;
  /** Coding Plan 额度（Kimi/MiniMax/智谱）；codex 会话可传 null。 */
  codingPlanQuota: CodingPlanQuotaInput;
  codingPlanQuotaLoading?: boolean;
  /** 与设置 usageShowRemaining 对齐：true 显示剩余，false 显示已用。 */
  usageShowRemaining: boolean;
  /** 注入时钟便于测试;运行中时长以该值减 processingStartedAt。 */
  nowMs: number;
};

export type SessionOverviewViewModel = {
  sessionId: string | null;
  engine: EngineType | null;
  model: string | null;
  workspaceLabel: string | null;
  workspacePath: string | null;
  sessionDiskPath: string | null;
  status: SessionOverviewStatus;
  durationMs: number | null;
  messageCount: number;
  turnCount: number;
  contextUsedPercent: number | null;
  contextUsedTokens: number | null;
  modelContextWindow: number | null;
  quota: SessionOverviewQuotaView;
  hasAnyContent: boolean;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

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

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildQuotaWindow(
  id: "primary" | "secondary",
  window: RateLimitWindow | null | undefined,
  showRemaining: boolean,
): SessionOverviewQuotaWindowView | null {
  if (!window || typeof window.usedPercent !== "number") {
    return null;
  }
  const usedPercent = clampPercent(window.usedPercent);
  const displayPercent = showRemaining
    ? clampPercent(100 - usedPercent)
    : usedPercent;
  return {
    id,
    label: formatRateLimitWindowLabel(window.windowDurationMins),
    displayPercent,
    usedPercent,
    resetsAt:
      typeof window.resetsAt === "number" && Number.isFinite(window.resetsAt)
        ? window.resetsAt
        : null,
  };
}

function parseResetAtToMs(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function codingPlanWindowLabel(id: string): string {
  if (id === "five_hour" || id === "primary") {
    return "5小时";
  }
  if (id === "weekly_limit" || id === "secondary" || id === "seven_day") {
    return "7天";
  }
  return id;
}

function buildCodingPlanWindows(
  codingPlan: NonNullable<CodingPlanQuotaInput>,
  showRemaining: boolean,
): SessionOverviewQuotaWindowView[] {
  return codingPlan.windows.map((window) => {
    const usedPercent = clampPercent(window.usedPercent);
    const remainingPercent = clampPercent(
      typeof window.remainingPercent === "number"
        ? window.remainingPercent
        : 100 - usedPercent,
    );
    return {
      id: window.id,
      label: codingPlanWindowLabel(window.id),
      displayPercent: showRemaining ? remainingPercent : usedPercent,
      usedPercent,
      resetsAt: parseResetAtToMs(window.resetsAt ?? null),
    };
  });
}

function buildOfficialCliQuota(
  rateLimits: RateLimitSnapshot | null,
  usageShowRemaining: boolean,
  providerLabel: string,
): SessionOverviewQuotaView {
  const windows: SessionOverviewQuotaWindowView[] = [];
  const primary = buildQuotaWindow(
    "primary",
    rateLimits?.primary,
    usageShowRemaining,
  );
  const secondary = buildQuotaWindow(
    "secondary",
    rateLimits?.secondary,
    usageShowRemaining,
  );
  if (primary) {
    windows.push(primary);
  }
  if (secondary) {
    windows.push(secondary);
  }
  const credits = rateLimits?.credits ?? null;
  const creditsBalance = normalizeOptionalText(credits?.balance ?? null);
  const creditsUnlimited = credits?.unlimited === true;
  const hasCredits =
    credits?.hasCredits === true || creditsUnlimited || creditsBalance != null;

  return {
    source: "official_cli",
    providerLabel,
    showRemaining: usageShowRemaining,
    planType: normalizeOptionalText(rateLimits?.planType ?? null),
    windows,
    creditsBalance,
    creditsUnlimited,
    hasCredits,
    error: null,
    loading: false,
  };
}

/**
 * 路由合并（对齐规则）：
 * - coding_plan 成功且有窗口 → 用供应商 API
 * - official_cli / source=codex → account rateLimits
 * - none → 隐藏
 * - 其余 → empty / unsupported / error
 */
export function buildSessionOverviewQuota(
  engine: EngineType | null,
  rateLimits: RateLimitSnapshot | null,
  usageShowRemaining: boolean,
  codingPlanQuota: CodingPlanQuotaInput = null,
  codingPlanQuotaLoading = false,
): SessionOverviewQuotaView {
  if (engine == null) {
    return {
      source: "none",
      providerLabel: null,
      showRemaining: usageShowRemaining,
      planType: null,
      windows: [],
      creditsBalance: null,
      creditsUnlimited: false,
      hasCredits: false,
      error: null,
      loading: codingPlanQuotaLoading,
    };
  }

  if (codingPlanQuotaLoading && !codingPlanQuota) {
    return {
      source: "coding_plan",
      providerLabel: engine,
      showRemaining: usageShowRemaining,
      planType: null,
      windows: [],
      creditsBalance: null,
      creditsUnlimited: false,
      hasCredits: false,
      error: null,
      loading: true,
    };
  }

  // 供应商 Coding Plan 优先（含 Codex/Claude 配了 MiniMax/Kimi 的情况）
  if (
    codingPlanQuota &&
    codingPlanQuota.success &&
    codingPlanQuota.windows.length > 0 &&
    codingPlanQuota.source !== "codex" &&
    codingPlanQuota.source !== "official_cli" &&
    codingPlanQuota.source !== "none"
  ) {
    return {
      source: "coding_plan",
      providerLabel: codingPlanQuota.source,
      showRemaining: usageShowRemaining,
      planType: normalizeOptionalText(codingPlanQuota.planLabel ?? null),
      windows: buildCodingPlanWindows(codingPlanQuota, usageShowRemaining),
      creditsBalance: null,
      creditsUnlimited: false,
      hasCredits: false,
      error: null,
      loading: false,
    };
  }

  // 官方 runtime：Codex account/rateLimits
  if (
    codingPlanQuota?.source === "codex" ||
    codingPlanQuota?.source === "official_cli" ||
    (engine === "codex" &&
      (!codingPlanQuota ||
        codingPlanQuota.source === "codex" ||
        codingPlanQuota.source === "official_cli"))
  ) {
    return buildOfficialCliQuota(rateLimits, usageShowRemaining, "codex");
  }

  // 官方 Claude 等：无 plan 块
  if (codingPlanQuota?.source === "none") {
    return {
      source: "none",
      providerLabel: engine,
      showRemaining: usageShowRemaining,
      planType: null,
      windows: [],
      creditsBalance: null,
      creditsUnlimited: false,
      hasCredits: false,
      error: null,
      loading: false,
    };
  }

  if (!codingPlanQuota) {
    // 无 coding plan 响应时：仅 codex 回退 rateLimits
    if (engine === "codex") {
      return buildOfficialCliQuota(rateLimits, usageShowRemaining, "codex");
    }
    return {
      source: "empty",
      providerLabel: engine,
      showRemaining: usageShowRemaining,
      planType: null,
      windows: [],
      creditsBalance: null,
      creditsUnlimited: false,
      hasCredits: false,
      error: null,
      loading: false,
    };
  }

  if (
    codingPlanQuota.source === "unsupported" ||
    codingPlanQuota.source === "empty_credentials" ||
    codingPlanQuota.source === "empty"
  ) {
    return {
      source:
        codingPlanQuota.source === "unsupported" ? "unsupported" : "empty",
      providerLabel: codingPlanQuota.source,
      showRemaining: usageShowRemaining,
      planType: null,
      windows: [],
      creditsBalance: null,
      creditsUnlimited: false,
      hasCredits: false,
      // unsupported 对非官方中转才展示 error；empty 不吓人
      error:
        codingPlanQuota.source === "unsupported"
          ? (codingPlanQuota.error ?? null)
          : null,
      loading: false,
    };
  }

  if (!codingPlanQuota.success) {
    return {
      source: "error",
      providerLabel: codingPlanQuota.source,
      showRemaining: usageShowRemaining,
      planType: null,
      windows: [],
      creditsBalance: null,
      creditsUnlimited: false,
      hasCredits: false,
      error: codingPlanQuota.error ?? "quota query failed",
      loading: false,
    };
  }

  // success 但无 windows（官方 runtime 空窗口）
  if (
    codingPlanQuota.source === "codex" ||
    codingPlanQuota.source === "official_cli"
  ) {
    return buildOfficialCliQuota(rateLimits, usageShowRemaining, "codex");
  }

  return {
    source: "coding_plan",
    providerLabel: codingPlanQuota.source,
    showRemaining: usageShowRemaining,
    planType: normalizeOptionalText(codingPlanQuota.planLabel ?? null),
    windows: buildCodingPlanWindows(codingPlanQuota, usageShowRemaining),
    creditsBalance: null,
    creditsUnlimited: false,
    hasCredits: false,
    error: null,
    loading: false,
  };
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
      ? clampPercent(input.tokenUsage.contextUsedPercent)
      : null;
  const contextUsedTokens =
    typeof input.tokenUsage?.contextUsedTokens === "number"
      ? input.tokenUsage.contextUsedTokens
      : null;
  const modelContextWindow =
    typeof input.tokenUsage?.modelContextWindow === "number"
      ? input.tokenUsage.modelContextWindow
      : null;

  const sessionId = normalizeOptionalText(input.sessionId);
  const workspacePath = normalizeOptionalText(input.workspacePath);
  const sessionDiskPath = normalizeOptionalText(input.sessionDiskPath);
  const workspaceLabel = resolveWorkspaceLabel(
    input.workspaceName,
    workspacePath,
  );
  const durationMs = resolveDurationMs(input, status);
  const quota = buildSessionOverviewQuota(
    input.engine,
    input.rateLimits,
    input.usageShowRemaining,
    input.codingPlanQuota,
    input.codingPlanQuotaLoading === true,
  );

  const hasQuotaSurface =
    quota.windows.length > 0 ||
    quota.hasCredits ||
    quota.planType != null ||
    quota.loading ||
    // unsupported/error 才占位；none/empty 不占内容高度
    quota.source === "unsupported" ||
    quota.source === "error" ||
    (quota.source === "coding_plan" && quota.loading);

  const hasAnyContent =
    sessionId !== null ||
    input.engine !== null ||
    workspaceLabel !== null ||
    workspacePath !== null ||
    sessionDiskPath !== null ||
    messageCount > 0 ||
    contextUsedPercent !== null ||
    hasQuotaSurface;

  return {
    sessionId,
    engine: input.engine,
    model: input.model,
    workspaceLabel,
    workspacePath,
    sessionDiskPath,
    status,
    durationMs,
    messageCount,
    turnCount,
    contextUsedPercent,
    contextUsedTokens,
    modelContextWindow,
    quota,
    hasAnyContent,
  };
}
