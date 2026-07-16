/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGitStatus } from "../../../services/tauri";
import type { GitRepositorySummary, WorkspaceInfo } from "../../../types";
import { useMultiRepositoryGitStatus } from "./useMultiRepositoryGitStatus";

vi.mock("../../../services/tauri", () => ({ getGitStatus: vi.fn() }));

const workspace = { id: "ws-1", path: "/tmp/ws", connected: true, settings: {} } as WorkspaceInfo;
const repository = (root: string): GitRepositorySummary => ({
  repositoryRoot: root,
  displayName: root || "ws",
  currentBranch: "main",
  headState: "branch",
  upstream: null,
  ahead: 0,
  behind: 0,
  stagedCount: 1,
  modifiedCount: 0,
  untrackedCount: 0,
  conflictedCount: 0,
  fileStatuses: [],
  isClean: false,
  error: null,
});
const response = (branchName: string) => ({
  branchName,
  files: [],
  stagedFiles: [{ path: "pom.xml", status: "M", additions: 1, deletions: 0 }],
  unstagedFiles: [],
  totalAdditions: 1,
  totalDeletions: 0,
});

describe("useMultiRepositoryGitStatus", () => {
  beforeEach(() => vi.mocked(getGitStatus).mockReset());

  it("keeps single repository on the legacy status path", async () => {
    const repositories = [repository("")];
    const { result } = renderHook(() => useMultiRepositoryGitStatus(workspace, repositories));
    await act(async () => undefined);
    expect(result.current.isMultiRepository).toBe(false);
    expect(result.current.statuses).toEqual([]);
    expect(getGitStatus).not.toHaveBeenCalled();
  });

  it("loads dirty repositories in parallel and isolates partial failures", async () => {
    vi.mocked(getGitStatus).mockImplementation(async (_workspaceId, root) => {
      if (root === "b") throw new Error("repository unavailable");
      return response("main");
    });
    const repositories = [repository("a"), repository("b")];
    const { result } = renderHook(() => useMultiRepositoryGitStatus(workspace, repositories));

    await waitFor(() => expect(result.current.statuses).toHaveLength(2));
    expect(getGitStatus).toHaveBeenCalledWith("ws-1", "a");
    expect(getGitStatus).toHaveBeenCalledWith("ws-1", "b");
    expect(result.current.statuses[0]?.error).toBeNull();
    expect(result.current.statuses[1]?.error).toBe("repository unavailable");
  });

  it("ignores a stale response after the active workspace changes", async () => {
    let resolveStaleRequest: ((value: ReturnType<typeof response>) => void) | undefined;
    vi.mocked(getGitStatus).mockImplementation(async (workspaceId) => {
      if (workspaceId === "ws-1") {
        return new Promise((resolve) => {
          resolveStaleRequest = resolve;
        });
      }
      return response("fresh-branch");
    });
    const repositories = [repository("a"), repository("b")];
    const nextWorkspace = { ...workspace, id: "ws-2" };
    const { result, rerender } = renderHook(
      ({ activeWorkspace }) => useMultiRepositoryGitStatus(activeWorkspace, repositories),
      { initialProps: { activeWorkspace: workspace } },
    );

    await waitFor(() => expect(getGitStatus).toHaveBeenCalledWith("ws-1", "a"));
    rerender({ activeWorkspace: nextWorkspace });
    await waitFor(() => expect(result.current.statuses[0]?.branchName).toBe("fresh-branch"));

    resolveStaleRequest?.(response("stale-branch"));
    await act(async () => undefined);
    expect(result.current.statuses.every((status) => status.branchName === "fresh-branch")).toBe(true);
  });
});
