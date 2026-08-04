import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ConversationItem, EngineType } from "../../../types";
import { Messages } from "../../messages";
import {
  EMPTY_ACTIVE_CANVAS_ITEMS,
  useActiveCanvasSelector,
} from "../../layout/hooks/activeCanvasStore";
import { createThreadHistoryLoaderForThread } from "../../threads/hooks/useThreadActions.historyLoaderFactory";
import { useSubagentInspectorSelection } from "../hooks/useSubagentInspectorStore";
import { publishSubagentSessionProbe } from "../hooks/useSubagentSessionProbeStore";
import {
  buildTranscriptItemsFromSubagentFallback,
  isOpaqueCiphertextOutput,
  isSyntheticSubagentMetaOutput,
} from "../utils/subagentDetailTranscript";
import { isClaudeAsyncAgentLaunchOutput } from "../utils/subagentViewModel";

type SubagentSessionCanvasProps = {
  sessionThreadId: string;
  workspaceId?: string | null;
  workspacePath?: string | null;
};

function inferEngine(threadId: string): EngineType {
  if (threadId.startsWith("claude:")) return "claude";
  if (threadId.startsWith("grok:")) return "grok";
  if (threadId.startsWith("kimi:")) return "kimi";
  if (threadId.startsWith("gemini:")) return "gemini";
  if (threadId.startsWith("opencode:")) return "opencode";
  if (threadId.startsWith("shared:")) return "codex";
  return "codex";
}

function candidateThreadIds(sessionThreadId: string): string[] {
  const id = sessionThreadId.trim();
  if (!id) {
    return [];
  }
  const out = [id];
  // 误加 grok: 前缀的 Codex UUID → 再试裸 id
  if (id.startsWith("grok:")) {
    const bare = id.slice("grok:".length);
    if (/^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(bare)) {
      out.push(bare);
    }
  }
  return out;
}

/**
 * 在右侧抽屉内复用全局 Messages 幕布，渲染子代理 session 历史。
 * 跨引擎：Claude / Codex / Grok / Kimi / Shared 均走 createThreadHistoryLoaderForThread。
 */
export const SubagentSessionCanvas = memo(function SubagentSessionCanvas({
  sessionThreadId,
  workspaceId = null,
  workspacePath = null,
}: SubagentSessionCanvasProps) {
  const { t } = useTranslation();
  const selection = useSubagentInspectorSelection();
  const threadItemsByThread = useActiveCanvasSelector(
    (snapshot) => snapshot.threadItemsByThread,
  );
  const canvasWorkspacePath = useActiveCanvasSelector((s) => s.workspacePath);
  const canvasWorkspaceId = useActiveCanvasSelector((s) => s.workspaceId);

  const resolvedWorkspaceId = workspaceId ?? canvasWorkspaceId;
  const resolvedWorkspacePath = workspacePath ?? canvasWorkspacePath;
  const loadCandidates = useMemo(
    () => candidateThreadIds(sessionThreadId),
    [sessionThreadId],
  );

  const cachedItems = useMemo(() => {
    for (const id of loadCandidates) {
      const items = threadItemsByThread[id];
      if (items && items.length > 0) {
        return items;
      }
    }
    return null;
  }, [loadCandidates, threadItemsByThread]);

  const [loadedItems, setLoadedItems] = useState<ConversationItem[] | null>(null);
  const [resolvedLoadId, setResolvedLoadId] = useState(sessionThreadId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setResolvedLoadId(sessionThreadId);

    if (cachedItems && cachedItems.length > 0) {
      setLoadedItems(cachedItems);
      setLoading(false);
      // canvas 已有缓存也发布 probe，驱动小队卡 status 与 inspector 同步
      for (const id of loadCandidates) {
        const items = threadItemsByThread[id];
        if (items && items.length > 0) {
          publishSubagentSessionProbe(id, items);
          break;
        }
      }
      return () => {
        cancelled = true;
      };
    }

    if (!resolvedWorkspaceId || loadCandidates.length === 0) {
      setLoadedItems(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

    void (async () => {
      let lastError: string | null = null;
      for (const candidateId of loadCandidates) {
        try {
          const loader = createThreadHistoryLoaderForThread({
            targetThreadId: candidateId,
            workspaceId: resolvedWorkspaceId,
            workspacePath: resolvedWorkspacePath ?? null,
            preferLocalCodexHistory: true,
          });
          const snapshot = await loader.load(candidateId);
          if (cancelled) {
            return;
          }
          const nextItems = snapshot.items ?? [];
          if (nextItems.length > 0) {
            setResolvedLoadId(candidateId);
            setLoadedItems(nextItems);
            setLoading(false);
            // 旁路历史加载回写 probe，让列表 status 不必依赖「侧栏打开 session」
            publishSubagentSessionProbe(candidateId, nextItems);
            return;
          }
          // 空 transcript：继续试下一个 candidate
          setResolvedLoadId(candidateId);
          setLoadedItems([]);
        } catch (error: unknown) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      if (cancelled) {
        return;
      }
      if (lastError) {
        setLoadError(lastError);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    cachedItems,
    loadCandidates,
    resolvedWorkspaceId,
    resolvedWorkspacePath,
    sessionThreadId,
    threadItemsByThread,
  ]);

  const items = useMemo(
    () => loadedItems ?? cachedItems ?? EMPTY_ACTIVE_CANVAS_ITEMS,
    [cachedItems, loadedItems],
  );

  const rawFallbackCandidate =
    selection?.outputText?.trim() ||
    selection?.taskOutput?.recentOutput?.trim() ||
    "";
  // 密文 message / Claude launch 不当作可读回退
  const rawFallback =
    isOpaqueCiphertextOutput(rawFallbackCandidate) ||
    isClaudeAsyncAgentLaunchOutput(rawFallbackCandidate)
      ? ""
      : rawFallbackCandidate;
  const isClaudeLaunchMeta = isClaudeAsyncAgentLaunchOutput(rawFallbackCandidate);

  // 合成 meta：抽成 user/assistant；纯密文：仅用 description（任务名/昵称）
  const fallbackTranscriptItems = useMemo(() => {
    if (items.length > 0) {
      return EMPTY_ACTIVE_CANVAS_ITEMS;
    }
    const desc = selection?.description?.trim() || "";
    const readableDesc = isOpaqueCiphertextOutput(desc) ? "" : desc;
    if (isClaudeLaunchMeta) {
      return readableDesc
        ? buildTranscriptItemsFromSubagentFallback({
            cardId: selection?.id ?? sessionThreadId,
            description: readableDesc,
            outputText: "",
          })
        : EMPTY_ACTIVE_CANVAS_ITEMS;
    }
    if (!rawFallback && !readableDesc) {
      return EMPTY_ACTIVE_CANVAS_ITEMS;
    }
    if (isSyntheticSubagentMetaOutput(rawFallback) || rawFallback) {
      return buildTranscriptItemsFromSubagentFallback({
        cardId: selection?.id ?? sessionThreadId,
        description: readableDesc,
        outputText: rawFallback,
      });
    }
    if (readableDesc) {
      return buildTranscriptItemsFromSubagentFallback({
        cardId: selection?.id ?? sessionThreadId,
        description: readableDesc,
        outputText: "",
      });
    }
    return EMPTY_ACTIVE_CANVAS_ITEMS;
  }, [
    isClaudeLaunchMeta,
    items.length,
    rawFallback,
    selection?.description,
    selection?.id,
    sessionThreadId,
  ]);

  const activeEngine = inferEngine(resolvedLoadId);
  const displayItems =
    items.length > 0 ? items : fallbackTranscriptItems.length > 0 ? fallbackTranscriptItems : items;

  if (loading && displayItems.length === 0) {
    return (
      <div className="subagent-session-canvas-status">
        {t("subagentUi.loadingSession", { defaultValue: "正在加载子代理会话…" })}
      </div>
    );
  }

  if (loadError && displayItems.length === 0) {
    return (
      <div className="subagent-session-canvas-status is-error">
        {t("subagentUi.sessionLoadFailed", {
          defaultValue: "子代理会话加载失败",
        })}
        <span className="subagent-session-canvas-error-detail">{loadError}</span>
      </div>
    );
  }

  if (displayItems.length === 0) {
    return (
      <div className="subagent-session-canvas-status">
        {isClaudeLaunchMeta
          ? t("subagentUi.claudeLaunchNoSession", {
              defaultValue:
                "已识别 Claude Agent 启动回执，但子会话 transcript 尚未加载。请稍后重试或从左侧打开对应子代理会话。",
            })
          : t("subagentUi.emptySession", {
              defaultValue: "子代理会话暂无消息（可能仍在索引）",
            })}
      </div>
    );
  }

  // 嵌套 Messages 仅渲染子会话 transcript（与 Grok 详情一致：user/assistant 气泡）
  return (
    <div className="subagent-session-canvas" data-subagent-session-canvas="1">
      <Messages
        items={displayItems}
        threadId={resolvedLoadId}
        workspaceId={resolvedWorkspaceId}
        workspacePath={resolvedWorkspacePath}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        activeEngine={activeEngine}
        conversationState={null}
      />
    </div>
  );
});
