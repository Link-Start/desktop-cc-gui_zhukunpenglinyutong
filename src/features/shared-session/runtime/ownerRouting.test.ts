// @vitest-environment jsdom
/**
 * B.5 owner 路由不跨线测试：同 engine 双 Provider 并行时，
 * pending 解析 / rebind / updateSharedSessionNativeBinding 全链路
 * 都必须携带各自 Target 的 providerProfileId。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateSharedSessionNativeBinding } = vi.hoisted(() => ({
  updateSharedSessionNativeBinding: vi.fn<(...args: unknown[]) => Promise<null>>(() =>
    Promise.resolve(null),
  ),
}));

vi.mock("../services/sharedSessions", () => ({
  updateSharedSessionNativeBinding,
}));

import {
  clearSharedSessionBindingsForSharedThread,
  registerSharedSessionNativeBinding,
  rebindSharedSessionNativeThread,
  resolvePendingSharedSessionBindingForTarget,
  resolveSharedSessionBindingByNativeThread,
} from "./sharedSessionBridge";

const WORKSPACE_ID = "ws-owner-routing";

/**
 * 模拟 useAppServerEvents 的 pending rebind 流程：
 * 按 Target 解析 pending binding → rebind 到 finalized native id →
 * 透传 binding 携带的 providerProfileId 持久化。
 */
async function simulatePendingRebind(params: {
  engine: "claude" | "codex";
  providerProfileId: string | null;
  finalizedNativeThreadId: string;
}) {
  const pending = resolvePendingSharedSessionBindingForTarget(
    WORKSPACE_ID,
    params.engine,
    params.providerProfileId,
  );
  expect(pending).not.toBeNull();
  const rebound = rebindSharedSessionNativeThread({
    workspaceId: WORKSPACE_ID,
    oldNativeThreadId: pending!.nativeThreadId,
    newNativeThreadId: params.finalizedNativeThreadId,
  });
  expect(rebound).not.toBeNull();
  await updateSharedSessionNativeBinding(
    WORKSPACE_ID,
    rebound!.sharedThreadId,
    rebound!.engine,
    pending!.nativeThreadId,
    params.finalizedNativeThreadId,
    rebound!.providerProfileId ?? null,
  );
  return rebound!;
}

describe("ownerRouting (B.5)", () => {
  beforeEach(() => {
    updateSharedSessionNativeBinding.mockClear();
    clearSharedSessionBindingsForSharedThread(WORKSPACE_ID, "shared:thread-default");
    clearSharedSessionBindingsForSharedThread(WORKSPACE_ID, "shared:thread-managed");
  });

  it("keeps dual-provider parallel rebinds on their own targets", async () => {
    // 同 engine 双 Provider 并行注册 pending binding。
    registerSharedSessionNativeBinding({
      workspaceId: WORKSPACE_ID,
      sharedThreadId: "shared:thread-default",
      nativeThreadId: "claude-pending-shared-default",
      engine: "claude",
    });
    registerSharedSessionNativeBinding({
      workspaceId: WORKSPACE_ID,
      sharedThreadId: "shared:thread-managed",
      nativeThreadId: "claude-pending-shared-managed",
      engine: "claude",
      providerProfileId: "openrouter",
    });

    const reboundDefault = await simulatePendingRebind({
      engine: "claude",
      providerProfileId: null,
      finalizedNativeThreadId: "claude:session-default",
    });
    const reboundManaged = await simulatePendingRebind({
      engine: "claude",
      providerProfileId: "openrouter",
      finalizedNativeThreadId: "claude:session-managed",
    });

    // rebind 保留各自 binding 的 provider 归属。
    expect(reboundDefault.providerProfileId ?? null).toBeNull();
    expect(reboundManaged.providerProfileId).toBe("openrouter");

    // 持久化调用各自携带正确的 providerProfileId，互不串线。
    expect(updateSharedSessionNativeBinding).toHaveBeenNthCalledWith(
      1,
      WORKSPACE_ID,
      "shared:thread-default",
      "claude",
      "claude-pending-shared-default",
      "claude:session-default",
      null,
    );
    expect(updateSharedSessionNativeBinding).toHaveBeenNthCalledWith(
      2,
      WORKSPACE_ID,
      "shared:thread-managed",
      "claude",
      "claude-pending-shared-managed",
      "claude:session-managed",
      "openrouter",
    );

    // rebind 后按 finalized native id 反查，provider 归属仍然正确
    // （approval 响应时的 owner provider 反查依赖此路径）。
    expect(
      resolveSharedSessionBindingByNativeThread(WORKSPACE_ID, "claude:session-default")
        ?.providerProfileId ?? null,
    ).toBeNull();
    expect(
      resolveSharedSessionBindingByNativeThread(WORKSPACE_ID, "claude:session-managed")
        ?.providerProfileId,
    ).toBe("openrouter");
  });

  it("does not leak managed provider into the default-provider rebind", async () => {
    registerSharedSessionNativeBinding({
      workspaceId: WORKSPACE_ID,
      sharedThreadId: "shared:thread-managed",
      nativeThreadId: "codex-pending-shared-managed",
      engine: "codex",
      providerProfileId: "openai",
    });
    registerSharedSessionNativeBinding({
      workspaceId: WORKSPACE_ID,
      sharedThreadId: "shared:thread-default",
      nativeThreadId: "codex-pending-shared-default",
      engine: "codex",
    });

    await simulatePendingRebind({
      engine: "codex",
      providerProfileId: null,
      finalizedNativeThreadId: "codex:session-default",
    });

    // default target 的持久化不得携带 managed provider。
    expect(updateSharedSessionNativeBinding).toHaveBeenCalledWith(
      WORKSPACE_ID,
      "shared:thread-default",
      "codex",
      "codex-pending-shared-default",
      "codex:session-default",
      null,
    );
  });
});
