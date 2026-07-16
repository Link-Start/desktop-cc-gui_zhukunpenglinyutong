// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { TFunction } from "i18next";
import { describe, expect, it, vi } from "vitest";
import type { GitRepositorySummary } from "../../../types";
import type { FileTreeNode } from "./fileTreePanelInternals";
import {
  FileTreeNodeBranch,
  type FileTreeRowHandlers,
  type FileTreeRowRefs,
  type FileTreeRowState,
} from "./FileTreeRows";

const repository: GitRepositorySummary = {
  repositoryRoot: "services/api",
  displayName: "api",
  currentBranch: "main",
  headState: "branch",
  upstream: "origin/main",
  ahead: 1,
  behind: 0,
  stagedCount: 0,
  modifiedCount: 2,
  untrackedCount: 0,
  conflictedCount: 0,
  fileStatuses: [],
  isClean: false,
  error: null,
};

function node(name: string, path: string): FileTreeNode {
  return { name, path, type: "folder", children: [] };
}

describe("FileTreeRows repository decoration", () => {
  it("decorates only the exact nested repository folder", () => {
    const state: FileTreeRowState = {
      expandedFolders: new Set(),
      loadingLazyDirectories: new Set(),
      lazyDirectoryLoadErrors: new Map(),
      folderGitStatusMap: new Map(),
      gitStatusMap: new Map(),
      mergedGitignoredDirectories: new Set(),
      mergedGitignoredFiles: new Set(),
      gitignoredTreeNodeMap: new Map(),
      selectedNodePaths: new Set(),
      selectedNodePath: null,
      orderedSelectedNodePaths: [],
      repositorySummaryMap: new Map([[repository.repositoryRoot, repository]]),
    };
    const handlers: FileTreeRowHandlers = {
      setRangeSelection: vi.fn(),
      togglePathSelection: vi.fn(),
      setSingleSelection: vi.fn(),
      setSelectedNodePath: vi.fn(),
      setSelectedNodeType: vi.fn(),
      toggleFolderExpandedState: vi.fn(),
      loadLazyDirectoryChildren: vi.fn(),
      openPreview: vi.fn(),
      showContextMenu: vi.fn(),
      resolvePath: (path) => path,
      broadcastCrossWindowTreeDrag: vi.fn(),
      rebroadcastCrossWindowTreeDrag: vi.fn(),
    };
    const refs: FileTreeRowRefs = {
      activeCrossWindowDragPathsRef: { current: [] },
      lastCrossWindowDragBroadcastRef: { current: 0 },
      dragImageCleanupRef: { current: null },
    };
    const { container } = render(
      <>
        <FileTreeNodeBranch
          node={node("services", "services")}
          depth={1}
          state={state}
          handlers={handlers}
          refs={refs}
          t={((key: string) => key) as TFunction}
        />
        <FileTreeNodeBranch
          node={node("api", "services/api")}
          depth={2}
          state={state}
          handlers={handlers}
          refs={refs}
          t={((key: string) => key) as TFunction}
        />
      </>,
    );

    expect(container.querySelectorAll(".file-tree-row.is-git-repository")).toHaveLength(1);
    expect(screen.getByText("main")).toBeTruthy();
    expect(screen.getByText("M2")).toBeTruthy();
  });
});
