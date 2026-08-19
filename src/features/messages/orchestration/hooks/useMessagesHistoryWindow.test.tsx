// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import { OLDER_HISTORY_REVEAL_PAGE_SIZE } from "../../../threads/utils/dispatchThreadItemsProgressively";
import {
  useMessagesHistoryPresentationWindow,
  useMessagesHistoryWindow,
} from "./useMessagesHistoryWindow";

const readableAssistantItem: ConversationItem = {
  id: "assistant-readable",
  kind: "message",
  role: "assistant",
  text: "workspace A readable response",
};

const alwaysCollapseAllowedRef = createRef<boolean>() as React.MutableRefObject<boolean>;
alwaysCollapseAllowedRef.current = true;

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
          revealedHistoryItemCount: 0,
          showAllHistoryItems: false,
          supportsStreamingReadableWindowRecovery: true,
          threadId: "shared-thread",
          timelineItems: props.timelineItems,
          visibleStallRecoveryActive: false,
          windowCollapseAllowedRef: alwaysCollapseAllowedRef,
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

describe("useMessagesHistoryWindow", () => {
  it("expands the presentation reveal budget by one viewport page", () => {
    const { result } = renderHook(() =>
      useMessagesHistoryWindow({ scopeKey: "ws\u0000thread" }),
    );

    act(() => {
      result.current.revealNextHistoryPage(OLDER_HISTORY_REVEAL_PAGE_SIZE);
    });

    expect(result.current.revealedHistoryItemCount).toBe(
      OLDER_HISTORY_REVEAL_PAGE_SIZE,
    );

    act(() => {
      result.current.revealNextHistoryPage(OLDER_HISTORY_REVEAL_PAGE_SIZE);
    });

    expect(result.current.revealedHistoryItemCount).toBe(
      OLDER_HISTORY_REVEAL_PAGE_SIZE * 2,
    );
  });

  it("opens the full presentation window on a one-shot reveal", () => {
    const { result } = renderHook(() =>
      useMessagesHistoryWindow({ scopeKey: "ws\u0000thread" }),
    );

    act(() => {
      result.current.revealAllHistoryItems("manual");
    });

    expect(result.current.showAllHistoryItems).toBe(true);
    expect(result.current.historyExpansionMode).toBe("manual");
  });

  it("keeps the reveal budget when only the first store item changes", () => {
    const { result, rerender } = renderHook(
      ({ scopeKey }) => useMessagesHistoryWindow({ scopeKey }),
      { initialProps: { scopeKey: "ws\u0000thread" } },
    );

    act(() => {
      result.current.revealNextHistoryPage(OLDER_HISTORY_REVEAL_PAGE_SIZE);
    });

    rerender({ scopeKey: "ws\u0000thread" });

    expect(result.current.revealedHistoryItemCount).toBe(
      OLDER_HISTORY_REVEAL_PAGE_SIZE,
    );
  });

  it("resets the reveal budget when the conversation scope changes", () => {
    const { result, rerender } = renderHook(
      ({ scopeKey }) => useMessagesHistoryWindow({ scopeKey }),
      { initialProps: { scopeKey: "ws\u0000thread-a" } },
    );

    act(() => {
      result.current.revealNextHistoryPage(OLDER_HISTORY_REVEAL_PAGE_SIZE);
    });

    rerender({ scopeKey: "ws\u0000thread-b" });

    expect(result.current.revealedHistoryItemCount).toBe(0);
  });
});
