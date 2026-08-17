// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isWindowsPlatform: vi.fn(),
}));

vi.mock("../../../../utils/platform", () => ({
  isWindowsPlatform: mocks.isWindowsPlatform,
}));

import {
  WorkingIndicator,
  WORKING_GLYPH_FRAME_MS,
  WORKING_GLYPH_FRAMES,
} from "./WorkingIndicator";

function renderWorking(isThinking = true) {
  return render(
    <WorkingIndicator
      isThinking={isThinking}
      hasItems
      processingStartedAt={Date.now() - 1_000}
    />,
  );
}

describe("WorkingIndicator spinner platform split", () => {
  beforeEach(() => {
    mocks.isWindowsPlatform.mockReset();
    mocks.isWindowsPlatform.mockReturnValue(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("uses SVG dash on Mac and other non-Windows platforms", () => {
    mocks.isWindowsPlatform.mockReturnValue(false);
    const { container } = renderWorking();
    const spinner = container.querySelector(".working-spinner");
    expect(spinner).toBeTruthy();
    expect(spinner?.tagName.toLowerCase()).toBe("svg");
    expect(spinner?.classList.contains("working-spinner-dash")).toBe(true);
    expect(spinner?.classList.contains("working-spinner-glyph")).toBe(false);
    expect(spinner?.querySelector("circle")).toBeTruthy();
  });

  it("uses glyph frames on Windows and advances textContent without ticking the timer", () => {
    mocks.isWindowsPlatform.mockReturnValue(true);
    const { container } = renderWorking();
    const spinner = container.querySelector(".working-spinner-glyph");
    const clock = container.querySelector(".working-timer-clock");
    expect(spinner).toBeTruthy();
    expect(spinner?.classList.contains("working-spinner")).toBe(true);
    expect(spinner?.classList.contains("working-spinner-dash")).toBe(false);
    expect(spinner?.textContent).toBe(WORKING_GLYPH_FRAMES[0]);
    const clockBefore = clock?.textContent;

    act(() => {
      vi.advanceTimersByTime(WORKING_GLYPH_FRAME_MS);
    });

    expect(spinner?.textContent).toBe(WORKING_GLYPH_FRAMES[1]);
    expect(clock?.textContent).toBe(clockBefore);
  });

  it("clears the glyph interval on unmount", () => {
    mocks.isWindowsPlatform.mockReturnValue(true);
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = renderWorking();
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("hides the spinner when not thinking", () => {
    mocks.isWindowsPlatform.mockReturnValue(true);
    const { container } = renderWorking(false);
    expect(container.querySelector(".working-spinner")).toBeNull();
  });
});
