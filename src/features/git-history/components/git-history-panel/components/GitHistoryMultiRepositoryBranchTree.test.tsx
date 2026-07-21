/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GitRepositorySummary } from "../../../../../types";
import type { GitHistoryRepositoryBranchCatalog } from "../hooks/useGitHistoryRepositoryBranchCatalogs";
import { GitHistoryMultiRepositoryBranchTree } from "./GitHistoryMultiRepositoryBranchTree";

const repository = (repositoryRoot: string, displayName: string): GitRepositorySummary => ({
  repositoryRoot,
  displayName,
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

const catalog = (
  repositoryRoot: string,
  branchName: string,
  remoteBranchName?: string,
): GitHistoryRepositoryBranchCatalog => ({
  repositoryRoot,
  localBranches: [{
    name: branchName,
    isCurrent: branchName === "main",
    isRemote: false,
    lastCommit: 1,
    ahead: 0,
    behind: 0,
  }],
  remoteBranches: remoteBranchName ? [{
    name: remoteBranchName,
    isCurrent: false,
    isRemote: true,
    remote: "origin",
    lastCommit: 1,
    ahead: 0,
    behind: 0,
  }] : [],
  currentBranch: branchName,
  status: "ready",
  error: null,
});

const t = ((key: string, values?: Record<string, string>) =>
  values ? `${key}:${values.repository ?? values.group ?? ""}:${values.scope ?? ""}` : key) as never;

describe("GitHistoryMultiRepositoryBranchTree", () => {
  it("treats the sole empty repository root as the active repository", () => {
    const onSelectBranch = vi.fn();
    render(
      <GitHistoryMultiRepositoryBranchTree
        repositories={[repository("", "workspace-root")]}
        catalogs={new Map([["", catalog("", "main", "origin/main")]])}
        selectedRepositoryRoot={null}
        selectedBranch="main"
        query=""
        t={t}
        onSelectBranch={onSelectBranch}
      />,
    );

    expect(screen.getAllByText("workspace-root")).toHaveLength(2);
    expect(screen.getAllByText("main").length).toBeGreaterThan(0);
    fireEvent.click(document.querySelector(".git-history-multi-head") as HTMLElement);
    expect(onSelectBranch).toHaveBeenCalledWith("", "main");
  });

  it("keeps repository expansion independent and selects an exact repository branch", () => {
    const repositories = [repository("services/a", "service-a"), repository("services/b", "service-b")];
    const onSelectBranch = vi.fn();
    render(
      <GitHistoryMultiRepositoryBranchTree
        repositories={repositories}
        catalogs={new Map([
          ["services/a", catalog("services/a", "main")],
          ["services/b", catalog("services/b", "release", "origin/hotfix")],
        ])}
        selectedRepositoryRoot="services/a"
        selectedBranch="main"
        query=""
        t={t}
        onSelectBranch={onSelectBranch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /service-b:git.historyLocal/ }));
    fireEvent.click(screen.getByRole("button", { name: /release/ }));
    expect(onSelectBranch).toHaveBeenCalledWith("services/b", "release");
    fireEvent.click(screen.getByRole("button", { name: /service-b:git.historyRemote/ }));
    fireEvent.click(screen.getByRole("button", { name: /git.historyToggleRemoteGroup:origin/ }));
    fireEvent.click(screen.getByRole("button", { name: "hotfix" }));
    expect(onSelectBranch).toHaveBeenCalledWith("services/b", "origin/hotfix");
    expect(screen.getAllByRole("button", { name: /main/ }).length).toBeGreaterThan(0);
    const localSwatches = document.querySelectorAll(".git-history-multi-repository-section")[0]
      ?.querySelectorAll(".git-history-repository-swatch");
    expect(localSwatches[0]?.className).not.toBe(localSwatches[1]?.className);
  });

  it("groups local prefixes and remote names while preserving complete branch identities", () => {
    const onSelectBranch = vi.fn();
    const groupedCatalog: GitHistoryRepositoryBranchCatalog = {
      ...catalog("", "feature/v-076"),
      localBranches: [
        { name: "main", isCurrent: false, isRemote: false, lastCommit: 1, ahead: 0, behind: 0 },
        { name: "backup/snapshot", isCurrent: false, isRemote: false, lastCommit: 1, ahead: 0, behind: 0 },
        { name: "feature/v-076", isCurrent: true, isRemote: false, lastCommit: 1, ahead: 0, behind: 0 },
      ],
      remoteBranches: [
        { name: "origin/feature/v-076", isCurrent: false, isRemote: true, remote: "origin", lastCommit: 1, ahead: 0, behind: 0 },
      ],
    };
    const { rerender } = render(
      <GitHistoryMultiRepositoryBranchTree
        repositories={[repository("", "mossx")]}
        catalogs={new Map([["", groupedCatalog]])}
        selectedRepositoryRoot={null}
        selectedBranch="feature/v-076"
        query=""
        t={t}
        onSelectBranch={onSelectBranch}
      />,
    );

    expect(screen.getByRole("button", { name: "v-076HEAD" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "snapshot" })).toBeNull();
    rerender(
      <GitHistoryMultiRepositoryBranchTree
        repositories={[repository("", "mossx")]}
        catalogs={new Map([["", groupedCatalog]])}
        selectedRepositoryRoot={null}
        selectedBranch="feature/v-076"
        query="snapshot"
        t={t}
        onSelectBranch={onSelectBranch}
      />,
    );
    expect(screen.getByRole("button", { name: "snapshot" })).toBeTruthy();
    rerender(
      <GitHistoryMultiRepositoryBranchTree
        repositories={[repository("", "mossx")]}
        catalogs={new Map([["", groupedCatalog]])}
        selectedRepositoryRoot={null}
        selectedBranch="feature/v-076"
        query=""
        t={t}
        onSelectBranch={onSelectBranch}
      />,
    );
    expect(screen.queryByRole("button", { name: "snapshot" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /git.historyToggleLocalGroup:backup/ }));
    fireEvent.click(screen.getByRole("button", { name: "snapshot" }));
    expect(onSelectBranch).toHaveBeenCalledWith("", "backup/snapshot");

    fireEvent.click(screen.getByRole("button", { name: /git.historyToggleRemoteGroup:origin/ }));
    fireEvent.click(screen.getByRole("button", { name: "feature/v-076" }));
    expect(onSelectBranch).toHaveBeenCalledWith("", "origin/feature/v-076");
  });

  it("searches repository names and branches across repositories", () => {
    const repositories = [repository("services/a", "service-a"), repository("services/b", "service-b")];
    const { rerender } = render(
      <GitHistoryMultiRepositoryBranchTree
        repositories={repositories}
        catalogs={new Map([
          ["services/a", catalog("services/a", "main")],
          ["services/b", catalog("services/b", "release")],
        ])}
        selectedRepositoryRoot="services/a"
        selectedBranch="main"
        query="release"
        t={t}
        onSelectBranch={vi.fn()}
      />,
    );
    expect(screen.queryByText("service-a")).toBeNull();
    expect(screen.getByText("service-b")).toBeTruthy();

    rerender(
      <GitHistoryMultiRepositoryBranchTree
        repositories={repositories}
        catalogs={new Map([
          ["services/a", catalog("services/a", "main")],
          ["services/b", catalog("services/b", "release")],
        ])}
        selectedRepositoryRoot="services/a"
        selectedBranch="main"
        query="service-a"
        t={t}
        onSelectBranch={vi.fn()}
      />,
    );
    expect(screen.getAllByText("main").length).toBeGreaterThan(0);
  });

  it("temporarily expands a collapsed section while searching", () => {
    const repositories = [repository("services/a", "service-a")];
    const catalogs = new Map([["services/a", catalog("services/a", "main")]]);
    const { rerender } = render(
      <GitHistoryMultiRepositoryBranchTree
        repositories={repositories}
        catalogs={catalogs}
        selectedRepositoryRoot="services/a"
        selectedBranch="main"
        query=""
        t={t}
        onSelectBranch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "git.historyToggleLocalBranches" }));
    expect(screen.queryByRole("button", { name: /service-a:git.historyLocal/ })).toBeNull();

    rerender(
      <GitHistoryMultiRepositoryBranchTree
        repositories={repositories}
        catalogs={catalogs}
        selectedRepositoryRoot="services/a"
        selectedBranch="main"
        query="main"
        t={t}
        onSelectBranch={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /service-a:git.historyLocal/ })).toBeTruthy();

    rerender(
      <GitHistoryMultiRepositoryBranchTree
        repositories={repositories}
        catalogs={catalogs}
        selectedRepositoryRoot="services/a"
        selectedBranch="main"
        query=""
        t={t}
        onSelectBranch={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /service-a:git.historyLocal/ })).toBeNull();
  });

  it("preserves legacy navigation and branch status affordances", () => {
    const onSelectBranch = vi.fn();
    const branchCatalog: GitHistoryRepositoryBranchCatalog = {
      ...catalog("services/a", "feature/v-076", "origin/main"),
      localBranches: [
        { name: "main", isCurrent: false, isRemote: false, lastCommit: 1, ahead: 0, behind: 131 },
        { name: "feature/v-076", isCurrent: true, isRemote: false, lastCommit: 1, ahead: 8, behind: 0 },
      ],
      currentBranch: "feature/v-076",
    };
    render(
      <GitHistoryMultiRepositoryBranchTree
        repositories={[repository("services/a", "service-a")]}
        catalogs={new Map([["services/a", branchCatalog]])}
        selectedRepositoryRoot="services/a"
        selectedBranch="feature/v-076"
        query=""
        t={t}
        onSelectBranch={onSelectBranch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "git.historyAllBranches" }));
    expect(onSelectBranch).toHaveBeenCalledWith("services/a", "all");

    const mainBranch = screen.getByRole("button", {
      name: "maingit.historyBranchBadgeMain-131",
    });
    expect(mainBranch.querySelector(".is-special")?.textContent)
      .toBe("git.historyBranchBadgeMain");
    expect(mainBranch.querySelector(".is-ahead")).toBeNull();
    expect(mainBranch.querySelector(".is-behind")?.textContent).toBe("-131");

    const currentBranch = screen.getByRole("button", { name: "v-076HEAD+8" });
    expect(currentBranch.classList.contains("is-head-branch")).toBe(true);
    expect(currentBranch.querySelector(".is-head")?.textContent).toBe("HEAD");
    expect(currentBranch.querySelector(".is-ahead")?.textContent).toBe("+8");
    expect(currentBranch.querySelector(".is-behind")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /git.historyToggleRemoteGroup:origin/ }));
    const remoteMain = screen.getByRole("button", {
      name: "maingit.historyBranchBadgeMain",
    });
    expect(remoteMain.querySelector(".is-special")?.textContent)
      .toBe("git.historyBranchBadgeMain");
  });

  it("uses locale-independent group ordering for cross-platform parity", () => {
    const groupedCatalog: GitHistoryRepositoryBranchCatalog = {
      ...catalog("services\\api", "main"),
      localBranches: [
        { name: "éclair/one", isCurrent: false, isRemote: false, lastCommit: 1, ahead: 0, behind: 0 },
        { name: "zeta/one", isCurrent: false, isRemote: false, lastCommit: 1, ahead: 0, behind: 0 },
        { name: "Alpha/two", isCurrent: false, isRemote: false, lastCommit: 1, ahead: 0, behind: 0 },
        { name: "Alpha/one", isCurrent: false, isRemote: false, lastCommit: 1, ahead: 0, behind: 0 },
        { name: "main", isCurrent: true, isRemote: false, lastCommit: 1, ahead: 0, behind: 0 },
      ],
    };
    render(
      <GitHistoryMultiRepositoryBranchTree
        repositories={[repository("services\\api", "api")]}
        catalogs={new Map([["services\\api", groupedCatalog]])}
        selectedRepositoryRoot="services\\api"
        selectedBranch="main"
        query="api"
        t={t}
        onSelectBranch={vi.fn()}
      />,
    );

    const localSection = document.querySelectorAll(".git-history-multi-repository-section")[0];
    expect(Array.from(localSection?.querySelectorAll(".git-history-tree-scope-label") ?? [])
      .map((element) => element.textContent)).toEqual([
      "git.historyRootGroup",
      "Alpha",
      "zeta",
      "éclair",
    ]);
    expect(Array.from(localSection?.querySelectorAll(".git-history-branch-name") ?? [])
      .map((element) => element.textContent)).toEqual([
      "main",
      "one",
      "two",
      "one",
      "one",
    ]);
  });
});
