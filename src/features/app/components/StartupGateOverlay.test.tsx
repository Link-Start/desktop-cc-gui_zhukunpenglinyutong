// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STARTUP_GATE_FORCE_DISMISS_MS,
  STARTUP_GATE_MIN_VISIBLE_MS,
  StartupGateOverlay,
} from "./StartupGateOverlay";
import {
  recordStartupMilestone,
  resetStartupTraceForTests,
} from "../../startup-orchestration/utils/startupTrace";
import {
  isStartupForceEntered,
  resetStartupForceEnterForTests,
} from "../../startup-orchestration/utils/startupForceEnter";

const platformMocks = vi.hoisted(() => ({
  enabled: true,
}));

const orchestratorMocks = vi.hoisted(() => ({
  cancelAllTasks: vi.fn(),
}));

vi.mock("../../../utils/platform", () => ({
  isStartupGatePlatform: () => platformMocks.enabled,
  isWindowsPlatform: () => true,
  isMacPlatform: () => false,
}));

vi.mock("../../startup-orchestration/utils/startupOrchestrator", () => ({
  startupOrchestrator: {
    cancelAllTasks: orchestratorMocks.cancelAllTasks,
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("StartupGateOverlay", () => {
  beforeEach(() => {
    platformMocks.enabled = true;
    orchestratorMocks.cancelAllTasks.mockReset();
    resetStartupTraceForTests();
    resetStartupForceEnterForTests();
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetStartupTraceForTests();
    resetStartupForceEnterForTests();
  });

  it("renders when gate platform is enabled", () => {
    render(<StartupGateOverlay />);
    expect(screen.getByTestId("startup-gate-overlay")).toBeTruthy();
    expect(screen.queryByTestId("startup-gate-force-dismiss")).toBeNull();
  });

  it("does not render when gate platform is disabled", () => {
    platformMocks.enabled = false;
    render(<StartupGateOverlay />);
    expect(screen.queryByTestId("startup-gate-overlay")).toBeNull();
  });

  it("shows force-dismiss after 10 seconds", async () => {
    render(<StartupGateOverlay />);
    expect(screen.queryByTestId("startup-gate-force-dismiss")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STARTUP_GATE_FORCE_DISMISS_MS);
    });

    expect(screen.getByTestId("startup-gate-force-dismiss")).toBeTruthy();
  });

  it("does NOT hide on early active-workspace-ready alone (first-paint)", async () => {
    render(<StartupGateOverlay />);
    await act(async () => {
      recordStartupMilestone("active-workspace-ready");
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByTestId("startup-gate-overlay")).toBeTruthy();
  });

  it("hides only after startup-gate-ready AND min visible time", async () => {
    render(<StartupGateOverlay />);
    await act(async () => {
      recordStartupMilestone("startup-gate-ready");
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByTestId("startup-gate-overlay")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        STARTUP_GATE_MIN_VISIBLE_MS - 2_000 + 50,
      );
    });
    expect(screen.queryByTestId("startup-gate-overlay")).toBeNull();
  });

  it("force-dismiss cancels as stale and marks force-enter", async () => {
    render(<StartupGateOverlay />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STARTUP_GATE_FORCE_DISMISS_MS);
    });
    const button = screen.getByTestId("startup-gate-force-dismiss");
    await act(async () => {
      button.click();
    });
    expect(screen.queryByTestId("startup-gate-overlay")).toBeNull();
    expect(orchestratorMocks.cancelAllTasks).toHaveBeenCalledWith("stale");
    expect(isStartupForceEntered()).toBe(true);
  });
});
