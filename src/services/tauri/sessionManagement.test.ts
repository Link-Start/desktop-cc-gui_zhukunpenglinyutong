import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createNativeProviderContinuation,
  discardPreparedNativeProviderContinuation,
  prepareNativeProviderContinuation,
  type NativeProviderContinuationInput,
} from "./sessionManagement";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const INPUT: NativeProviderContinuationInput = {
  workspaceId: "workspace-1",
  operationId: "operation-1",
  source: {
    sessionId: "claude:source-1",
    nativeSessionId: "source-1",
    engine: "claude",
    providerProfileId: "provider-a",
  },
  destination: {
    engine: "codex",
    providerProfileId: "provider-b",
    model: "gpt-target",
  },
};

describe("native Provider continuation commands", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue({});
  });

  it("maps prepare, discard, and confirmed create to the same operation", async () => {
    await prepareNativeProviderContinuation(INPUT);
    await discardPreparedNativeProviderContinuation(INPUT);
    await createNativeProviderContinuation({
      ...INPUT,
      confirmDegraded: true,
    });

    const basePayload = {
      workspaceId: "workspace-1",
      operationId: "operation-1",
      source: INPUT.source,
      destination: INPUT.destination,
    };
    expect(invoke).toHaveBeenNthCalledWith(
      1,
      "prepare_native_provider_continuation",
      basePayload,
    );
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "discard_prepared_native_provider_continuation",
      basePayload,
    );
    expect(invoke).toHaveBeenNthCalledWith(
      3,
      "create_native_provider_continuation",
      {
        ...basePayload,
        confirmDegraded: true,
      },
    );
  });
});
