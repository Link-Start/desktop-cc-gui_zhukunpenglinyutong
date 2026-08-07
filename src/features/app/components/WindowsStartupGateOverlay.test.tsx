// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WINDOWS_STARTUP_GATE_FORCE_DISMISS_MS,
  WINDOWS_STARTUP_GATE_MIN_VISIBLE_MS,
  WindowsStartupGateOverlay,
} from "./WindowsStartupGateOverlay";
import {
  recordStartupMilestone,
  resetStartupTraceForTests,
} from "../../startup-orchestration/utils/startupTrace";

const platformMocks = vi.hoisted(() => ({
  isWindows: true,
}));

vi.mock("../../../utils/platform", () => ({
  isWindowsPlatform: () => platformMocks.isWindows,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("WindowsStartupGateOverlay", () => {
  beforeEach(() => {
    platformMocks.isWindows = true;
    resetStartupTraceForTests();
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetStartupTraceForTests();
  });

  it("renders on Windows when startup is incomplete", () => {
    render(<WindowsStartupGateOverlay />);
    expect(screen.getByTestId("windows-startup-gate-overlay")).toBeTruthy();
    expect(
      screen.queryByTestId("windows-startup-gate-force-dismiss"),
    ).toBeNull();
  });

  it("does not render on non-Windows", () => {
    platformMocks.isWindows = false;
    render(<WindowsStartupGateOverlay />);
    expect(screen.queryByTestId("windows-startup-gate-overlay")).toBeNull();
  });

  it("shows force-dismiss after 5 seconds", async () => {
    render(<WindowsStartupGateOverlay />);
    expect(
      screen.queryByTestId("windows-startup-gate-force-dismiss"),
    ).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(WINDOWS_STARTUP_GATE_FORCE_DISMISS_MS);
    });

    expect(
      screen.getByTestId("windows-startup-gate-force-dismiss"),
    ).toBeTruthy();
  });

  it("does NOT hide on early active-workspace-ready alone (first-paint)", async () => {
    render(<WindowsStartupGateOverlay />);
    await act(async () => {
      recordStartupMilestone("active-workspace-ready");
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByTestId("windows-startup-gate-overlay")).toBeTruthy();
  });

  it("hides only after startup-gate-ready AND min visible time", async () => {
    render(<WindowsStartupGateOverlay />);
    await act(async () => {
      recordStartupMilestone("startup-gate-ready");
      // still before min visible
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByTestId("windows-startup-gate-overlay")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        WINDOWS_STARTUP_GATE_MIN_VISIBLE_MS - 2_000 + 50,
      );
    });
    expect(screen.queryByTestId("windows-startup-gate-overlay")).toBeNull();
  });

  it("force-dismiss closes the overlay", async () => {
    render(<WindowsStartupGateOverlay />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WINDOWS_STARTUP_GATE_FORCE_DISMISS_MS);
    });
    const button = screen.getByTestId("windows-startup-gate-force-dismiss");
    await act(async () => {
      button.click();
    });
    expect(screen.queryByTestId("windows-startup-gate-overlay")).toBeNull();
  });
});
