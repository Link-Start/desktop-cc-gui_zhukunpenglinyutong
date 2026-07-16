// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../types";
import { useGitBranches } from "../features/git/hooks/useGitBranches";
import { useGitRepositories } from "../features/git/hooks/useGitRepositories";
import { useGitActions } from "../features/git/hooks/useGitActions";
import { pickWorkspacePath } from "../services/tauri";
import { useAppShellGitWorkspaceOpsSection } from "./useAppShellGitWorkspaceOpsSection";

vi.mock("../features/git/hooks/useGitBranches", () => ({
  useGitBranches: vi.fn(),
}));

vi.mock("../features/git/hooks/useGitActions", () => ({
  useGitActions: vi.fn(),
}));

vi.mock("../features/git/hooks/useGitRepositories", () => ({
  useGitRepositories: vi.fn(),
}));

vi.mock("../features/files/detachedFileExplorer", () => ({
  buildDetachedFileExplorerSession: vi.fn((input) => input),
  openOrFocusDetachedFileExplorer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/tauri", () => ({
  pickWorkspacePath: vi.fn(),
}));

vi.mock("../services/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace",
  path: "/tmp/workspace",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useAppShellGitWorkspaceOpsSection", () => {
  const checkoutBranch = vi.fn().mockResolvedValue(undefined);
  const createBranch = vi.fn().mockResolvedValue(undefined);
  const updateBranch = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGitBranches).mockReturnValue({
      branches: [],
      localBranches: [],
      remoteBranches: [],
      currentBranch: null,
      checkoutBranch,
      createBranch,
      updateBranch,
      error: null,
      refreshBranches: vi.fn(),
    });
    vi.mocked(useGitRepositories).mockReturnValue({
      repositories: [],
      isLoading: false,
      error: null,
      refreshRepositories: vi.fn(),
    });
    vi.mocked(useGitActions).mockReturnValue({
      applyWorktreeChanges: vi.fn(),
      revertAllGitChanges: vi.fn(),
      revertGitFile: vi.fn(),
      stageGitAll: vi.fn(),
      stageGitFile: vi.fn(),
      unstageGitFile: vi.fn(),
      worktreeApplyError: null,
      worktreeApplyLoading: false,
      worktreeApplySuccess: false,
    });
  });

  it("refreshes git status after branch checkout and creation", async () => {
    const refreshGitStatus = vi.fn();
    const { result } = renderHook(() =>
      useAppShellGitWorkspaceOpsSection({
        activeWorkspace: workspace,
        addDebugEntry: vi.fn(),
        clearGitRootCandidates: vi.fn(),
        gitStatus: { isGitRepository: true, error: null, files: [] },
        refreshGitDiffs: vi.fn(),
        refreshGitStatus,
        t: (key) => key,
        updateWorkspaceSettings: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleCheckoutBranch("main");
      await result.current.handleCreateBranch("feature/test");
    });

    expect(checkoutBranch).toHaveBeenCalledWith("main");
    expect(createBranch).toHaveBeenCalledWith("feature/test");
    expect(refreshGitStatus).toHaveBeenCalledTimes(2);
  });

  it("stores a picked git root relative to the workspace", async () => {
    vi.mocked(pickWorkspacePath).mockResolvedValue("/tmp/workspace/packages/app");
    const updateWorkspaceSettings = vi.fn().mockResolvedValue(undefined);
    const clearGitRootCandidates = vi.fn();
    const refreshGitStatus = vi.fn();
    const { result } = renderHook(() =>
      useAppShellGitWorkspaceOpsSection({
        activeWorkspace: workspace,
        addDebugEntry: vi.fn(),
        clearGitRootCandidates,
        gitStatus: { isGitRepository: true, error: null, files: [] },
        refreshGitDiffs: vi.fn(),
        refreshGitStatus,
        t: (key) => key,
        updateWorkspaceSettings,
      }),
    );

    await act(async () => {
      await result.current.handlePickGitRoot();
    });

    expect(updateWorkspaceSettings).toHaveBeenCalledWith("ws-1", {
      gitRoot: "packages/app",
    });
    expect(clearGitRootCandidates).toHaveBeenCalledTimes(1);
    expect(refreshGitStatus).toHaveBeenCalledTimes(1);
  });
});
