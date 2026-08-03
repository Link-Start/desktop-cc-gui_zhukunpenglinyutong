import { describe, expect, it, vi } from "vitest";

// @vitest-environment jsdom
import {
  notifyProviderContinuationUiRollback,
  PROVIDER_CONTINUATION_UI_ROLLBACK_EVENT,
  requestProviderContinuationDialog,
  subscribeProviderContinuationDialogRequests,
} from "./providerContinuationRequests";

describe("providerContinuationRequests", () => {
  it("delivers one typed request and stops after cleanup", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeProviderContinuationDialogRequests(listener);
    const request = {
      workspaceId: "ws-1",
      sourceSessionId: "claude:source-1",
      destination: {
        engine: "codex" as const,
        providerProfileId: "provider-b",
        model: "gpt-target",
      },
    };

    requestProviderContinuationDialog(request);
    unsubscribe();
    requestProviderContinuationDialog(request);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(request);
  });

  it("dispatches ui rollback event for cancel restore", () => {
    const listener = vi.fn();
    window.addEventListener(PROVIDER_CONTINUATION_UI_ROLLBACK_EVENT, listener);
    notifyProviderContinuationUiRollback({
      engine: "claude",
      providerProfileId: "deepseek",
    });
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({
      engine: "claude",
      providerProfileId: "deepseek",
    });
    window.removeEventListener(
      PROVIDER_CONTINUATION_UI_ROLLBACK_EVENT,
      listener,
    );
  });
});
