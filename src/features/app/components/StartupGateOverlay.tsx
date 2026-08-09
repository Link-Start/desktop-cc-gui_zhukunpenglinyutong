import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStartupTraceSnapshot } from "../../startup-orchestration/hooks/useStartupTrace";
import {
  getStartupTraceSnapshot,
  subscribeStartupTrace,
  type StartupTraceEvent,
} from "../../startup-orchestration/utils/startupTrace";
import {
  getGlobalRuntimeNoticesSnapshot,
  subscribeGlobalRuntimeNotices,
  type GlobalRuntimeNotice,
} from "../../../services/globalRuntimeNotices";
import { startupOrchestrator } from "../../startup-orchestration/utils/startupOrchestrator";
import { markStartupForceEnter } from "../../startup-orchestration/utils/startupForceEnter";
import { getFullCatalogAutoRetryBlockedSnapshot } from "../../startup-orchestration/utils/fullCatalogAutoRetry";
import { getStartupGateReadyReason } from "../../startup-orchestration/utils/startupGateReady";
import { isStartupGatePlatform } from "../../../utils/platform";
import { loadSidebarSnapshot } from "../../threads/utils/sidebarSnapshot";
import type { WorkspaceInfo } from "../../../types";
import { StartupDiagnosticsTimeline } from "./StartupDiagnosticsTimeline";

/**
 * Force-enter / max-visible unmask:
 * soft-cancel startup scans so late setThreads no-ops when the user clicks in.
 * Do NOT stamp startup-gate-ready here — that would immediately apply any
 * uiScale ≠ 1 (0.8 / 0.9 / 1.1 / 1.2 / …) into the same click window.
 * uiScale phase-2 waits for gate-ready, force-enter+delay, or 12s ceiling.
 */
function forceEnterApp(setOpen: (open: boolean) => void) {
  // Pending idle full-catalog re-schedules (post first-paint).
  markStartupForceEnter();
  // Must use "stale": thread-list fallback maps stale/cancelled → discard apply.
  startupOrchestrator.cancelAllTasks("stale");
  setOpen(false);
}

/** After this delay, show the force-dismiss control. */
export const STARTUP_GATE_FORCE_DISMISS_MS = 10_000;

/**
 * Auto-unmask only after this much wall time AND a late-enough ready signal.
 * first-paint / early input-ready alone must NOT unmask.
 */
export const STARTUP_GATE_MIN_VISIBLE_MS = 8_000;

/** Absolute ceiling: auto-unmask even without milestone. */
export const STARTUP_GATE_MAX_VISIBLE_MS = 20_000;

/** @deprecated Prefer STARTUP_GATE_FORCE_DISMISS_MS */
export const WINDOWS_STARTUP_GATE_FORCE_DISMISS_MS = STARTUP_GATE_FORCE_DISMISS_MS;
/** @deprecated Prefer STARTUP_GATE_MIN_VISIBLE_MS */
export const WINDOWS_STARTUP_GATE_MIN_VISIBLE_MS = STARTUP_GATE_MIN_VISIBLE_MS;
/** @deprecated Prefer STARTUP_GATE_MAX_VISIBLE_MS */
export const WINDOWS_STARTUP_GATE_MAX_VISIBLE_MS = STARTUP_GATE_MAX_VISIBLE_MS;

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Ready for auto-unmask (must still wait MIN_VISIBLE_MS).
 * - `startup-gate-ready`: first-paint / gate ready (preferred)
 * - home-only: `input-ready` without ever starting active workspace list
 */
function isLateEnoughReady(): boolean {
  const milestones = getStartupTraceSnapshot().milestones;
  if (milestones["startup-gate-ready"]) {
    return true;
  }
  if (
    milestones["input-ready"] &&
    !milestones["active-workspace-ready"]
  ) {
    return true;
  }
  return false;
}

/**
 * 自动关闭策略对照入口（便于单测/诊断引用阈值）。
 */
export const __startupGateAutoCloseRestore = {
  isLateEnoughReady,
  minVisibleMs: STARTUP_GATE_MIN_VISIBLE_MS,
  maxVisibleMs: STARTUP_GATE_MAX_VISIBLE_MS,
  forceDismissMs: STARTUP_GATE_FORCE_DISMISS_MS,
} as const;

function formatElapsedMs(elapsedMs: number): string {
  const seconds = elapsedMs / 1000;
  return `${seconds.toFixed(1)}s`;
}

/**
 * 一键复制诊断包：把分析冷启卡死需要的字段打成纯文本。
 * 导出供单测校验格式，勿删。
 */
export function buildStartupGateDiagnosticDump(input: {
  elapsedMs: number;
  events: readonly StartupTraceEvent[];
  milestones: Partial<Record<string, unknown>>;
  notices: readonly GlobalRuntimeNotice[];
  resolveNoticeLabel?: (
    notice: GlobalRuntimeNotice,
  ) => string;
  gateReadyReason?: string | null;
  fullCatalogAutoRetryBlocked?: readonly string[];
}): string {
  const lines: string[] = [];
  const elapsedSec = (input.elapsedMs / 1000).toFixed(1);
  const milestoneNames = Object.keys(input.milestones).sort().join(", ") || "—";

  // 命令耗时排行（IPC 侧）
  const commandCosts = input.events
    .filter(
      (event): event is Extract<StartupTraceEvent, { type: "command" }> =>
        event.type === "command",
    )
    .map((event) => ({
      label: event.commandLabel,
      status: event.status,
      durationMs: event.durationMs,
      workspace:
        event.workspaceScope === "global"
          ? "global"
          : event.workspaceScope.workspaceId,
    }))
    .sort((a, b) => b.durationMs - a.durationMs);

  // task 最终态 + 有 duration 的 completed 排行
  const latestTaskById = new Map<
    string,
    Extract<StartupTraceEvent, { type: "task" }>
  >();
  for (const event of input.events) {
    if (event.type === "task") {
      latestTaskById.set(event.taskId, event);
    }
  }
  const taskFinal = Array.from(latestTaskById.values());
  const taskCostRank = taskFinal
    .filter((task) => typeof task.durationMs === "number")
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0));

  const firstPaintPresent = taskFinal.some(
    (task) =>
      task.taskId.includes("thread-list:first-paint:") ||
      task.traceLabel.includes("first-paint"),
  );
  const gateReadyReason =
    input.gateReadyReason !== undefined
      ? input.gateReadyReason
      : (getStartupGateReadyReason() ?? null);
  const fullCatalogBlocked =
    input.fullCatalogAutoRetryBlocked !== undefined
      ? input.fullCatalogAutoRetryBlocked
      : getFullCatalogAutoRetryBlockedSnapshot();

  lines.push("=== mossx cold-start diagnostic dump ===");
  lines.push(`capturedAt: ${new Date().toISOString()}`);
  lines.push(`elapsedMs: ${Math.round(input.elapsedMs)} (${elapsedSec}s)`);
  lines.push(`events: ${input.events.length}`);
  lines.push(`uniqueTasks: ${latestTaskById.size}`);
  lines.push(`notices: ${input.notices.length}`);
  lines.push(`milestones: ${milestoneNames}`);
  lines.push(`firstPaintPresent: ${firstPaintPresent}`);
  lines.push(`gateReadyReason: ${gateReadyReason ?? "null"}`);
  lines.push(
    `fullCatalogAutoRetryBlocked: ${
      fullCatalogBlocked.length > 0 ? fullCatalogBlocked.join(" | ") : "—"
    }`,
  );
  lines.push(
    `taskLifecycle: run=${taskFinal.filter((t) => t.lifecycleState === "started" || t.lifecycleState === "queued").length} ok=${taskFinal.filter((t) => t.lifecycleState === "completed").length} fail=${taskFinal.filter((t) => t.lifecycleState === "failed" || t.lifecycleState === "timed-out").length}`,
  );
  lines.push("");
  lines.push("--- command cost rank (IPC, desc) ---");
  if (commandCosts.length === 0) {
    lines.push("(none)");
  } else {
    for (const row of commandCosts) {
      lines.push(
        `${Math.round(row.durationMs)}ms\t${row.status}\t${row.label}\tws=${row.workspace}`,
      );
    }
  }
  lines.push("");
  lines.push("--- task cost rank (final state with durationMs, desc) ---");
  if (taskCostRank.length === 0) {
    lines.push("(none)");
  } else {
    for (const task of taskCostRank) {
      const ws =
        task.workspaceScope === "global"
          ? "global"
          : task.workspaceScope.workspaceId;
      lines.push(
        `${Math.round(task.durationMs ?? 0)}ms\t${task.lifecycleState}\t${task.traceLabel}\tid=${task.taskId}\tphase=${task.phase}\tws=${ws}${task.commandLabel ? `\tcmd=${task.commandLabel}` : ""}${task.fallbackReason ? `\tfallback=${task.fallbackReason}` : ""}`,
      );
    }
  }
  lines.push("");
  lines.push("--- task final snapshot (all unique taskIds) ---");
  for (const task of taskFinal) {
    const ws =
      task.workspaceScope === "global"
        ? "global"
        : task.workspaceScope.workspaceId;
    lines.push(
      `${task.lifecycleState}\t${task.traceLabel}\tid=${task.taskId}\tphase=${task.phase}\tdurationMs=${task.durationMs ?? "null"}\tws=${ws}${task.commandLabel ? `\tcmd=${task.commandLabel}` : ""}`,
    );
  }
  lines.push("");
  lines.push("--- full startupTrace events (chronological) ---");
  for (const event of input.events) {
    if (event.type === "task") {
      const ws =
        event.workspaceScope === "global"
          ? "global"
          : event.workspaceScope.workspaceId;
      lines.push(
        `#${event.sequence}\ttask\t${event.lifecycleState}\t${event.traceLabel}\tid=${event.taskId}\tphase=${event.phase}\tdurationMs=${event.durationMs ?? "null"}\tws=${ws}\tts=${event.timestamp.toFixed(1)}${event.commandLabel ? `\tcmd=${event.commandLabel}` : ""}${event.fallbackReason ? `\tfallback=${event.fallbackReason}` : ""}${event.cancellationMode ? `\tcancel=${event.cancellationMode}` : ""}`,
      );
      continue;
    }
    if (event.type === "milestone") {
      lines.push(
        `#${event.sequence}\tmilestone\t${event.milestone}\ttasksSoFar=${event.taskSequences.length}\tts=${event.timestamp.toFixed(1)}`,
      );
      continue;
    }
    const ws =
      event.workspaceScope === "global"
        ? "global"
        : event.workspaceScope.workspaceId;
    lines.push(
      `#${event.sequence}\tcommand\t${event.status}\t${event.commandLabel}\tdurationMs=${Math.round(event.durationMs)}\tws=${ws}\tts=${event.timestamp.toFixed(1)}`,
    );
  }
  lines.push("");
  lines.push("--- runtimeNotice (resolved text + key) ---");
  for (const notice of input.notices) {
    const label =
      input.resolveNoticeLabel?.(notice) ?? notice.messageKey;
    const params = notice.messageParams
      ? ` params=${JSON.stringify(notice.messageParams)}`
      : "";
    lines.push(
      `${notice.severity}\t${notice.category}\t${label}\tkey=${notice.messageKey}\trepeat=${notice.repeatCount}\tts=${notice.timestampMs}${params}`,
    );
  }
  lines.push("");
  lines.push("=== end dump ===");
  return lines.join("\n");
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to execCommand path
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function useRuntimeNoticesSnapshot(): readonly GlobalRuntimeNotice[] {
  const [notices, setNotices] = useState<readonly GlobalRuntimeNotice[]>(() =>
    getGlobalRuntimeNoticesSnapshot(),
  );

  useEffect(() => {
    return subscribeGlobalRuntimeNotices((snapshot) => {
      setNotices(snapshot);
    });
  }, []);

  return notices;
}

function loadStartupTimelineWorkspaces(): readonly WorkspaceInfo[] {
  try {
    return loadSidebarSnapshot()?.workspaces ?? [];
  } catch (error) {
    console.warn("[startupGate] sidebar workspace snapshot unavailable", error);
    return [];
  }
}

/**
 * Desktop (Tauri: Windows / macOS / Linux) full-window mask during cold start so
 * users cannot click into the busy hydrate window.
 *
 * Close rules:
 * - Auto: late ready (`startup-gate-ready` / home input) AND min 8s visible
 * - Auto ceiling: 20s (+ force-enter cancel)
 * - Force: button after 10s (+ force-enter cancel)
 * - Overlay still lists startupTrace + runtimeNotice for diagnostics
 */
export function StartupGateOverlay() {
  const { t } = useTranslation();
  const [enabled] = useState(() => isStartupGatePlatform());
  const mountedAtRef = useRef(nowMs());
  const [open, setOpen] = useState(() => enabled);
  const [showForceDismiss, setShowForceDismiss] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  /** 诊断时间轴默认折叠，避免冷启遮罩占满屏；需要时再展开。 */
  const [modulePanelExpanded, setModulePanelExpanded] = useState(false);
  const [timelineWorkspaces] = useState(loadStartupTimelineWorkspaces);

  const traceSnapshot = useStartupTraceSnapshot();
  const runtimeNotices = useRuntimeNoticesSnapshot();

  const diagnosticDump = useMemo(
    () =>
      buildStartupGateDiagnosticDump({
        elapsedMs,
        events: traceSnapshot.events,
        milestones: traceSnapshot.milestones,
        notices: runtimeNotices,
        gateReadyReason: getStartupGateReadyReason(),
        fullCatalogAutoRetryBlocked: getFullCatalogAutoRetryBlockedSnapshot(),
        resolveNoticeLabel: (notice) => {
          try {
            return t(
              notice.messageKey,
              notice.messageParams as Record<string, unknown> | undefined,
            );
          } catch {
            return notice.messageKey;
          }
        },
      }),
    [
      elapsedMs,
      traceSnapshot.events,
      traceSnapshot.milestones,
      runtimeNotices,
      t,
    ],
  );

  const handleCopyDiagnostic = async () => {
    const ok = await copyTextToClipboard(diagnosticDump);
    setCopyState(ok ? "ok" : "fail");
    window.setTimeout(() => {
      setCopyState("idle");
    }, 2_000);
  };

  // 顶部摘要继续基于 raw facts，避免被时间轴聚合后的节点数误导。
  const taskStats = useMemo(() => {
    const latestByTaskId = new Map<string, Extract<StartupTraceEvent, { type: "task" }>>();
    for (const event of traceSnapshot.events) {
      if (event.type === "task") {
        latestByTaskId.set(event.taskId, event);
      }
    }
    let running = 0;
    let completed = 0;
    let failed = 0;
    let other = 0;
    for (const task of latestByTaskId.values()) {
      if (task.lifecycleState === "started" || task.lifecycleState === "queued") {
        running += 1;
      } else if (task.lifecycleState === "completed") {
        completed += 1;
      } else if (
        task.lifecycleState === "failed" ||
        task.lifecycleState === "timed-out"
      ) {
        failed += 1;
      } else {
        other += 1;
      }
    }
    return {
      uniqueTasks: latestByTaskId.size,
      events: traceSnapshot.events.length,
      notices: runtimeNotices.length,
      running,
      completed,
      failed,
      other,
      milestones: Object.keys(traceSnapshot.milestones).join(", ") || "—",
    };
  }, [traceSnapshot.events, traceSnapshot.milestones, runtimeNotices.length]);

  useEffect(() => {
    if (!enabled || !open) {
      return;
    }

    const tryAutoClose = () => {
      const elapsed = nowMs() - mountedAtRef.current;
      if (elapsed >= STARTUP_GATE_MAX_VISIBLE_MS) {
        forceEnterApp(setOpen);
        return;
      }
      if (isLateEnoughReady() && elapsed >= STARTUP_GATE_MIN_VISIBLE_MS) {
        setOpen(false);
      }
    };

    tryAutoClose();
    const unsub = subscribeStartupTrace(tryAutoClose);
    const tickTimer = window.setInterval(tryAutoClose, 250);

    const forceTimer = window.setTimeout(() => {
      setShowForceDismiss(true);
    }, STARTUP_GATE_FORCE_DISMISS_MS);

    const elapsedTimer = window.setInterval(() => {
      setElapsedMs(nowMs() - mountedAtRef.current);
    }, 100);

    return () => {
      unsub();
      window.clearTimeout(forceTimer);
      window.clearInterval(tickTimer);
      window.clearInterval(elapsedTimer);
    };
  }, [enabled, open]);

  if (!enabled || !open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[2147483000] flex flex-col items-center justify-center gap-3 bg-[color-mix(in_srgb,var(--surface-messages,#0d0f14)_92%,transparent)] px-4 text-foreground backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={t("runtimeNotice.startupGate.title")}
      data-testid="startup-gate-overlay"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        className="size-9 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        aria-hidden
      />
      <p className="max-w-lg shrink-0 px-2 text-center text-sm text-muted-foreground">
        {t("runtimeNotice.startupGate.message")}
      </p>
      <p
        className="shrink-0 font-mono text-[11px] text-muted-foreground/80"
        data-testid="startup-gate-elapsed"
      >
        elapsed {formatElapsedMs(elapsedMs)} · events {taskStats.events} · tasks{" "}
        {taskStats.uniqueTasks} · notices {taskStats.notices} · run{" "}
        {taskStats.running} · ok {taskStats.completed} · fail {taskStats.failed}
        {taskStats.other ? ` · other ${taskStats.other}` : ""}
      </p>
      <p className="max-w-3xl shrink-0 truncate px-2 font-mono text-[10px] text-muted-foreground/60">
        milestones: {taskStats.milestones}
      </p>

      {/* 冷启诊断清单：默认折叠，点标题展开 */}
      <div
        className="flex w-full max-w-3xl shrink flex-col gap-2"
        data-testid="startup-gate-module-panel"
      >
        <button
          type="button"
          className="mx-auto flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-3 py-1.5 font-mono text-[11px] text-muted-foreground shadow-sm hover:bg-background hover:text-foreground"
          data-testid="startup-gate-module-panel-toggle"
          aria-expanded={modulePanelExpanded}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setModulePanelExpanded((prev) => !prev);
          }}
        >
          <span aria-hidden>{modulePanelExpanded ? "▼" : "▶"}</span>
          <span>
            {modulePanelExpanded ? "收起加载日志" : "展开加载日志"} · trace{" "}
            {traceSnapshot.events.length} · notices {runtimeNotices.length}
          </span>
        </button>

        {modulePanelExpanded ? (
          <>
            <div className="flex max-h-[min(52vh,520px)] min-h-0 w-full shrink overflow-hidden">
              <StartupDiagnosticsTimeline
                events={traceSnapshot.events}
                notices={runtimeNotices}
                workspaces={timelineWorkspaces}
              />
            </div>

            <div className="flex shrink-0 justify-center">
              <button
                type="button"
                className={
                  copyState === "ok"
                    ? "rounded-md border border-border bg-background/80 px-4 py-2 text-sm text-emerald-700 shadow-sm hover:bg-background dark:text-emerald-400"
                    : copyState === "fail"
                      ? "rounded-md border border-border bg-background/80 px-4 py-2 text-sm text-rose-700 shadow-sm hover:bg-background dark:text-rose-400"
                      : "rounded-md border border-border bg-background/80 px-4 py-2 text-sm text-foreground shadow-sm hover:bg-background"
                }
                data-testid="startup-gate-copy-diagnostic"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleCopyDiagnostic();
                }}
              >
                {copyState === "ok"
                  ? "已复制 ✓ 直接粘贴发给我"
                  : copyState === "fail"
                    ? "复制失败，请重试"
                    : "一键复制诊断包"}
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-1 flex shrink-0 flex-wrap items-center justify-center gap-2">
        {showForceDismiss ? (
          <button
            type="button"
            className="rounded-md border border-border bg-background/80 px-4 py-2 text-sm text-foreground shadow-sm hover:bg-background"
            data-testid="startup-gate-force-dismiss"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              forceEnterApp(setOpen);
            }}
          >
            {t("runtimeNotice.startupGate.forceDismiss")}
          </button>
        ) : (
          <span className="font-mono text-[10px] text-muted-foreground/50">
            force-enter in{" "}
            {Math.max(
              0,
              Math.ceil((STARTUP_GATE_FORCE_DISMISS_MS - elapsedMs) / 1000),
            )}
            s
          </span>
        )}
      </div>
    </div>
  );
}

/** @deprecated Prefer StartupGateOverlay */
export const WindowsStartupGateOverlay = StartupGateOverlay;
