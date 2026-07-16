// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitRepositorySummary, WorkspaceInfo } from "../../../types";
import { listGitRepositorySummaries } from "../../../services/tauri";
import { useGitRepositories } from "./useGitRepositories";

vi.mock("../../../services/tauri", () => ({
  listGitRepositorySummaries: vi.fn(),
}));

function workspace(id: string): WorkspaceInfo {
  return {
    id,
    name: id,
    path: `/tmp/${id}`,
    connected: true,
    settings: { sidebarCollapsed: false },
  };
}

function summary(repositoryRoot: string): GitRepositorySummary {
  return {
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
    isClean: true,
    error: null,
  };
}

describe("useGitRepositories", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("rejects a stale repository response after workspace switch", async () => {
    let resolveFirst: (value: GitRepositorySummary[]) => void = () => undefined;
    let resolveSecond: (value: GitRepositorySummary[]) => void = () => undefined;
    vi.mocked(listGitRepositorySummaries)
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));

    const { result, rerender, unmount } = renderHook(
      ({ activeWorkspace }) => useGitRepositories({ activeWorkspace }),
      { initialProps: { activeWorkspace: workspace("workspace-a") } },
    );
    rerender({ activeWorkspace: workspace("workspace-b") });

    await act(async () => {
      resolveSecond([summary("service-b")]);
      await Promise.resolve();
    });
    expect(result.current.repositories.map((repository) => repository.repositoryRoot)).toEqual([
      "service-b",
    ]);

    await act(async () => {
      resolveFirst([summary("service-a")]);
      await Promise.resolve();
    });
    expect(result.current.repositories.map((repository) => repository.repositoryRoot)).toEqual([
      "service-b",
    ]);
    unmount();
  });

  it("uses a low-frequency fallback and preserves equal summary identity", async () => {
    vi.mocked(listGitRepositorySummaries).mockResolvedValue([summary("service-a")]);
    const { result, unmount } = renderHook(() =>
      useGitRepositories({ activeWorkspace: workspace("workspace-a") }),
    );
    await act(async () => { await Promise.resolve(); });
    const initialRepositories = result.current.repositories;

    await act(async () => {
      vi.advanceTimersByTime(44_999);
      await Promise.resolve();
    });
    expect(listGitRepositorySummaries).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(listGitRepositorySummaries).toHaveBeenCalledTimes(2);
    expect(result.current.repositories).toBe(initialRepositories);
    unmount();
  });

  it("preserves last-known-good repositories for one transient empty response", async () => {
    vi.mocked(listGitRepositorySummaries)
      .mockResolvedValueOnce([summary("service-a")])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([summary("service-b")])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const { result, unmount } = renderHook(() =>
      useGitRepositories({ activeWorkspace: workspace("workspace-a") }),
    );
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await result.current.refreshRepositories(); });
    expect(result.current.repositories.map((repository) => repository.repositoryRoot)).toEqual([
      "service-a",
    ]);

    await act(async () => { await result.current.refreshRepositories(); });
    expect(result.current.repositories.map((repository) => repository.repositoryRoot)).toEqual([
      "service-b",
    ]);

    await act(async () => { await result.current.refreshRepositories(); });
    expect(result.current.repositories.map((repository) => repository.repositoryRoot)).toEqual([
      "service-b",
    ]);

    await act(async () => { await result.current.refreshRepositories(); });
    expect(result.current.repositories).toEqual([]);
    unmount();
  });
});
