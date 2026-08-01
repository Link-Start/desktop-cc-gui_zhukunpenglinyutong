// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import { useMessagesHistoryPresentationWindow } from "./useMessagesHistoryWindow";

const readableAssistantItem: ConversationItem = {
  id: "assistant-readable",
  kind: "message",
  role: "assistant",
  text: "workspace A readable response",
};

describe("useMessagesHistoryPresentationWindow", () => {
  it("does not reuse a readable window across workspaces with matching thread ids", () => {
    const { result, rerender } = renderHook(
      (props: {
        workspaceId: string;
        timelineItems: ConversationItem[];
        recoveryActive: boolean;
      }) =>
        useMessagesHistoryPresentationWindow({
          activeTurnId: "turn-1",
          blankingRecoveryActive: props.recoveryActive,
          effectiveItemsLength: 1,
          historyExpansionMode: null,
          isThinking: true,
          isWorking: true,
          liveTailWorkingSet: {
            omittedBeforeWorkingSetCount: 0,
            preservedUserMessageId: null,
          },
          readableWindowRecoveryActive: props.recoveryActive,
          showAllHistoryItems: false,
          supportsStreamingReadableWindowRecovery: true,
          threadId: "shared-thread",
          timelineItems: props.timelineItems,
          visibleStallRecoveryActive: false,
          workspaceId: props.workspaceId,
        }),
      {
        initialProps: {
          workspaceId: "workspace-a",
          timelineItems: [readableAssistantItem],
          recoveryActive: false,
        },
      },
    );

    expect(result.current.presentationRenderedItems).toEqual([readableAssistantItem]);

    rerender({
      workspaceId: "workspace-b",
      timelineItems: [],
      recoveryActive: true,
    });

    expect(result.current.shouldUseReadableWindowRecovery).toBe(false);
    expect(result.current.presentationRenderedItems).toEqual([]);
  });
});
