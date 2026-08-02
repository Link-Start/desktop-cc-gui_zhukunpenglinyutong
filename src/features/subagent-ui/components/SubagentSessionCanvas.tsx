import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ConversationItem } from "../../../types";
import { loadClaudeSession } from "../../../services/tauri";
import { createClaudeHistoryLoader } from "../../threads/loaders/claudeHistoryLoader";
import { Messages } from "../../messages";
import {
  EMPTY_ACTIVE_CANVAS_ITEMS,
  useActiveCanvasSelector,
} from "../../layout/hooks/activeCanvasStore";

type SubagentSessionCanvasProps = {
  sessionThreadId: string;
  workspaceId?: string | null;
  workspacePath?: string | null;
};

/**
 * 在右侧抽屉内复用全局 Messages 幕布，渲染子代理 session 历史。
 */
export const SubagentSessionCanvas = memo(function SubagentSessionCanvas({
  sessionThreadId,
  workspaceId = null,
  workspacePath = null,
}: SubagentSessionCanvasProps) {
  const { t } = useTranslation();
  const cachedItems = useActiveCanvasSelector(
    (snapshot) => snapshot.threadItemsByThread[sessionThreadId] ?? null,
  );
  const canvasWorkspacePath = useActiveCanvasSelector((s) => s.workspacePath);
  const canvasWorkspaceId = useActiveCanvasSelector((s) => s.workspaceId);

  const resolvedWorkspaceId = workspaceId ?? canvasWorkspaceId;
  const resolvedWorkspacePath = workspacePath ?? canvasWorkspacePath;

  const [loadedItems, setLoadedItems] = useState<ConversationItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);

    // 已在主 store 中有该子会话 items 时直接用，避免重复 IO
    if (cachedItems && cachedItems.length > 0) {
      setLoadedItems(cachedItems);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!resolvedWorkspacePath || !sessionThreadId.startsWith("claude:")) {
      setLoadedItems(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    const loader = createClaudeHistoryLoader({
      workspaceId: resolvedWorkspaceId ?? "unknown",
      workspacePath: resolvedWorkspacePath,
      loadClaudeSession,
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

  if (loading && items.length === 0) {
    return (
      <div className="subagent-session-canvas-status">
        {t("subagentUi.loadingSession", { defaultValue: "正在加载子代理会话…" })}
      </div>
    );
  }

  if (loadError && items.length === 0) {
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
        activeEngine="claude"
        conversationState={null}
      />
    </div>
  );
});
