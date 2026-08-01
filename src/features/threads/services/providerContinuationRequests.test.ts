import { describe, expect, it, vi } from "vitest";

import {
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
});
