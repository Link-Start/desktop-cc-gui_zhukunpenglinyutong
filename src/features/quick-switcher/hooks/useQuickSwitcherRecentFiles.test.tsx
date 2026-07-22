// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUICK_SWITCHER_RECENT_FILES_CHANGED } from "../recentFiles";
import { useQuickSwitcherRecentFiles } from "./useQuickSwitcherRecentFiles";

const storageMocks = vi.hoisted(() => ({
  recentFilesByWorkspace: {} as Record<string, unknown>,
}));

vi.mock("../../../services/clientStorage", () => ({
  getClientStoreSync: vi.fn(() => storageMocks.recentFilesByWorkspace),
  writeClientStoreValue: vi.fn(),
}));

describe("useQuickSwitcherRecentFiles", () => {
  beforeEach(() => {
    storageMocks.recentFilesByWorkspace = {};
  });

  it("keeps the state stable when an equivalent workspace array is recreated", () => {
    const { result, rerender } = renderHook(
      ({ workspaces }) => useQuickSwitcherRecentFiles(workspaces),
      { initialProps: { workspaces: [{ id: "workspace-1", name: "Workspace" }] } },
    );
    const initialGroups = result.current;

    rerender({ workspaces: [{ id: "workspace-1", name: "Workspace" }] });

    expect(result.current).toBe(initialGroups);
  });

  it("publishes a real recent-file change", () => {
    const { result } = renderHook(() =>
      useQuickSwitcherRecentFiles([{ id: "workspace-1", name: "Workspace" }]),
    );

    storageMocks.recentFilesByWorkspace = {
      "workspace-1": [
        {
          workspaceId: "workspace-1",
          path: "src/App.tsx",
          touchedAt: 10,
          source: "opened",
        },
      ],
    };
    act(() => {
      window.dispatchEvent(new CustomEvent(QUICK_SWITCHER_RECENT_FILES_CHANGED));
    });

    expect(result.current[0]?.files[0]?.path).toBe("src/App.tsx");
  });
});
