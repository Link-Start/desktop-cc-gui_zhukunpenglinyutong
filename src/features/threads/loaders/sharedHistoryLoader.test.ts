// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createSharedHistoryLoader } from "./sharedHistoryLoader";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("sharedHistoryLoader", () => {
  it("restores snapshot items from shared session payload", async () => {
    const loader = createSharedHistoryLoader({
      workspaceId: "ws-1",
      loadSharedSession: vi.fn().mockResolvedValue({
        id: "shared-session-1",
        threadId: "shared:shared-session-1",
        selectedEngine: "claude",
        items: [
          {
            id: "user-1",
            kind: "message",
            role: "user",
            text: "Explain this repository",
          },
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "Here is the summary",
            engineSource: "claude",
          },
        ],
      }),
      loadSharedProjection: vi.fn(),
    });

    const snapshot = await loader.load("shared:shared-session-1");

    expect(snapshot.threadId).toBe("shared:shared-session-1");
    expect(snapshot.engine).toBe("claude");
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.items[1]).toMatchObject({
      kind: "message",
      role: "assistant",
      engineSource: "claude",
    });
  });

  it("normalizes legacy unsupported shared-session engines back to claude", async () => {
    const loader = createSharedHistoryLoader({
      workspaceId: "ws-1",
      loadSharedSession: vi.fn().mockResolvedValue({
        id: "shared-session-2",
        threadId: "shared:shared-session-2",
        selectedEngine: "gemini",
        items: [],
      }),
      loadSharedProjection: vi.fn(),
    });

    const snapshot = await loader.load("shared:shared-session-2");

    expect(snapshot.engine).toBe("claude");
    expect(snapshot.meta.engine).toBe("claude");
  });

  it("does not invoke projection while the feature flag is off", async () => {
    const loadSharedProjection = vi.fn();
    const loader = createSharedHistoryLoader({
      workspaceId: "ws-1",
      loadSharedSession: vi.fn().mockResolvedValue({
        selectedEngine: "claude",
        items: [{ id: "legacy", kind: "message", role: "user", text: "legacy" }],
      }),
      loadSharedProjection,
    });

    const snapshot = await loader.load("shared:session-1");

    expect(loadSharedProjection).not.toHaveBeenCalled();
    expect(snapshot.items[0]).toMatchObject({ id: "legacy", text: "legacy" });
  });

  it("uses Shared Projection while the feature flag is on", async () => {
    window.localStorage.setItem("mossx.sharedProjection", "1");
    const loader = createSharedHistoryLoader({
      workspaceId: "ws-1",
      loadSharedSession: vi.fn().mockResolvedValue({
        selectedEngine: "codex",
        items: [{ id: "legacy", kind: "message", role: "user", text: "legacy" }],
      }),
      loadSharedProjection: vi.fn().mockResolvedValue([
        {
          id: "projected",
          kind: "message",
          content: { role: "assistant", text: "projected", engineSource: "codex" },
          fidelity: "presentation-only",
          checksum: "checksum",
        },
      ]),
    });

    const snapshot = await loader.load("shared:session-1");

    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]).toMatchObject({ id: "projected", text: "projected" });
  });

  it("falls back observably to V0 when projection loading fails", async () => {
    window.localStorage.setItem("mossx.sharedProjection", "1");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const loader = createSharedHistoryLoader({
      workspaceId: "ws-1",
      loadSharedSession: vi.fn().mockResolvedValue({
        selectedEngine: "claude",
        items: [{ id: "legacy", kind: "message", role: "user", text: "legacy" }],
      }),
      loadSharedProjection: vi.fn().mockRejectedValue(new Error("projection unavailable")),
    });

    const snapshot = await loader.load("shared:session-1");

    expect(snapshot.items[0]).toMatchObject({ id: "legacy" });
    expect(warn).toHaveBeenCalledOnce();
  });
});
