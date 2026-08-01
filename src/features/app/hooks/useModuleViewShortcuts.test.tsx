// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useModuleViewShortcuts } from "./useModuleViewShortcuts";

const callbacks = {
  onToggleGitGraph: vi.fn(),
  onOpenNotes: vi.fn(),
  onOpenIntentCanvas: vi.fn(),
  onOpenRadar: vi.fn(),
  onOpenProjectMap: vi.fn(),
  onOpenBrowserDock: vi.fn(),
  onOpenFileCompare: vi.fn(),
};

function ModuleShortcutHarness({ disabled = false }: { disabled?: boolean }) {
  useModuleViewShortcuts({
    toggleGitGraphShortcut: disabled ? null : "cmd+alt+g",
    openNotesShortcut: disabled ? null : "cmd+alt+n",
    openIntentCanvasShortcut: disabled ? null : "cmd+alt+i",
    openRadarShortcut: disabled ? null : "cmd+alt+r",
    openProjectMapShortcut: disabled ? null : "cmd+alt+m",
    openBrowserDockShortcut: disabled ? null : "cmd+alt+b",
    openFileCompareShortcut: disabled ? null : "cmd+alt+c",
    ...callbacks,
  });
  return <input aria-label="editor" />;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useModuleViewShortcuts", () => {
  it("dispatches every configured module shortcut to its existing action", () => {
    const originalPlatform = window.navigator.platform;
    Object.defineProperty(window.navigator, "platform", {
      value: "MacIntel",
      configurable: true,
    });
    try {
      render(<ModuleShortcutHarness />);
      const cases = [
        ["g", callbacks.onToggleGitGraph],
        ["n", callbacks.onOpenNotes],
        ["i", callbacks.onOpenIntentCanvas],
        ["r", callbacks.onOpenRadar],
        ["m", callbacks.onOpenProjectMap],
        ["b", callbacks.onOpenBrowserDock],
        ["c", callbacks.onOpenFileCompare],
      ] as const;

      for (const [key, callback] of cases) {
        fireEvent.keyDown(window, { key, metaKey: true, altKey: true });
        expect(callback).toHaveBeenCalledTimes(1);
      }
    } finally {
      Object.defineProperty(window.navigator, "platform", {
        value: originalPlatform,
        configurable: true,
      });
    }
  });

  it("does not dispatch null shortcuts", () => {
    render(<ModuleShortcutHarness disabled />);

    fireEvent.keyDown(window, { key: "g", ctrlKey: true, altKey: true });

    expect(callbacks.onToggleGitGraph).not.toHaveBeenCalled();
  });

  it("does not steal module shortcuts from editable targets", () => {
    const originalPlatform = window.navigator.platform;
    Object.defineProperty(window.navigator, "platform", {
      value: "MacIntel",
      configurable: true,
    });
    try {
      render(<ModuleShortcutHarness />);
      const input = screen.getByLabelText("editor");
      input.focus();

      fireEvent.keyDown(input, { key: "g", metaKey: true, altKey: true });

      expect(callbacks.onToggleGitGraph).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window.navigator, "platform", {
        value: originalPlatform,
        configurable: true,
      });
    }
  });
});
