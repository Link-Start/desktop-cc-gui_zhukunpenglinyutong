import type { useThreads } from "../../features/threads/hooks/useThreads";
import type { WorkspaceInfo } from "../../types";
import {
  useActiveSessionProjection,
  type ActiveSessionProjection,
} from "./activeSessionProjection";
import {
  defineRuntimeThreadShellBoundary,
  type RuntimeThreadShellBoundary,
} from "./runtimeThreadBoundary";

type ThreadsController = ReturnType<typeof useThreads>;

export type RuntimeThreadDomainHost = ActiveSessionProjection & {
  runtimeThreadBoundary: RuntimeThreadShellBoundary;
};

/**
 * S4 PR-D：runtimeThread / conversation 域 turn 级 host（无 UI）。
 *
 * 收编根 composition 上的两处会话派生：
 * - `useActiveSessionProjection`：当前会话 turn 级投影（engine / token / plan / 状态）
 * - `defineRuntimeThreadShellBoundary`：runtimeThreadContext 的 boundary 装配
 *
 * live 正文/思考/工具 delta 仍走 liveAssistantTextChannel / liveItemDeltaChannel，
 * 本 host 只处理 turn 级 bags，不把 live 数据引进根 bag。
 */
export function useRuntimeThreadDomainHost(input: {
  threads: ThreadsController;
  activeWorkspace: WorkspaceInfo | null;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
}): RuntimeThreadDomainHost {
  const { threads, activeWorkspace, activeWorkspaceId, activeThreadId } = input;

  const projection = useActiveSessionProjection({
    activeWorkspaceId,
    activeThreadId,
    threadsByWorkspace: threads.threadsByWorkspace,
    threadStatusById: threads.threadStatusById,
    tokenUsageByThread: threads.tokenUsageByThread,
    rateLimitsByWorkspace: threads.rateLimitsByWorkspace,
    planByThread: threads.planByThread,
    activeItems: threads.activeItems,
    activeTurnIdByThread: threads.activeTurnIdByThread,
    userInputRequests: threads.userInputRequests,
  });

  const runtimeThreadBoundary = defineRuntimeThreadShellBoundary({
    activeItems: threads.activeItems,
    activeThreadId,
    activeTurnId: projection.activeTurnId,
    activeTurnIdByThread: threads.activeTurnIdByThread,
    activeWorkspace,
    activeWorkspaceId,
    canInterrupt: projection.canInterrupt,
    completionEmailIntentByThread: threads.completionEmailIntentByThread,
    handleFusionStalled: threads.handleFusionStalled,
    historyLoadingByThreadId: threads.historyLoadingByThreadId,
    historyLoadingProgressByThreadId: threads.historyLoadingProgressByThreadId,
    historyRestoredAtMsByThread: threads.historyRestoredAtMsByThread,
    interruptTurn: threads.interruptTurn,
    isProcessing: projection.isProcessing,
    isReviewing: projection.isReviewing,
    listThreadsForWorkspace: threads.listThreadsForWorkspace,
    loadOlderThreadsForWorkspace: threads.loadOlderThreadsForWorkspace,
    rateLimitsByWorkspace: threads.rateLimitsByWorkspace,
    refreshAccountInfo: threads.refreshAccountInfo,
    refreshAccountRateLimits: threads.refreshAccountRateLimits,
    refreshThread: threads.refreshThread,
    resetWorkspaceThreads: threads.resetWorkspaceThreads,
    resolveCanonicalThreadId: threads.resolveCanonicalThreadId,
    sendUserMessage: threads.sendUserMessage,
    sendUserMessageToThread: threads.sendUserMessageToThread,
    setActiveThreadId: threads.setActiveThreadId,
    startSharedSessionForWorkspace: threads.startSharedSessionForWorkspace,
    startThreadForWorkspace: threads.startThreadForWorkspace,
    threadItemsByThread: threads.threadItemsByThread,
    threadListCursorByWorkspace: threads.threadListCursorByWorkspace,
    threadListLoadingByWorkspace: threads.threadListLoadingByWorkspace,
    threadListPagingByWorkspace: threads.threadListPagingByWorkspace,
    threadParentById: threads.threadParentById,
    threadStatusById: threads.threadStatusById,
    threadsByWorkspace: threads.threadsByWorkspace,
    tokenUsageByThread: threads.tokenUsageByThread,
    toggleCompletionEmailIntent: threads.toggleCompletionEmailIntent,
  });

  return { ...projection, runtimeThreadBoundary };
}
