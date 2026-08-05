// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  canOpenWindowsMainWindowCloseConfirm,
  performWindowsMainWindowClose,
} from "./windowsMainWindowCloseConfirm";

describe("canOpenWindowsMainWindowCloseConfirm", () => {
  it("allows open when idle", () => {
    expect(
      canOpenWindowsMainWindowCloseConfirm({
        isDialogOpen: false,
        isClosing: false,
      }),
    ).toBe(true);
  });

  it("blocks open while dialog is already shown", () => {
    expect(
      canOpenWindowsMainWindowCloseConfirm({
        isDialogOpen: true,
        isClosing: false,
      }),
    ).toBe(false);
  });

  it("blocks open while close is in flight", () => {
    expect(
      canOpenWindowsMainWindowCloseConfirm({
        isDialogOpen: false,
        isClosing: true,
      }),
    ).toBe(false);
  });
});

describe("performWindowsMainWindowClose", () => {
  it("returns closed when close resolves", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const logError = vi.fn();

    await expect(performWindowsMainWindowClose(close, logError)).resolves.toBe(
      "closed",
    );
    expect(close).toHaveBeenCalledTimes(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it("returns close-failed and logs when close throws", async () => {
    const error = new Error("close failed");
    const close = vi.fn().mockRejectedValue(error);
    const logError = vi.fn();

    await expect(performWindowsMainWindowClose(close, logError)).resolves.toBe(
      "close-failed",
    );
    expect(logError).toHaveBeenCalledWith(
      "Windows main window close failed after user confirmation",
      error,
    );
  });
});
