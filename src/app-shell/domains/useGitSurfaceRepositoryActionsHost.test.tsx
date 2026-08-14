// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../types";
import {
  revertGitFile,
  revertGitPaths,
  stageGitAll,
  stageGitFile,
  unstageGitAll,
  unstageGitFile,
  unstageGitPaths,
} from "../../services/tauri/git";
import { useGitSurfaceRepositoryActionsHost } from "./useGitSurfaceRepositoryActionsHost";

vi.mock("../../services/tauri/git", () => ({
  revertGitFile: vi.fn().mockResolvedValue(undefined),
  revertGitPaths: vi.fn().mockResolvedValue(undefined),
  stageGitAll: vi.fn().mockResolvedValue(undefined),
  stageGitFile: vi.fn().mockResolvedValue(undefined),
  unstageGitAll: vi.fn().mockResolvedValue(undefined),
  unstageGitFile: vi.fn().mockResolvedValue(undefined),
  unstageGitPaths: vi.fn().mockResolvedValue(undefined),
}));

const workspace = { id: "ws-1" } as WorkspaceInfo;

describe("useGitSurfaceRepositoryActionsHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes single-file stage/unstage/revert to tauri git services with workspaceId", async () => {
    const { result } = renderHook(() =>
      useGitSurfaceRepositoryActionsHost({ activeWorkspace: workspace }),
    );

    await result.current.handleStageRepositoryFile("/repo", "a.ts");
    expect(stageGitFile).toHaveBeenCalledWith("ws-1", "a.ts", "/repo");

    await result.current.handleUnstageRepositoryFile("/repo", "b.ts");
    expect(unstageGitFile).toHaveBeenCalledWith("ws-1", "b.ts", "/repo");

    await result.current.handleRevertRepositoryFile("/repo", "c.ts");
    expect(revertGitFile).toHaveBeenCalledWith("ws-1", "c.ts", "/repo");
  });

  it("routes all-files stage/unstage to the *All variants", async () => {
    const { result } = renderHook(() =>
      useGitSurfaceRepositoryActionsHost({ activeWorkspace: workspace }),
    );

    await result.current.handleStageRepositoryAll("/repo");
    expect(stageGitAll).toHaveBeenCalledWith("ws-1", "/repo");

    await result.current.handleUnstageRepositoryAll("/repo");
    expect(unstageGitAll).toHaveBeenCalledWith("ws-1", "/repo");
  });

  it("collapses single-path batches to the single-file variant", async () => {
    const { result } = renderHook(() =>
      useGitSurfaceRepositoryActionsHost({ activeWorkspace: workspace }),
    );

    await result.current.handleUnstageRepositoryFiles("/repo", ["only.ts"]);
    expect(unstageGitFile).toHaveBeenCalledWith("ws-1", "only.ts", "/repo");
    expect(unstageGitPaths).not.toHaveBeenCalled();

    await result.current.handleRevertRepositoryFiles("/repo", ["only.ts"]);
    expect(revertGitFile).toHaveBeenCalledWith("ws-1", "only.ts", "/repo");
    expect(revertGitPaths).not.toHaveBeenCalled();
  });

  it("routes multi-path batches to the batch variants", async () => {
    const { result } = renderHook(() =>
      useGitSurfaceRepositoryActionsHost({ activeWorkspace: workspace }),
    );

    await result.current.handleUnstageRepositoryFiles("/repo", ["a.ts", "b.ts"]);
    expect(unstageGitPaths).toHaveBeenCalledWith(
      "ws-1",
      ["a.ts", "b.ts"],
      "/repo",
    );

    await result.current.handleRevertRepositoryFiles("/repo", ["a.ts", "b.ts"]);
    expect(revertGitPaths).toHaveBeenCalledWith(
      "ws-1",
      ["a.ts", "b.ts"],
      "/repo",
    );
  });

  it("no-ops without an active workspace", async () => {
    const { result } = renderHook(() =>
      useGitSurfaceRepositoryActionsHost({ activeWorkspace: null }),
    );

    await result.current.handleStageRepositoryFile("/repo", "a.ts");
    await result.current.handleStageRepositoryAll("/repo");
    await result.current.handleUnstageRepositoryFiles("/repo", ["a.ts"]);

    expect(stageGitFile).not.toHaveBeenCalled();
    expect(stageGitAll).not.toHaveBeenCalled();
    expect(unstageGitFile).not.toHaveBeenCalled();
  });

  it("no-ops on empty path batches", async () => {
    const { result } = renderHook(() =>
      useGitSurfaceRepositoryActionsHost({ activeWorkspace: workspace }),
    );

    await result.current.handleUnstageRepositoryFiles("/repo", []);
    await result.current.handleRevertRepositoryFiles("/repo", []);

    expect(unstageGitFile).not.toHaveBeenCalled();
    expect(unstageGitPaths).not.toHaveBeenCalled();
    expect(revertGitFile).not.toHaveBeenCalled();
    expect(revertGitPaths).not.toHaveBeenCalled();
  });

  it("keeps handler identity stable when workspace object identity changes with same id", () => {
    const { result, rerender } = renderHook(
      ({ activeWorkspace }) =>
        useGitSurfaceRepositoryActionsHost({ activeWorkspace }),
      { initialProps: { activeWorkspace: workspace } },
    );
    const before = result.current.handleStageRepositoryFile;

    rerender({ activeWorkspace: { id: "ws-1" } as WorkspaceInfo });
    expect(result.current.handleStageRepositoryFile).toBe(before);

    rerender({ activeWorkspace: { id: "ws-2" } as WorkspaceInfo });
    expect(result.current.handleStageRepositoryFile).not.toBe(before);
  });
});
