import { describe, expect, it } from "vitest";
import {
  clearSharedSessionBindingsForSharedThread,
  registerSharedSessionNativeBinding,
  rebindSharedSessionNativeThread,
  resolvePendingSharedSessionBindingForEngine,
  resolvePendingSharedSessionBindingForTarget,
  resolveSharedSessionBindingByNativeThread,
} from "./sharedSessionBridge";

describe("sharedSessionBridge", () => {
  it("registers and resolves native thread bindings for shared sessions", () => {
    registerSharedSessionNativeBinding({
      workspaceId: "ws-1",
      sharedThreadId: "shared:thread-1",
      nativeThreadId: "claude-pending-shared-1",
      engine: "claude",
    });

    expect(
      resolveSharedSessionBindingByNativeThread("ws-1", "claude-pending-shared-1"),
    ).toEqual({
      workspaceId: "ws-1",
      sharedThreadId: "shared:thread-1",
      nativeThreadId: "claude-pending-shared-1",
      engine: "claude",
    });

    clearSharedSessionBindingsForSharedThread("ws-1", "shared:thread-1");
  });

  it("rebinds pending native thread ids to finalized session ids", () => {
    registerSharedSessionNativeBinding({
      workspaceId: "ws-2",
      sharedThreadId: "shared:thread-2",
      nativeThreadId: "claude-pending-shared-1",
      engine: "claude",
    });

    const rebound = rebindSharedSessionNativeThread({
      workspaceId: "ws-2",
      oldNativeThreadId: "claude-pending-shared-1",
      newNativeThreadId: "claude:session-1",
    });

    expect(rebound?.nativeThreadId).toBe("claude:session-1");
    expect(
      resolveSharedSessionBindingByNativeThread("ws-2", "claude:session-1")?.sharedThreadId,
    ).toBe("shared:thread-2");
    expect(resolveSharedSessionBindingByNativeThread("ws-2", "claude-pending-shared-1")).toBeNull();

    clearSharedSessionBindingsForSharedThread("ws-2", "shared:thread-2");
  });

  it("resolves a unique pending binding for engine-level shared routing", () => {
    registerSharedSessionNativeBinding({
      workspaceId: "ws-3",
      sharedThreadId: "shared:thread-3",
      nativeThreadId: "codex-pending-shared-3",
      engine: "codex",
    });
    expect(
      resolvePendingSharedSessionBindingForEngine("ws-3", "codex")?.sharedThreadId,
    ).toBe("shared:thread-3");
    clearSharedSessionBindingsForSharedThread("ws-3", "shared:thread-3");
  });

  it("requires pending binding match to be unique", () => {
    registerSharedSessionNativeBinding({
      workspaceId: "ws-4",
      sharedThreadId: "shared:thread-4a",
      nativeThreadId: "codex-pending-shared-4a",
      engine: "codex",
    });
    registerSharedSessionNativeBinding({
      workspaceId: "ws-4",
      sharedThreadId: "shared:thread-4b",
      nativeThreadId: "codex-pending-shared-4b",
      engine: "codex",
    });
    expect(resolvePendingSharedSessionBindingForEngine("ws-4", "codex")).toBeNull();
    clearSharedSessionBindingsForSharedThread("ws-4", "shared:thread-4a");
    clearSharedSessionBindingsForSharedThread("ws-4", "shared:thread-4b");
  });

  it("ignores stale pending bindings when resolving by engine", () => {
    const now = Date.now();
    registerSharedSessionNativeBinding({
      workspaceId: "ws-5",
      sharedThreadId: "shared:thread-5",
      nativeThreadId: "codex-pending-shared-5",
      engine: "codex",
      registeredAtMs: now - 31_000,
    });
    expect(resolvePendingSharedSessionBindingForEngine("ws-5", "codex")).toBeNull();
    clearSharedSessionBindingsForSharedThread("ws-5", "shared:thread-5");
  });

  it("resolves pending bindings per execution target when dual providers run in parallel", () => {
    registerSharedSessionNativeBinding({
      workspaceId: "ws-6",
      sharedThreadId: "shared:thread-6a",
      nativeThreadId: "claude-pending-shared-6a",
      engine: "claude",
    });
    registerSharedSessionNativeBinding({
      workspaceId: "ws-6",
      sharedThreadId: "shared:thread-6b",
      nativeThreadId: "claude-pending-shared-6b",
      engine: "claude",
      providerProfileId: "openrouter",
    });

    // Target 级解析：每个 provider 各自命中自己的 pending binding。
    expect(
      resolvePendingSharedSessionBindingForTarget("ws-6", "claude", null)?.sharedThreadId,
    ).toBe("shared:thread-6a");
    expect(
      resolvePendingSharedSessionBindingForTarget("ws-6", "claude", "openrouter")
        ?.sharedThreadId,
    ).toBe("shared:thread-6b");

    // 旧 engine-only 解析在同 engine 双 pending 时仍 fail-closed（不跨线）。
    expect(resolvePendingSharedSessionBindingForEngine("ws-6", "claude")).toBeNull();

    clearSharedSessionBindingsForSharedThread("ws-6", "shared:thread-6a");
    clearSharedSessionBindingsForSharedThread("ws-6", "shared:thread-6b");
  });

  it("does not cross-match default and managed provider bindings", () => {
    registerSharedSessionNativeBinding({
      workspaceId: "ws-7",
      sharedThreadId: "shared:thread-7",
      nativeThreadId: "codex-pending-shared-7",
      engine: "codex",
      providerProfileId: "openai",
    });

    // default 查询不命中 managed-provider binding。
    expect(resolvePendingSharedSessionBindingForTarget("ws-7", "codex")).toBeNull();
    expect(
      resolvePendingSharedSessionBindingForTarget("ws-7", "codex", "  "),
    ).toBeNull();
    // 其他 managed provider 也不命中。
    expect(
      resolvePendingSharedSessionBindingForTarget("ws-7", "codex", "openrouter"),
    ).toBeNull();
    // 归属 provider 精确命中。
    expect(
      resolvePendingSharedSessionBindingForTarget("ws-7", "codex", "openai")
        ?.nativeThreadId,
    ).toBe("codex-pending-shared-7");

    clearSharedSessionBindingsForSharedThread("ws-7", "shared:thread-7");
  });
});
