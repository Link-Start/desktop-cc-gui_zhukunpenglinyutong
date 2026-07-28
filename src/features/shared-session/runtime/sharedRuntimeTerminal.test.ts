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
        attemptId: null,
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
      attemptId: null,
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

  it("matches the exact runtime turn after native thread rebind", async () => {
    subscribeAppServerEvents.mockReturnValue(vi.fn());
    const capture = captureSharedRuntimeTerminal("ws-1");
    const onEvent = subscribeAppServerEvents.mock.calls[0][0];
    const pending = capture.waitFor({
      attemptId: null,
      nativeThreadId: "claude-pending-shared-1",
      runtimeTurnId: "claude-turn-1",
    });

    onEvent({
      workspace_id: "ws-1",
      message: {
        method: "turn/completed",
        params: {
          threadId: "claude:native-session-1",
          turnId: "claude-turn-1",
          result: { text: "done after rebind" },
        },
      },
    });

    await expect(pending).resolves.toEqual({
      type: "run.settled",
      outcome: "completed",
      assistantText: "done after rebind",
    });
    capture.dispose();
  });

  it("matches projected Shared terminals by exact attempt and native Runtime owner", async () => {
    subscribeAppServerEvents.mockReturnValue(vi.fn());
    const capture = captureSharedRuntimeTerminal("ws-1");
    const onEvent = subscribeAppServerEvents.mock.calls[0][0];
    const pending = capture.waitFor({
      attemptId: "attempt-2",
      nativeThreadId: "codex-native-1",
      runtimeTurnId: "runtime-turn-2",
    });

    onEvent({
      workspace_id: "ws-1",
      message: {
        method: "turn/completed",
        params: {
          threadId: "shared:thread-1",
          nativeThreadId: "codex-native-1",
          turnId: "runtime-turn-2",
          sharedOwner: {
            attemptId: "attempt-1",
            nativeThreadId: "codex-native-1",
            runtimeTurnId: "runtime-turn-2",
          },
          result: { text: "wrong attempt" },
        },
      },
    });
    onEvent({
      workspace_id: "ws-1",
      message: {
        method: "turn/completed",
        params: {
          threadId: "shared:thread-1",
          turnId: "runtime-turn-2",
          sharedOwner: {
            attemptId: "attempt-2",
            runtimeTurnId: "runtime-turn-2",
          },
          result: { text: "missing native owner" },
        },
      },
    });
    onEvent({
      workspace_id: "ws-1",
      message: {
        method: "item/completed",
        params: {
          threadId: "shared:thread-1",
          nativeThreadId: "codex-native-1",
          sharedOwner: {
            attemptId: "attempt-2",
            nativeThreadId: "codex-native-1",
            runtimeTurnId: "runtime-turn-2",
          },
          item: { type: "agentMessage", text: "exact assistant" },
        },
      },
    });
    onEvent({
      workspace_id: "ws-1",
      message: {
        method: "turn/completed",
        params: {
          threadId: "shared:thread-1",
          nativeThreadId: "codex-native-1",
          turnId: "runtime-turn-2",
          sharedOwner: {
            attemptId: "attempt-2",
            nativeThreadId: "codex-native-1",
            runtimeTurnId: "runtime-turn-2",
          },
        },
      },
    });

    await expect(pending).resolves.toEqual({
      type: "run.settled",
      outcome: "completed",
      assistantText: "exact assistant",
    });
    capture.dispose();
  });

  it("matches Claude replay echo by package id and checksum", async () => {
    subscribeAppServerEvents.mockReturnValue(vi.fn());
    const capture = captureSharedRuntimeTerminal("ws-1");
    const onEvent = subscribeAppServerEvents.mock.calls[0][0];
    const pending = capture.waitForContext({
      packageId: "package-1",
      sourceChecksum: "sha256:source",
    });
    onEvent({
      workspace_id: "ws-1",
      message: {
        method: "claude/raw",
        params: {
          type: "user",
          isReplay: true,
          message: {
            role: "user",
            content:
              "MOSSX_CONTEXT_PACKAGE:package-1:sha256:source\ncontext",
          },
        },
      },
    });

    await expect(pending).resolves.toBeUndefined();
    capture.dispose();
  });
});
