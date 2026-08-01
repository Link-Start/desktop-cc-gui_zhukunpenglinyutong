import { useDeferredValue, type ComponentProps } from "react";

import { StatusPanel } from "../../status-panel/components/StatusPanel";
import {
  shallowEqual,
  useActiveCanvasSelector,
  type ActiveCanvasSnapshot,
} from "./activeCanvasStore";

type StatusPanelProps = ComponentProps<typeof StatusPanel>;

const selectActiveCanvasStatusPanelProps = (
  snapshot: ActiveCanvasSnapshot,
): Pick<
  StatusPanelProps,
  | "items"
  | "isProcessing"
  | "plan"
  | "activeThreadId"
  | "activeTurnId"
  | "activeTokenUsage"
  | "activeRateLimits"
  | "itemsByThread"
  | "threadStatusById"
  | "pendingApprovals"
  | "pendingUserInputs"
> => ({
  items: snapshot.items,
  isProcessing: snapshot.isThinking,
  plan: snapshot.plan,
  activeThreadId: snapshot.threadId,
  activeTurnId: snapshot.activeTurnId,
  activeTokenUsage: snapshot.activeTokenUsage,
  activeRateLimits: snapshot.activeRateLimits,
  itemsByThread: snapshot.threadItemsByThread,
  threadStatusById: snapshot.threadStatusById,
  pendingApprovals: (snapshot.approvals ?? []).length,
  pendingUserInputs: (snapshot.userInputRequests ?? []).length,
});

export function ActiveCanvasStatusPanel(props: StatusPanelProps) {
  const activeCanvasStatusPanelProps = useActiveCanvasSelector(
    selectActiveCanvasStatusPanelProps,
    shallowEqual,
  );
  const deferredLiveProps = useDeferredValue(activeCanvasStatusPanelProps);

  return <StatusPanel {...props} {...deferredLiveProps} />;
}
