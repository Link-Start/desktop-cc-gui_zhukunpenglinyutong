/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listGitRepositorySummaries } from "../../../../../services/tauri";
import type { GitRepositorySummary, WorkspaceInfo } from "../../../../../types";
import { useGitHistoryRepositoryOptions } from "./useGitHistoryRepositoryOptions";

vi.mock("../../../../../services/tauri", () => ({
  listGitRepositorySummaries: vi.fn(),
}));

const workspace = (id: string): WorkspaceInfo => ({
  id,
  name: id,
  path: `/tmp/${id}`,
  connected: true,
  settings: { sidebarCollapsed: false },
});

const repository = (repositoryRoot: string): GitRepositorySummary => ({
  repositoryRoot,
  displayName: repositoryRoot,
  currentBranch: "main",
  headState: "branch",
  upstream: null,
  ahead: 0,
  behind: 0,
  stagedCount: 0,
  modifiedCount: 0,
  untrackedCount: 0,
  conflictedCount: 0,
  fileStatuses: [],
  isClean: true,
  error: null,
});

describe("useGitHistoryRepositoryOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a stale repository scan after the History workspace changes", async () => {
    let resolveFirst: (value: GitRepositorySummary[]) => void = () => undefined;
    let resolveSecond: (value: GitRepositorySummary[]) => void = () => undefined;
    vi.mocked(listGitRepositorySummaries)
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));

    const { result, rerender } = renderHook(
      ({ selectedWorkspace }) => useGitHistoryRepositoryOptions({
        workspace: selectedWorkspace,
      }),
      { initialProps: { selectedWorkspace: workspace("workspace-a") } },
    );
    rerender({ selectedWorkspace: workspace("workspace-b") });

    await act(async () => {
      resolveSecond([repository("service-b")]);
      await Promise.resolve();
    });
    expect(result.current.map((entry) => entry.repositoryRoot)).toEqual(["service-b"]);

    await act(async () => {
      resolveFirst([repository("service-a")]);
      await Promise.resolve();
    });
    expect(result.current.map((entry) => entry.repositoryRoot)).toEqual(["service-b"]);
  });

  it("uses provided repository summaries without starting another scan", () => {
    const repositoriesOverride = [repository("service-a"), repository("service-b")];
    const { result } = renderHook(() => useGitHistoryRepositoryOptions({
      workspace: workspace("workspace-a"),
      repositoriesOverride,
    }));

    expect(result.current).toBe(repositoriesOverride);
    expect(listGitRepositorySummaries).not.toHaveBeenCalled();
  });

  it("reports the current workspace scan failure", async () => {
    const onError = vi.fn();
    const selectedWorkspace = workspace("workspace-a");
    vi.mocked(listGitRepositorySummaries).mockRejectedValueOnce(new Error("scan failed"));
    renderHook(() => useGitHistoryRepositoryOptions({
      workspace: selectedWorkspace,
      onError,
    }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(onError).toHaveBeenCalledWith("scan failed");
  });
});
