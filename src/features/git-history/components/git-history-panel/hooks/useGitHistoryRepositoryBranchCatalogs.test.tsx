/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listGitBranches } from "../../../../../services/tauri";
import type { GitBranchListResponse, GitRepositorySummary } from "../../../../../types";
import { useGitHistoryRepositoryBranchCatalogs } from "./useGitHistoryRepositoryBranchCatalogs";

vi.mock("../../../../../services/tauri", () => ({ listGitBranches: vi.fn() }));

const repository = (repositoryRoot: string): GitRepositorySummary => ({
  repositoryRoot,
  displayName: repositoryRoot || "root",
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

const response = (branch: string): GitBranchListResponse => ({
  branches: [],
  localBranches: [{
    name: branch,
    isCurrent: true,
    isRemote: false,
    lastCommit: 1,
    ahead: 0,
    behind: 0,
  }],
  remoteBranches: [],
  currentBranch: branch,
});

describe("useGitHistoryRepositoryBranchCatalogs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads every repository with its exact root, including the workspace root", async () => {
    vi.mocked(listGitBranches).mockImplementation(async (_workspaceId, root) => response(root || "main"));
    const repositories = [repository(""), repository("services/api")];
    const { result } = renderHook(() => useGitHistoryRepositoryBranchCatalogs({
      workspaceId: "w1",
      repositories,
      enabled: true,
    }));

    await waitFor(() => expect(result.current.get("services/api")?.status).toBe("ready"));
    expect(listGitBranches).toHaveBeenCalledWith("w1", "");
    expect(listGitBranches).toHaveBeenCalledWith("w1", "services/api");
    expect(result.current.get("")?.localBranches[0]?.name).toBe("main");
  });

  it("isolates one repository failure from successful catalogs", async () => {
    vi.mocked(listGitBranches).mockImplementation(async (_workspaceId, root) => {
      if (root === "broken") throw new Error("broken repository");
      return response("main");
    });
    const repositories = [repository("healthy"), repository("broken")];
    const { result } = renderHook(() => useGitHistoryRepositoryBranchCatalogs({
      workspaceId: "w1",
      repositories,
      enabled: true,
    }));

    await waitFor(() => expect(result.current.get("broken")?.status).toBe("error"));
    expect(result.current.get("healthy")?.status).toBe("ready");
    expect(result.current.get("broken")?.error).toBe("broken repository");
  });

  it("rejects stale results after the workspace changes", async () => {
    let resolveOld: (value: GitBranchListResponse) => void = () => undefined;
    vi.mocked(listGitBranches)
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(response("new-main"));
    const repositories = [repository("service")];
    const { result, rerender } = renderHook(
      ({ workspaceId }) => useGitHistoryRepositoryBranchCatalogs({
        workspaceId,
        repositories,
        enabled: true,
      }),
      { initialProps: { workspaceId: "old" } },
    );
    rerender({ workspaceId: "new" });
    await waitFor(() => expect(result.current.get("service")?.currentBranch).toBe("new-main"));

    await act(async () => {
      resolveOld(response("old-main"));
      await Promise.resolve();
    });
    expect(result.current.get("service")?.currentBranch).toBe("new-main");
  });

  it("reloads every catalog when the owning Git History surface refreshes", async () => {
    vi.mocked(listGitBranches).mockResolvedValue(response("main"));
    const repositories = [repository("service-a"), repository("service-b")];
    const { rerender } = renderHook(
      ({ refreshKey }) => useGitHistoryRepositoryBranchCatalogs({
        workspaceId: "w1",
        repositories,
        enabled: true,
        refreshKey,
      }),
      { initialProps: { refreshKey: 0 } },
    );
    await waitFor(() => expect(listGitBranches).toHaveBeenCalledTimes(2));

    rerender({ refreshKey: 1 });
    await waitFor(() => expect(listGitBranches).toHaveBeenCalledTimes(4));
  });
});
