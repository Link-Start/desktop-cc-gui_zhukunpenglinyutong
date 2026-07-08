import { useCallback, useEffect, useRef, useState } from "react";
import type { DebugEntry } from "../../../types";
import {
  getClientStoreSync,
  writeClientStoreValue,
} from "../../../services/clientStorage";
import { appendClientErrorLog } from "../../../services/tauri";
import {
  buildClientErrorLogEntry,
  shouldPersistClientErrorLogEntry,
} from "../utils/clientErrorLog";

const MAX_DEBUG_ENTRIES = 200;
const THREAD_SESSION_LOG_KEY = "diagnostics.threadSessionLog";
const THREAD_SESSION_LOG_STORE = "diagnostics";
const LEGACY_THREAD_SESSION_LOG_STORE = "app";
export const MAX_THREAD_SESSION_LOG_ENTRIES = 400;
// 单条 payload 序列化体积上限：防止单个巨型 payload 把 diagnostics store 再次撑爆。
export const MAX_THREAD_SESSION_LOG_PAYLOAD_CHARS = 8_000;
const TRUNCATED_PAYLOAD_PREVIEW_CHARS = 2_000;

type ThreadSessionLogEntry = {
  timestamp: number;
  source: string;
  label: string;
  payload: unknown;
};

export function normalizeThreadSessionLogPayload(payload: unknown): unknown {
  if (payload == null) {
    return payload;
  }
  if (typeof payload === "string") {
    return payload.length > TRUNCATED_PAYLOAD_PREVIEW_CHARS
      ? `${payload.slice(0, TRUNCATED_PAYLOAD_PREVIEW_CHARS)}...(truncated)`
      : payload;
  }
  if (typeof payload !== "object") {
    return payload;
  }
  try {
    const serialized = JSON.stringify(payload);
    if (typeof serialized !== "string") {
      return String(payload);
    }
    if (serialized.length > MAX_THREAD_SESSION_LOG_PAYLOAD_CHARS) {
      return `${serialized.slice(0, TRUNCATED_PAYLOAD_PREVIEW_CHARS)}...(truncated ${serialized.length} chars)`;
    }
    return JSON.parse(serialized);
  } catch {
    return String(payload);
  }
}

function shouldMirrorThreadSessionLog(entry: DebugEntry): boolean {
  const label = entry.label.toLowerCase();
  return (
    label.startsWith("thread/session:") ||
    label.startsWith("thread/history") ||
    label.startsWith("thread/list") ||
    label.startsWith("workspace/reconnect") ||
    label.startsWith("reasoning/raw:") ||
    label === "item/started" ||
    label === "item/updated" ||
    label === "item/completed"
  );
}

/** 高频/巨型 payload 的 label 黑名单：新增条目拒绝，startup maintenance 用同一判定清理存量。 */
export function isBlockedThreadSessionLogLabel(label: string): boolean {
  const normalized = label.toLowerCase();
  return (
    normalized === "thread/session:turn-diagnostic:codex-no-progress-watchdog-scheduled" ||
    normalized === "thread/list response" ||
    normalized === "thread/list older response"
  );
}

function shouldPersistThreadSessionLogEntry(entry: DebugEntry): boolean {
  if (isBlockedThreadSessionLogLabel(entry.label)) {
    return false;
  }
  return shouldMirrorThreadSessionLog(entry);
}

function appendDebugEntryToList(
  prev: DebugEntry[],
  entry: DebugEntry,
  nextCounter: () => number,
): DebugEntry[] {
  const trimmedId = entry.id.trim();
  const baseId =
    trimmedId.length > 0
      ? trimmedId
      : `debug-${entry.timestamp}-${nextCounter()}`;

  let resolvedId = baseId;
  while (prev.some((existing) => existing.id === resolvedId)) {
    resolvedId = `${baseId}-${nextCounter()}`;
  }

  const nextEntry =
    resolvedId === entry.id ? entry : { ...entry, id: resolvedId };

  return [...prev, nextEntry].slice(-MAX_DEBUG_ENTRIES);
}

export function useDebugLog() {
  const [debugOpen, setDebugOpenState] = useState(false);
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const [hasDebugAlerts, setHasDebugAlerts] = useState(false);
  const [debugPinned, setDebugPinned] = useState(false);
  const debugEntryIdCounterRef = useRef(0);
  const threadSessionLogCacheRef = useRef<ThreadSessionLogEntry[] | null>(null);
  // 面板关闭期间日志只进内存缓冲，不写 React state。本 hook 挂在 AppShell 根，
  // setDebugEntries 是数组追加型 setState（必换引用、无法做 same-value 守卫），
  // 对话/Agent 期间每条引擎日志都会触发一次 100ms+ 的根渲染。打开面板时缓冲
  // 一次性灌入；磁盘侧 threadSessionLog / clientErrorLog 不受影响，始终完整。
  const debugOpenRef = useRef(false);
  const pendingDebugEntriesRef = useRef<DebugEntry[]>([]);
  const nextDebugEntryCounter = useCallback(
    () => debugEntryIdCounterRef.current++,
    [],
  );

  const flushPendingDebugEntries = useCallback(() => {
    const pending = pendingDebugEntriesRef.current;
    if (pending.length === 0) {
      return;
    }
    pendingDebugEntriesRef.current = [];
    setDebugEntries((prev) => {
      let next = prev;
      for (const entry of pending) {
        next = appendDebugEntryToList(next, entry, nextDebugEntryCounter);
      }
      return next;
    });
  }, [nextDebugEntryCounter]);

  useEffect(() => {
    debugOpenRef.current = debugOpen;
    if (debugOpen) {
      flushPendingDebugEntries();
    }
  }, [debugOpen, flushPendingDebugEntries]);

  const shouldLogEntry = useCallback((entry: DebugEntry) => {
    if (entry.source === "error" || entry.source === "stderr") {
      return true;
    }
    const label = entry.label.toLowerCase();
    if (label.startsWith("thread/title")) {
      return true;
    }
    if (label.startsWith("thread/session:")) {
      return true;
    }
    if (label.startsWith("reasoning/raw:")) {
      return true;
    }
    if (label.includes("turn/start")) {
      return true;
    }
    if (label.includes("warn") || label.includes("warning")) {
      return true;
    }
    if (typeof entry.payload === "string") {
      const payload = entry.payload.toLowerCase();
      return payload.includes("warn") || payload.includes("warning");
    }
    return false;
  }, []);

  const addDebugEntry = useCallback(
    (entry: DebugEntry) => {
      if (shouldPersistThreadSessionLogEntry(entry)) {
        const cachedLogs =
          threadSessionLogCacheRef.current ??
          (getClientStoreSync<ThreadSessionLogEntry[]>(
            THREAD_SESSION_LOG_STORE,
            THREAD_SESSION_LOG_KEY,
          ) ??
            getClientStoreSync<ThreadSessionLogEntry[]>(
              LEGACY_THREAD_SESSION_LOG_STORE,
              THREAD_SESSION_LOG_KEY,
            ) ??
            []);
        const nextEntry: ThreadSessionLogEntry = {
          timestamp: entry.timestamp,
          source: entry.source,
          label: entry.label,
          payload: normalizeThreadSessionLogPayload(entry.payload),
        };
        const nextLogs = [...cachedLogs, nextEntry].slice(
          -MAX_THREAD_SESSION_LOG_ENTRIES,
        );
        threadSessionLogCacheRef.current = nextLogs;
        writeClientStoreValue(THREAD_SESSION_LOG_STORE, THREAD_SESSION_LOG_KEY, nextLogs);
      }

      if (shouldPersistClientErrorLogEntry(entry)) {
        void appendClientErrorLog(buildClientErrorLogEntry(entry)).catch(() => {
          // 错误日志本身是 best-effort 通道，失败不能递归制造新的 DebugEntry。
        });
      }

      if (!shouldLogEntry(entry)) {
        return;
      }
      // setHasDebugAlerts(true) 在已为 true 时会被 React same-value bailout，
      // 最多只引发一次根渲染，保留它以维持「有告警」红点提示。
      setHasDebugAlerts(true);
      if (!debugOpenRef.current) {
        const pending = pendingDebugEntriesRef.current;
        pending.push(entry);
        if (pending.length > MAX_DEBUG_ENTRIES) {
          pending.splice(0, pending.length - MAX_DEBUG_ENTRIES);
        }
        return;
      }
      setDebugEntries((prev) =>
        appendDebugEntryToList(prev, entry, nextDebugEntryCounter),
      );
    },
    [nextDebugEntryCounter, shouldLogEntry],
  );

  const handleCopyDebug = useCallback(async () => {
    const text = debugEntries
      .map((entry) => {
        const timestamp = new Date(entry.timestamp).toLocaleTimeString();
        const payload =
          entry.payload !== undefined
            ? typeof entry.payload === "string"
              ? entry.payload
              : JSON.stringify(entry.payload, null, 2)
            : "";
        return [entry.source.toUpperCase(), timestamp, entry.label, payload]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");
    if (text) {
      await navigator.clipboard.writeText(text);
    }
  }, [debugEntries]);

  const clearDebugEntries = useCallback(() => {
    pendingDebugEntriesRef.current = [];
    setDebugEntries([]);
    setHasDebugAlerts(false);
  }, []);

  const setDebugOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setDebugOpenState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (resolved) {
          setDebugPinned(true);
        }
        return resolved;
      });
    },
    [],
  );

  const showDebugButton = debugOpen || debugPinned;

  return {
    debugOpen,
    setDebugOpen,
    debugEntries,
    hasDebugAlerts,
    showDebugButton,
    addDebugEntry,
    handleCopyDebug,
    clearDebugEntries,
  };
}
