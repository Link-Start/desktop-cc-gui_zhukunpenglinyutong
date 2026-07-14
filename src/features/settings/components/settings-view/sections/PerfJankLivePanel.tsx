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
  getRendererDiagnosticsRevision,
} from "@/services/rendererDiagnostics";
import { SUSPEND_GAP_MS } from "@/services/perfBaseline/frameDropMonitor";
import { recordHotspotSample } from "@/services/perfBaseline/hotspotTracker";

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
  hotspots: Array<{
    category: string;
    count: number;
    totalMs: number;
    maxMs: number;
    maxDetail: string | null;
  }>;
};

type JankSnapshot = {
  revision: number;
  rows: JankRow[];
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

function asHotspots(value: unknown): JankRow["hotspots"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const record = item as {
      category?: unknown;
      count?: unknown;
      totalMs?: unknown;
      maxMs?: unknown;
      maxDetail?: unknown;
    };
    if (typeof record?.category !== "string") {
      return [];
    }
    return [
      {
        category: record.category,
        count: asFiniteNumber(record.count) ?? 0,
        totalMs: asFiniteNumber(record.totalMs) ?? 0,
        maxMs: asFiniteNumber(record.maxMs) ?? 0,
        maxDetail:
          typeof record.maxDetail === "string" ? record.maxDetail : null,
      },
    ];
  });
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function collectJankSnapshot(): JankSnapshot {
  const startedAt = nowMs();
  const revision = getRendererDiagnosticsRevision();
  const rows: JankRow[] = [];
  for (const entry of exportRendererDiagnostics()) {
    if (entry.label !== "perf.frame-drop" && entry.label !== "perf.longtask") {
      continue;
    }
    const payload = entry.payload ?? {};
    const durationMs =
      asFiniteNumber(payload.deltaMs) ??
      asFiniteNumber(payload.durationMs) ??
      0;
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
      hotspots: asHotspots(payload.hotspots),
    });
  }
  rows.sort((left, right) => right.timestamp - left.timestamp);
  recordHotspotSample(
    "perf-jank-live-collect",
    nowMs() - startedAt,
    `rows=${rows.length}`,
  );
  return { revision, rows };
}

function formatClockTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number, size = 2) => `${value}`.padStart(size, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function PerfJankLivePanel() {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<JankSnapshot>(() =>
    collectJankSnapshot(),
  );
  const [clearedMessage, setClearedMessage] = useState<string | null>(null);
  const rows = snapshot.rows;

  const refresh = useCallback(() => {
    setSnapshot((previous) => {
      const revision = getRendererDiagnosticsRevision();
      if (revision === previous.revision) {
        return previous;
      }
      return collectJankSnapshot();
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
    setSnapshot({ revision: getRendererDiagnosticsRevision(), rows: [] });
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
              className="scrollable mt-2 max-h-72 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-xs leading-5"
              style={{ listStyle: "none", margin: "8px 0 0", paddingLeft: 8 }}
            >
              {visibleRows.map((row) => (
                <li
                  key={row.key}
                  className="flex flex-wrap items-baseline gap-x-2"
                >
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
                    {row.hotspots.length > 0
                      ? row.hotspots
                          .slice(0, 3)
                          .map(
                            (hotspot) =>
                              `${hotspot.category}=${hotspot.totalMs}ms(max ${hotspot.maxMs}${hotspot.maxDetail ? ` ${hotspot.maxDetail}` : ""})`,
                          )
                          .join(" ")
                      : row.topRenders.length > 0
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
