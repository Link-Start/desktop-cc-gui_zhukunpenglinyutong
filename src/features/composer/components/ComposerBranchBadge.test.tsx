// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComposerBranchBadge } from "./ComposerBranchBadge";

const repositories = [
  {
    repositoryRoot: "service-a",
    displayName: "service-a",
    currentBranch: "main",
    headState: "branch" as const,
    upstream: "origin/main",
    ahead: 1,
    behind: 0,
    stagedCount: 0,
    modifiedCount: 1,
    untrackedCount: 0,
    conflictedCount: 0,
    fileStatuses: [],
    isClean: false,
    error: null,
  },
  {
    repositoryRoot: "service-b",
    displayName: "service-b",
    currentBranch: "feature/test",
    headState: "branch" as const,
    upstream: "origin/feature/test",
    ahead: 0,
    behind: 2,
    stagedCount: 0,
    modifiedCount: 0,
    untrackedCount: 0,
    conflictedCount: 0,
    fileStatuses: [],
    isClean: true,
    error: null,
  },
];
const repositoriesWithThird = [
  ...repositories,
  {
    ...repositories[1],
    repositoryRoot: "service-c",
    displayName: "service-c",
  },
];

function branchCoverage(name: string, repositoryIndexes = [0, 1]) {
  return {
    name,
    repositories: repositoryIndexes.map((index) => ({
      repositoryRoot: repositories[index]?.repositoryRoot ?? "",
      displayName: repositories[index]?.displayName ?? "",
    })),
  };
}

describe("ComposerBranchBadge", () => {
  it("assigns stable distinct colors to repository icons", () => {
    const renderBadge = (repositoryItems: typeof repositories) => (
      <ComposerBranchBadge
        branchName="main"
        branches={[]}
        repositories={repositoryItems}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
      />
    );
    const { rerender } = render(renderBadge(repositories));

    fireEvent.click(screen.getByRole("button", { name: /main/i }));
    const colorSlotFor = (repositoryName: string) => screen
      .getByText(repositoryName)
      .closest("[cmdk-item]")
      ?.querySelector<SVGElement>(".lucide-folder-git-2")
      ?.dataset.repositoryColorSlot;
    const serviceAColorSlot = colorSlotFor("service-a");
    const serviceBColorSlot = colorSlotFor("service-b");

    expect(serviceAColorSlot).toBeDefined();
    expect(serviceBColorSlot).toBeDefined();
    expect(serviceAColorSlot).not.toBe(serviceBColorSlot);
    expect(document.querySelector(".lucide-folder-git-2.text-emerald-500")).toBeNull();

    rerender(renderBadge([...repositories].reverse()));
    expect(colorSlotFor("service-a")).toBe(serviceAColorSlot);
    expect(colorSlotFor("service-b")).toBe(serviceBColorSlot);
  });

  it("shows distinct recent/local/remote sections and Update progress/result", async () => {
    let resolveUpdate: ((value: {
      branch: string;
      status: "no-op";
      reason: "already_up_to_date";
      message: string;
    }) => void) | null = null;
    const onUpdate = vi.fn(() => new Promise<{
      branch: string;
      status: "no-op";
      reason: "already_up_to_date";
      message: string;
    }>((resolve) => {
      resolveUpdate = resolve;
    }));
    render(
      <ComposerBranchBadge
        branchName="main"
        branches={[{ name: "main", lastCommit: 2 }]}
        localBranches={[{
          name: "main",
          isCurrent: true,
          isRemote: false,
          remote: null,
          upstream: "origin/main",
          lastCommit: 2,
          headSha: "abc",
          ahead: 0,
          behind: 0,
        }]}
        remoteBranches={[{
          name: "origin/main",
          isCurrent: false,
          isRemote: true,
          remote: "origin",
          upstream: null,
          lastCommit: 2,
          headSha: "abc",
          ahead: 0,
          behind: 0,
        }]}
        repositories={repositories.slice(0, 1)}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
      />,
    );

    await act(async () => fireEvent.click(screen.getByRole("button", { name: /main/i })));
    expect(screen.getByText("git.repositoryRecentBranches")).toBeTruthy();
    expect(screen.getByText("git.repositoryLocalBranches")).toBeTruthy();
    expect(screen.getByText(/git\.repositoryRemoteBranches/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "git.repositoryRecentBranches" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "git.repositoryLocalBranches" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "git.repositoryRemoteBranches" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "git.historyBranchMenuUpdate" }).classList.contains("composer-git-header-action")).toBe(true);
    expect(screen.queryByText("git.historyBranchMenuUpdate")).toBeNull();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "main" } });
    expect(screen.getAllByText("main").length).toBeGreaterThan(1);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });

    const updateAction = screen.getByRole("button", { name: "git.historyBranchMenuUpdate" });
    await act(async () => fireEvent.click(updateAction));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".lucide-loader-circle")).not.toBeNull();
    fireEvent.click(updateAction);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveUpdate?.({
        branch: "main",
        status: "no-op",
        reason: "already_up_to_date",
        message: "already current",
      });
    });
    await waitFor(() => {
      expect(screen.getByText("git.historyBranchUpdateAlreadyUpToDate")).toBeTruthy();
    });
  });

  it("opens a single repository directly at its branch actions", async () => {
    const onSelectRepository = vi.fn();
    render(
      <ComposerBranchBadge
        branchName="main"
        branches={[{ name: "main", lastCommit: 1 }]}
        localBranches={[
          {
            name: "main",
            isCurrent: true,
            isRemote: false,
            remote: null,
            upstream: "origin/main",
            lastCommit: 1,
            headSha: "abc",
            ahead: 1,
            behind: 0,
          },
        ]}
        repositories={repositories.slice(0, 1)}
        onSelectRepository={onSelectRepository}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    await act(async () => fireEvent.click(screen.getByRole("button", { name: /main/i })));
    expect(onSelectRepository).toHaveBeenCalledWith("service-a");
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(document.querySelector(".lucide-refresh-cw")).not.toBeNull();
    expect(screen.queryByText("service-b")).toBeNull();
  });

  it("drills from repository list into scoped branches", async () => {
    const onSelectRepository = vi.fn();
    const onCheckout = vi.fn();
    const onCommit = vi.fn();
    const onPush = vi.fn();
    render(
      <ComposerBranchBadge
        branchName="main"
        branches={[{ name: "feature/test", lastCommit: 2 }]}
        localBranches={[
          {
            name: "feature/test",
            isCurrent: true,
            isRemote: false,
            remote: null,
            upstream: "origin/feature/test",
            lastCommit: 2,
            headSha: "abc",
            ahead: 0,
            behind: 2,
          },
        ]}
        repositories={repositories}
        onSelectRepository={onSelectRepository}
        onCheckout={onCheckout}
        onCreate={vi.fn()}
        onCommit={onCommit}
        onPush={onPush}
      />,
    );

    await act(async () => fireEvent.click(screen.getByRole("button", { name: /main/i })));
    await act(async () => fireEvent.click(screen.getByText("service-b")));
    expect(onSelectRepository).toHaveBeenCalledWith("service-b");

    await waitFor(() => {
      const action = screen.getByRole("button", { name: "git.commit" });
      expect(action.classList.contains("composer-git-header-action")).toBe(true);
      fireEvent.click(action);
    });
    expect(onCommit).toHaveBeenCalledWith("service-b");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: /main/i })));
    await act(async () => fireEvent.click(screen.getByText("service-b")));
    await waitFor(() => {
      const action = screen.getByRole("button", { name: "git.push" });
      expect(action.classList.contains("composer-git-header-action")).toBe(true);
      fireEvent.click(action);
    });
    expect(onPush).toHaveBeenCalledWith("service-b");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: /main/i })));
    await act(async () => fireEvent.click(screen.getByText("service-b")));
    await waitFor(() => expect(screen.getByRole("button", { name: "git.repositoryRecentBranches" })).toBeTruthy());
    await act(async () => fireEvent.click(screen.getAllByText("feature/test")[0]));
    expect(onCheckout).toHaveBeenCalledWith("feature/test");
  });

  it("runs workspace-scoped update and checkout actions from one global row", async () => {
    let resolveUpdate: ((result: {
      successCount: number;
      failedRepositories: string[];
      skippedRepositories: string[];
    }) => void) | null = null;
    const onUpdateAllRepositories = vi.fn(() => new Promise<{
      successCount: number;
      failedRepositories: string[];
      skippedRepositories: string[];
    }>((resolve) => {
      resolveUpdate = resolve;
    }));
    const onCheckoutAllRepositories = vi.fn().mockResolvedValue({
      successCount: 1,
      failedRepositories: ["service-b"],
      skippedRepositories: [],
    });
    const onLoadCommonRepositoryBranches = vi.fn().mockResolvedValue({
      localBranches: [branchCoverage("main"), branchCoverage("release/1.0")],
      remoteBranches: [branchCoverage("origin/main"), branchCoverage("origin/release")],
      failedRepositories: [],
      totalRepositoryCount: 2,
    });
    render(
      <ComposerBranchBadge
        branchName="main"
        branches={[]}
        repositories={repositories}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
        onUpdateAllRepositories={onUpdateAllRepositories}
        onCheckoutAllRepositories={onCheckoutAllRepositories}
        onLoadCommonRepositoryBranches={onLoadCommonRepositoryBranches}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /main/i }));
    const updateAll = screen.getByText("git.repositoryBatchUpdateAll").closest("[cmdk-item]") as HTMLElement;
    const checkoutAll = screen.getByText("git.repositoryBatchCheckoutAll").closest("[cmdk-item]") as HTMLElement;
    expect(updateAll.parentElement).toBe(checkoutAll.parentElement);
    expect(updateAll.classList.contains("h-7")).toBe(true);
    expect(document.querySelector("[cmdk-group-heading]")).toBeNull();

    fireEvent.click(updateAll);
    fireEvent.click(updateAll);
    expect(onUpdateAllRepositories).toHaveBeenCalledTimes(1);
    await act(async () => resolveUpdate?.({
      successCount: 2,
      failedRepositories: [],
      skippedRepositories: [],
    }));
    expect((await screen.findByRole("status")).textContent).toContain("git.repositoryBatchSummary");

    await act(async () => fireEvent.click(checkoutAll));
    expect(onLoadCommonRepositoryBranches).toHaveBeenCalledTimes(1);
    expect(screen.getByText("git.repositoryBatchCommonLocalBranches")).toBeTruthy();
    expect(screen.getByText("git.repositoryBatchCommonRemoteBranches")).toBeTruthy();
    expect(screen.getAllByText("2/2").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("service-a, service-b").length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(screen.getByText("release/1.0").closest("[cmdk-item]") as HTMLElement);
    });
    expect(onCheckoutAllRepositories).toHaveBeenCalledWith("release/1.0", ["service-a", "service-b"]);
    expect((await screen.findByRole("alert")).textContent).toContain("git.repositoryBatchFailedRepositories");
  });

  it("shows repository names when common branch discovery fails", async () => {
    render(
      <ComposerBranchBadge
        branchName="main"
        branches={[]}
        repositories={repositoriesWithThird}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
        onCheckoutAllRepositories={vi.fn()}
        onLoadCommonRepositoryBranches={vi.fn().mockResolvedValue({
          localBranches: [branchCoverage("main")],
          remoteBranches: [],
          failedRepositories: ["service-c"],
          totalRepositoryCount: 3,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /main/i }));
    await act(async () => fireEvent.click(screen.getByText("git.repositoryBatchCheckoutAll")));
    expect((await screen.findByRole("alert")).textContent).toContain("service-c");
    expect(screen.getAllByText("main").length).toBeGreaterThan(1);
    expect(screen.getByText("2/3")).toBeTruthy();
  });

  it("shows discovery progress and checks out an exact common remote ref", async () => {
    let resolveBranches: ((result: {
      localBranches: ReturnType<typeof branchCoverage>[];
      remoteBranches: ReturnType<typeof branchCoverage>[];
      failedRepositories: string[];
      totalRepositoryCount: number;
    }) => void) | null = null;
    const onLoadCommonRepositoryBranches = vi.fn(() => new Promise<{
      localBranches: ReturnType<typeof branchCoverage>[];
      remoteBranches: ReturnType<typeof branchCoverage>[];
      failedRepositories: string[];
      totalRepositoryCount: number;
    }>((resolve) => {
      resolveBranches = resolve;
    }));
    const onCheckoutAllRepositories = vi.fn().mockResolvedValue({
      successCount: 2,
      failedRepositories: [],
      skippedRepositories: [],
    });
    render(
      <ComposerBranchBadge
        branchName="main"
        branches={[]}
        repositories={repositories}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
        onCheckoutAllRepositories={onCheckoutAllRepositories}
        onLoadCommonRepositoryBranches={onLoadCommonRepositoryBranches}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /main/i }));
    fireEvent.click(screen.getByText("git.repositoryBatchCheckoutAll"));
    expect(screen.getByText("git.repositoryBatchLoadingBranches")).toBeTruthy();
    await act(async () => resolveBranches?.({
      localBranches: [],
      remoteBranches: [branchCoverage("origin/release")],
      failedRepositories: [],
      totalRepositoryCount: 2,
    }));
    await act(async () => fireEvent.click(screen.getByText("release")));
    expect(onCheckoutAllRepositories).toHaveBeenCalledWith("origin/release", ["service-a", "service-b"]);
  });

  it("shows an explicit empty state when repositories have no common branches", async () => {
    render(
      <ComposerBranchBadge
        branchName="main"
        branches={[]}
        repositories={repositories}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
        onCheckoutAllRepositories={vi.fn()}
        onLoadCommonRepositoryBranches={vi.fn().mockResolvedValue({
          localBranches: [],
          remoteBranches: [],
          failedRepositories: [],
          totalRepositoryCount: 2,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /main/i }));
    await act(async () => fireEvent.click(screen.getByText("git.repositoryBatchCheckoutAll")));
    expect(screen.getByText("git.repositoryBatchNoCommonBranches")).toBeTruthy();
  });

  it("shows repository switch progress and ignores duplicate selection", async () => {
    let resolveSelection: (() => void) | null = null;
    const onSelectRepository = vi.fn(() => new Promise<void>((resolve) => {
      resolveSelection = resolve;
    }));
    render(
      <ComposerBranchBadge
        branchName="main"
        branches={[]}
        repositories={repositories}
        onSelectRepository={onSelectRepository}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /main/i }));
    const targetRow = screen.getByText("service-b").closest("[cmdk-item]") as HTMLElement;
    fireEvent.click(targetRow);
    expect(targetRow.querySelector(".lucide-loader-circle")).not.toBeNull();
    fireEvent.click(targetRow);
    expect(onSelectRepository).toHaveBeenCalledTimes(1);

    await act(async () => resolveSelection?.());
    await waitFor(() => expect(screen.getByText("workspace.back")).toBeTruthy());
  });

  it("keeps the repository list open when switching fails", async () => {
    render(
      <ComposerBranchBadge
        branchName="main"
        branches={[]}
        repositories={repositories}
        onSelectRepository={vi.fn(async () => {
          throw new Error("switch failed");
        })}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /main/i }));
    fireEvent.click(screen.getByText("service-b"));
    expect((await screen.findByRole("alert")).textContent).toContain("switch failed");
    expect(screen.getByText("service-a")).toBeTruthy();
    expect(screen.getByText("service-b")).toBeTruthy();
  });

  it("collapses local and remote scopes independently and reveals matches during search", async () => {
    render(
      <ComposerBranchBadge
        branchName="feature/test"
        branches={[{ name: "feature/test", lastCommit: 1 }]}
        localBranches={[{
          name: "feature/test",
          isCurrent: true,
          isRemote: false,
          remote: null,
          upstream: "origin/feature/test",
          lastCommit: 1,
          headSha: "abc",
          ahead: 0,
          behind: 0,
        }]}
        remoteBranches={[{
          name: "origin/feature/test",
          isCurrent: false,
          isRemote: true,
          remote: "origin",
          upstream: null,
          lastCommit: 1,
          headSha: "abc",
          ahead: 0,
          behind: 0,
        }]}
        repositories={repositories.slice(0, 1)}
        onCheckout={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /feature\/test/i }));
    fireEvent.click(screen.getByRole("button", { name: "git.repositoryLocalBranches" }));
    const localScope = screen.getByRole("button", { name: "feature" });
    expect(localScope.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("test")).toBeNull();
    fireEvent.click(localScope);
    expect(localScope.getAttribute("aria-expanded")).toBe("true");
    const localBranchLabel = screen.getByText("test");
    expect(localBranchLabel.closest("[cmdk-item]")?.classList.contains("composer-git-branch-item")).toBe(true);
    expect(localBranchLabel.closest(".composer-git-branch-scope-children")).toBeTruthy();
    fireEvent.click(localScope);

    fireEvent.click(screen.getByRole("button", { name: "git.repositoryRemoteBranches" }));
    const remoteScope = screen.getByRole("button", { name: "origin / feature" });
    expect(remoteScope.getAttribute("aria-expanded")).toBe("false");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "feature/test" } });
    expect(localScope.getAttribute("aria-expanded")).toBe("true");
    expect(remoteScope.getAttribute("aria-expanded")).toBe("true");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(localScope.getAttribute("aria-expanded")).toBe("false");
    expect(remoteScope.getAttribute("aria-expanded")).toBe("false");
  });
});
