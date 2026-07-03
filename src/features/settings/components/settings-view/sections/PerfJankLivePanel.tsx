// 「最近卡顿(实时)」:把性能诊断采集到的掉帧/长任务直接列在设置页里,
// 配合「清空」按钮做"清零 → 复现 → 读归因"的观察循环,不必每次导出报告。
// 仅挂载在设置页时才轮询(1s、叶子组件、读的是 clientStorage 同步缓存),
// 对全局渲染无放大效应。

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  clearRendererDiagnostics,
  exportRendererDiagnostics,
} from "@/services/rendererDiagnostics";
import { SUSPEND_GAP_MS } from "@/services/perfBaseline/frameDropMonitor";

const REFRESH_INTERVAL_MS = 1_000;
const MAX_VISIBLE_ROWS = 40;

type JankRow = {
  key: string;
  timestamp: number;
  kind: "frame-drop" | "longtask";
  durationMs: number;
  level: "warn" | "severe";
  isStreaming: boolean;
  streamActivityPhase: string | null;
  lastInteractionLabel: string | null;
  lastInteractionAgoMs: number | null;
  topRenders: Array<{ name: string; count: number }>;
};

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asTopRenders(value: unknown): Array<{ name: string; count: number }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const record = item as { name?: unknown; count?: unknown };
      const name = typeof record?.name === "string" ? record.name : null;
      const count = asFiniteNumber(record?.count) ?? 0;
      return name ? { name, count } : null;
    })
    .filter((item): item is { name: string; count: number } => item !== null);
}

function collectJankRows(): JankRow[] {
  const rows: JankRow[] = [];
  for (const entry of exportRendererDiagnostics()) {
    if (entry.label !== "perf.frame-drop" && entry.label !== "perf.longtask") {
      continue;
    }
    const payload = entry.payload ?? {};
    const durationMs =
      asFiniteNumber(payload.deltaMs) ?? asFiniteNumber(payload.durationMs) ?? 0;
    if (durationMs <= 0 || durationMs >= SUSPEND_GAP_MS) {
      // 挂起/睡眠恢复的天文数字与空值不属于"卡顿",不进列表。
      continue;
    }
    rows.push({
      key: `${entry.timestamp}-${rows.length}`,
      timestamp: entry.timestamp,
      kind: entry.label === "perf.frame-drop" ? "frame-drop" : "longtask",
      durationMs: Math.round(durationMs),
      level: payload.level === "warn" ? "warn" : "severe",
      isStreaming: payload.isStreaming === true,
      streamActivityPhase:
        typeof payload.streamActivityPhase === "string"
          ? payload.streamActivityPhase
          : null,
      lastInteractionLabel:
        typeof payload.lastInteractionLabel === "string"
          ? payload.lastInteractionLabel
          : null,
      lastInteractionAgoMs: asFiniteNumber(payload.lastInteractionAgoMs),
      topRenders: asTopRenders(payload.topRenders),
    });
  }
  rows.sort((left, right) => right.timestamp - left.timestamp);
  return rows;
}

function formatClockTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number, size = 2) => `${value}`.padStart(size, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function PerfJankLivePanel() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<JankRow[]>(() => collectJankRows());
  const [clearedMessage, setClearedMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setRows((previous) => {
      const next = collectJankRows();
      if (
        previous.length === next.length &&
        previous[0]?.key === next[0]?.key
      ) {
        return previous;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(timerId);
    };
  }, [refresh]);

  const handleClear = useCallback(() => {
    clearRendererDiagnostics();
    setRows([]);
    setClearedMessage(t("settings.perfJankLiveCleared"));
  }, [t]);

  const worstMs = useMemo(
    () => rows.reduce((worst, row) => Math.max(worst, row.durationMs), 0),
    [rows],
  );
  const visibleRows = rows.slice(0, MAX_VISIBLE_ROWS);

  return (
    <div className="settings-toggle-row" style={{ alignItems: "flex-start" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="settings-toggle-title">
          {t("settings.perfJankLiveTitle")}
        </div>
        <div className="settings-toggle-subtitle">
          {t("settings.perfJankLiveDescription")}
        </div>
        {clearedMessage && rows.length === 0 ? (
          <div className="settings-help">{clearedMessage}</div>
        ) : null}
        {rows.length === 0 ? (
          <div className="settings-help">{t("settings.perfJankLiveEmpty")}</div>
        ) : (
          <>
            <div className="settings-help">
              {t("settings.perfJankLiveSummary", {
                count: rows.length,
                worst: worstMs,
              })}
            </div>
            <ul
              aria-label={t("settings.perfJankLiveTitle")}
              className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-xs leading-5"
              style={{ listStyle: "none", margin: "8px 0 0", paddingLeft: 8 }}
            >
              {visibleRows.map((row) => (
                <li key={row.key} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-muted-foreground">
                    {formatClockTime(row.timestamp)}
                  </span>
                  <span
                    className={
                      row.level === "severe"
                        ? "font-semibold text-red-500"
                        : "font-semibold text-amber-500"
                    }
                  >
                    {row.durationMs}ms
                  </span>
                  <span className="text-muted-foreground">
                    {row.kind === "longtask"
                      ? "longtask"
                      : row.isStreaming
                        ? `streaming:${row.streamActivityPhase ?? "?"}`
                        : "idle"}
                  </span>
                  {row.lastInteractionLabel ? (
                    <span className="text-muted-foreground">
                      {row.lastInteractionLabel}@
                      {row.lastInteractionAgoMs ?? "?"}ms
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">
                    {row.topRenders.length > 0
                      ? row.topRenders
                          .slice(0, 3)
                          .map((render) => `${render.name}×${render.count}`)
                          .join(", ")
                      : t("settings.perfJankLiveNoRenders")}
                  </span>
                </li>
              ))}
            </ul>
            {rows.length > MAX_VISIBLE_ROWS ? (
              <div className="settings-help">
                {t("settings.perfJankLiveTruncated", {
                  hidden: rows.length - MAX_VISIBLE_ROWS,
                })}
              </div>
            ) : null}
          </>
        )}
      </div>
      <Button type="button" variant="outline" onClick={handleClear}>
        {t("settings.perfJankLiveClearButton")}
      </Button>
    </div>
  );
}
