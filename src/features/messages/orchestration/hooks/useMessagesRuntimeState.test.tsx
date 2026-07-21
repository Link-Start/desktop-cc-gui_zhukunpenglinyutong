// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../../types";
import { useMessagesRuntimeState } from "./useMessagesRuntimeState";

const assistantItem: ConversationItem = {
  id: "shared-assistant",
  kind: "message",
  role: "assistant",
  text: "shared assistant text",
};

function buildRuntimeInput(
  overrides: Partial<Parameters<typeof useMessagesRuntimeState>[0]> = {},
): Parameters<typeof useMessagesRuntimeState>[0] {
  return {
    activeEngine: "codex",
    activeTurnId: "turn-1",
    codexSilentSuspectedAt: null,
    deferredRenderSourceItems: [assistantItem],
    isContextCompacting: false,
    isMacDesktop: false,
    isAgentTaskNotificationText: () => false,
    isThinking: true,
    isWindowsDesktop: false,
    items: [assistantItem],
    labels: {
      approvalResumingAfterApproval: "resuming",
      codexSilentSuspected: "silent",
      codexWaitingForFirstText: "waiting",
      contextCompacting: "compacting",
    },
    renderScopeKey: "workspace-a\u0000shared-thread",
    reportVisibleTextRendered: vi.fn(),
    renderSourceItems: [assistantItem],
    streamActivityPhase: "ingress",
    threadId: "shared-thread",
    threadStreamLatencyCategory: null,
    ...overrides,
  };
}

describe("useMessagesRuntimeState", () => {
  it("does not carry assistant completion state across workspaces with matching thread ids", () => {
    const { result, rerender } = renderHook(
      (props: { renderScopeKey: string; isThinking: boolean }) =>
        useMessagesRuntimeState(
          buildRuntimeInput({
            renderScopeKey: props.renderScopeKey,
            isThinking: props.isThinking,
          }),
        ),
      {
        initialProps: {
          renderScopeKey: "workspace-a\u0000shared-thread",
          isThinking: true,
        },
      },
    );

    expect(result.current.liveAssistantMessageId).toBe(assistantItem.id);

    rerender({
      renderScopeKey: "workspace-b\u0000shared-thread",
      isThinking: false,
    });

    expect(result.current.isAssistantFinalizing).toBe(false);
    expect(result.current.liveAssistantMessageId).toBeNull();
  });

  it("reports matching assistant ids again after the workspace scope changes", () => {
    const reportVisibleTextRendered = vi.fn();
    const { result, rerender } = renderHook(
      (props: { renderScopeKey: string }) =>
        useMessagesRuntimeState(
          buildRuntimeInput({
            renderScopeKey: props.renderScopeKey,
            reportVisibleTextRendered,
          }),
        ),
      {
        initialProps: {
          renderScopeKey: "workspace-a\u0000shared-thread",
        },
      },
    );

    act(() => {
      result.current.handleAssistantVisibleTextRender({
        itemId: assistantItem.id,
        visibleText: assistantItem.text,
      });
    });
    expect(reportVisibleTextRendered).toHaveBeenCalledTimes(1);

    rerender({ renderScopeKey: "workspace-b\u0000shared-thread" });
    act(() => {
      result.current.handleAssistantVisibleTextRender({
        itemId: assistantItem.id,
        visibleText: assistantItem.text,
      });
    });

    expect(reportVisibleTextRendered).toHaveBeenCalledTimes(2);
  });
});
