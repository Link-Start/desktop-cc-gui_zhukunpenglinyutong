// @vitest-environment jsdom
/**
 * The vendor-markdown chunk (FullMarkdownRuntime) must warm during browser
 * idle once the startup gate opens — never before, and never on the test-mode
 * production path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetStartupGateReadyForTests,
  stampStartupGateReady,
} from "../features/startup-orchestration/utils/startupGateReady";
import { resetStartupTraceForTests } from "../features/startup-orchestration/utils/startupTrace";
import {
  getFullMarkdownRuntimePrewarmFireCountForTests,
  resetFullMarkdownRuntimePrewarmForTests,
  scheduleFullMarkdownRuntimePrewarm,
} from "./prewarmFullMarkdownRuntime";

// Keep the warm import cheap; the fire counter (not module-factory execution,
// which is cached across tests) is the observation point.
vi.mock("./runtime/FullMarkdownRuntime", () => ({
  FullMarkdownRuntime: () => null,
}));

describe("scheduleFullMarkdownRuntimePrewarm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStartupTraceForTests();
    resetStartupGateReadyForTests();
    resetFullMarkdownRuntimePrewarmForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("warms the chunk during idle only after startup-gate-ready", async () => {
    const dispose = scheduleFullMarkdownRuntimePrewarm({ allowInTest: true });
    // Gate not open yet: no idle warm-up may fire.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(getFullMarkdownRuntimePrewarmFireCountForTests()).toBe(0);

    stampStartupGateReady("first-paint-complete");
    // Idle callback pending (jsdom lacks requestIdleCallback → setTimeout
    // fallback bounded by the 5s timeout, min 1s slice).
    expect(getFullMarkdownRuntimePrewarmFireCountForTests()).toBe(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(getFullMarkdownRuntimePrewarmFireCountForTests()).toBe(1);
    dispose();
  });

  it("arms immediately when subscribed after the gate already opened, and only once", async () => {
    stampStartupGateReady("first-paint-complete");

    scheduleFullMarkdownRuntimePrewarm({ allowInTest: true });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(getFullMarkdownRuntimePrewarmFireCountForTests()).toBe(1);

    // Repeat arming is a no-op (the chunk import itself is also cache-cheap).
    scheduleFullMarkdownRuntimePrewarm({ allowInTest: true });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(getFullMarkdownRuntimePrewarmFireCountForTests()).toBe(1);
  });

  it("stays inert in test mode without the explicit escape hatch", async () => {
    const dispose = scheduleFullMarkdownRuntimePrewarm();
    stampStartupGateReady("first-paint-complete");
    await vi.advanceTimersByTimeAsync(6_000);
    expect(getFullMarkdownRuntimePrewarmFireCountForTests()).toBe(0);
    dispose();
  });
});
