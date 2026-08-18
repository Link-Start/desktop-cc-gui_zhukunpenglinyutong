import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installWindowsReloadShortcutGuard,
  isWindowsBrowserReloadKey,
} from "./windowsReloadShortcutGuard";

describe("isWindowsBrowserReloadKey", () => {
  it("matches F5 by key or code", () => {
    expect(isWindowsBrowserReloadKey({ key: "F5", code: "F5" })).toBe(true);
    expect(isWindowsBrowserReloadKey({ key: "F5", code: "" })).toBe(true);
    expect(isWindowsBrowserReloadKey({ key: "r", code: "F5" })).toBe(true);
  });

  it("ignores other keys", () => {
    expect(isWindowsBrowserReloadKey({ key: "F12", code: "F12" })).toBe(false);
    expect(isWindowsBrowserReloadKey({ key: "r", code: "KeyR" })).toBe(false);
  });
});

describe("installWindowsReloadShortcutGuard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not attach outside Windows", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const uninstall = installWindowsReloadShortcutGuard(
      { addEventListener, removeEventListener },
      false,
    );

    expect(addEventListener).not.toHaveBeenCalled();
    uninstall();
    expect(removeEventListener).not.toHaveBeenCalled();
  });

  it("prevents F5 on Windows and cleans up", () => {
    const listeners = new Map<string, EventListener>();
    const target = {
      addEventListener: vi.fn((type: string, handler: EventListener) => {
        listeners.set(type, handler);
      }),
      removeEventListener: vi.fn((type: string, handler: EventListener) => {
        if (listeners.get(type) === handler) {
          listeners.delete(type);
        }
      }),
    };
    const uninstall = installWindowsReloadShortcutGuard(target, true);
    const handler = listeners.get("keydown");
    expect(handler).toBeTypeOf("function");

    const event = {
      key: "F5",
      code: "F5",
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    handler?.(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);

    uninstall();
    expect(target.removeEventListener).toHaveBeenCalledWith(
      "keydown",
      handler,
      true,
    );
  });
});
