// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const { subscribeAppServerEvents } = vi.hoisted(() => ({
  subscribeAppServerEvents: vi.fn(),
}));

vi.mock("../../../services/events", () => ({
  subscribeAppServerEvents,
}));

import { captureSharedRuntimeTerminal } from "./sharedRuntimeTerminal";

describe("captureSharedRuntimeTerminal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("buffers a fast terminal and later resolves only its native owner", async () => {
    subscribeAppServerEvents.mockReturnValue(vi.fn());
    const capture = captureSharedRuntimeTerminal("ws-1");
    const onEvent = subscribeAppServerEvents.mock.calls[0][0];
    onEvent({
      workspace_id: "ws-1",
      message: {
        method: "item/completed",
        params: {
          threadId: "codex-native-1",
          item: { type: "agentMessage", text: "done" },
        },
      },
    });
    onEvent({
      workspace_id: "ws-1",
      message: {
        method: "turn/completed",
        params: {
          threadId: "codex-native-1",
          turn: { id: "runtime-turn-1" },
        },
      },
    });

    await expect(
      capture.waitFor({
        nativeThreadId: "codex-native-1",
        runtimeTurnId: "runtime-turn-1",
      }),
    ).resolves.toEqual({
      type: "run.settled",
      outcome: "completed",
      assistantText: "done",
    });
    capture.dispose();
  });

  it("maps owned turn/error to failed without matching another binding", async () => {
    subscribeAppServerEvents.mockReturnValue(vi.fn());
    const capture = captureSharedRuntimeTerminal("ws-1");
    const onEvent = subscribeAppServerEvents.mock.calls[0][0];
    const pending = capture.waitFor({
      nativeThreadId: "codex-native-2",
      runtimeTurnId: "runtime-turn-2",
    });
    onEvent({
      workspace_id: "ws-1",
      message: {
        method: "turn/error",
        params: {
          threadId: "codex-native-1",
          turnId: "runtime-turn-1",
        },
      },
    });
    onEvent({
      workspace_id: "ws-1",
      message: {
        method: "turn/error",
        params: {
          threadId: "codex-native-2",
          turnId: "runtime-turn-2",
        },
      },
    });

    await expect(pending).resolves.toMatchObject({ outcome: "failed" });
    capture.dispose();
  });
});
