import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import type { ConversationItem } from "../../../../types";
import type { MessagesTimelineProps } from "../../orchestration/models/messagesTimelineModels";
import type { MessageOutlineSnapshot } from "../../presentation/messagesOutlineState";
import type { TimelineProjectionRow } from "../projection/messagesTimelineProjection";
import type { TimelineRowHydrationState } from "../virtualization/messagesTimelineHydration";

export type TimelineRowRendererProps = MessagesTimelineProps & {
  row: TimelineProjectionRow;
  hydrationState: TimelineRowHydrationState | undefined;
  liveAssistantOutlineReady?: (outline: MessageOutlineSnapshot["outline"]) => void;
  parseAgentTaskNotification: (
    text: string,
  ) => TimelineAgentTaskNotification | null;
  renderLightweight: boolean;
};

export type TimelineAgentTaskNotification = {
  taskId: string | null;
  toolUseId: string | null;
};

export type TimelineMessageNodeBinding = {
  role: "user" | "assistant";
  taskId: string | null;
  toolUseId: string | null;
};

export type TimelineUserActionNodeCacheEntry = {
  item: ConversationItem;
  copyText: string;
  isCopied: boolean;
  translate: TFunction;
  node: ReactNode;
};
