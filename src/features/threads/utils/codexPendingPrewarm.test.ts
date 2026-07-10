import { beforeEach, describe, expect, it } from "vitest";

import {
  isCodexPrewarmThreadStart,
  registerCodexPrewarm,
  releaseCodexPrewarm,
  resetCodexPendingPrewarmForTests,
  settleCodexPrewarm,
} from "./codexPendingPrewarm";

describe("codexPendingPrewarm", () => {
  beforeEach(() => {
    resetCodexPendingPrewarmForTests();
  });

  it("未登记时不抑制任何 thread/started", () => {
    expect(isCodexPrewarmThreadStart("ws-1", "thread-1")).toBe(false);
  });

  it("真 id 未知的飞行窗口内，按 workspace 粒度抑制", () => {
    registerCodexPrewarm("ws-1", "codex-pending-1");
    // notification 可能早于 response 到达，此刻无从判断是不是自己人。
    expect(isCodexPrewarmThreadStart("ws-1", "thread-1")).toBe(true);
    // 其他 workspace 不受影响。
    expect(isCodexPrewarmThreadStart("ws-2", "thread-1")).toBe(false);
  });

  it("拿到真 id 后收窄为按 id 精确抑制", () => {
    registerCodexPrewarm("ws-1", "codex-pending-1");
    settleCodexPrewarm("codex-pending-1", "thread-1");
    expect(isCodexPrewarmThreadStart("ws-1", "thread-1")).toBe(true);
    expect(isCodexPrewarmThreadStart("ws-1", "thread-other")).toBe(false);
  });

  it("预热失败后停止抑制，避免误挡同 workspace 的其他线程", () => {
    registerCodexPrewarm("ws-1", "codex-pending-1");
    settleCodexPrewarm("codex-pending-1", null);
    expect(isCodexPrewarmThreadStart("ws-1", "thread-1")).toBe(false);
  });

  it("换绑完成后释放，晚到的 thread/started 交给幂等的 ensureThread", () => {
    registerCodexPrewarm("ws-1", "codex-pending-1");
    settleCodexPrewarm("codex-pending-1", "thread-1");
    releaseCodexPrewarm("codex-pending-1");
    expect(isCodexPrewarmThreadStart("ws-1", "thread-1")).toBe(false);
  });

  it("同 workspace 多条预热并存时互不干扰", () => {
    registerCodexPrewarm("ws-1", "codex-pending-1");
    registerCodexPrewarm("ws-1", "codex-pending-2");
    settleCodexPrewarm("codex-pending-1", "thread-1");
    // codex-pending-2 仍在飞行中，workspace 级抑制继续覆盖未知真 id。
    expect(isCodexPrewarmThreadStart("ws-1", "thread-999")).toBe(true);
    settleCodexPrewarm("codex-pending-2", "thread-2");
    expect(isCodexPrewarmThreadStart("ws-1", "thread-1")).toBe(true);
    expect(isCodexPrewarmThreadStart("ws-1", "thread-2")).toBe(true);
    expect(isCodexPrewarmThreadStart("ws-1", "thread-999")).toBe(false);
  });

  it("settle 未登记的 pending 是无操作", () => {
    settleCodexPrewarm("codex-pending-unknown", "thread-1");
    expect(isCodexPrewarmThreadStart("ws-1", "thread-1")).toBe(false);
  });
});
