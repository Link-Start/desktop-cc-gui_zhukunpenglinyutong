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
  const cachedItems = useActiveCanvasSelector(
    (snapshot) => snapshot.threadItemsByThread[sessionThreadId] ?? null,
  );
  const canvasWorkspacePath = useActiveCanvasSelector((s) => s.workspacePath);
  const canvasWorkspaceId = useActiveCanvasSelector((s) => s.workspaceId);

  const resolvedWorkspaceId = workspaceId ?? canvasWorkspaceId;
  const resolvedWorkspacePath = workspacePath ?? canvasWorkspacePath;
  const activeEngine = inferEngine(sessionThreadId);

  const [loadedItems, setLoadedItems] = useState<ConversationItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);

    if (cachedItems && cachedItems.length > 0) {
      setLoadedItems(cachedItems);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!resolvedWorkspaceId || !sessionThreadId.trim()) {
      setLoadedItems(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    const loader = createThreadHistoryLoaderForThread({
      targetThreadId: sessionThreadId,
      workspaceId: resolvedWorkspaceId,
      workspacePath: resolvedWorkspacePath ?? null,
      preferLocalCodexHistory: true,
    });

    void loader
      .load(sessionThreadId)
      .then((snapshot) => {
        if (cancelled) {
          return;
        }
        setLoadedItems(snapshot.items ?? []);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : String(error));
        setLoadedItems(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cachedItems, resolvedWorkspaceId, resolvedWorkspacePath, sessionThreadId]);

  const items = useMemo(
    () => loadedItems ?? cachedItems ?? EMPTY_ACTIVE_CANVAS_ITEMS,
    [cachedItems, loadedItems],
  );

  const fallbackOutput =
    selection?.outputText?.trim() ||
    selection?.taskOutput?.recentOutput?.trim() ||
    selection?.description?.trim() ||
    "";

  if (loading && items.length === 0) {
    return (
      <div className="subagent-session-canvas-status">
        {t("subagentUi.loadingSession", { defaultValue: "正在加载子代理会话…" })}
      </div>
    );
  }

  if (loadError && items.length === 0 && !fallbackOutput) {
    return (
      <div className="subagent-session-canvas-status is-error">
        {t("subagentUi.sessionLoadFailed", {
          defaultValue: "子代理会话加载失败",
        })}
        <span className="subagent-session-canvas-error-detail">{loadError}</span>
      </div>
    );
  }

  if (items.length === 0) {
    if (fallbackOutput) {
      return (
        <div className="subagent-session-canvas-fallback">
          <div className="subagent-inspector-label">
            {t("subagentUi.fields.output", { defaultValue: "交付报告" })}
          </div>
          <pre className="subagent-session-canvas-fallback-body">{fallbackOutput}</pre>
        </div>
      );
    }
    return (
      <div className="subagent-session-canvas-status">
        {t("subagentUi.emptySession", {
          defaultValue: "子代理会话暂无消息（可能仍在索引）",
        })}
      </div>
    );
  }

  return (
    <div className="subagent-session-canvas">
      <Messages
        items={items}
        threadId={sessionThreadId}
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
