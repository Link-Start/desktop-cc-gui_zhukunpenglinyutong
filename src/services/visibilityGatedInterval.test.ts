// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { setVisibilityGatedInterval } from "./visibilityGatedInterval";

function setDocumentVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
});

describe("setVisibilityGatedInterval", () => {
  it("ticks on the interval while the document is visible", () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    const cleanup = setVisibilityGatedInterval(tick, 1000);

    vi.advanceTimersByTime(3000);
    expect(tick).toHaveBeenCalledTimes(3);

    cleanup();
    vi.advanceTimersByTime(3000);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it("pauses while hidden and resumes with an immediate catch-up tick", () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    const cleanup = setVisibilityGatedInterval(tick, 1000);

    setDocumentVisibility("hidden");
    vi.advanceTimersByTime(10_000);
    expect(tick).toHaveBeenCalledTimes(0);

    setDocumentVisibility("visible");
    expect(tick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(tick).toHaveBeenCalledTimes(3);

    cleanup();
  });

  it("does not start the interval when created while hidden", () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    const tick = vi.fn();
    const cleanup = setVisibilityGatedInterval(tick, 1000);

    vi.advanceTimersByTime(5000);
    expect(tick).toHaveBeenCalledTimes(0);

    setDocumentVisibility("visible");
    expect(tick).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("stops listening after cleanup", () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    const cleanup = setVisibilityGatedInterval(tick, 1000);
    cleanup();

    setDocumentVisibility("hidden");
    setDocumentVisibility("visible");
    vi.advanceTimersByTime(3000);
    expect(tick).toHaveBeenCalledTimes(0);
  });
});
