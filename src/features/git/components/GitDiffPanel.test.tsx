/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { GitLogEntry } from "../../../types";

const mockPreviewSave = vi.fn(async () => true);
const mockPreviewDiscard = vi.fn();
const mockEditableDiffReviewSurface = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="git-diff-viewer">
    {typeof props.onDirtyChange === "function" ? (
      <button type="button" onClick={() => {
        if (typeof props.onDraftActionsChange === "function") {
          (props.onDraftActionsChange as (actions: unknown) => void)({
            save: mockPreviewSave,
            discard: mockPreviewDiscard,
            isSaving: false,
          });
        }
        (props.onDirtyChange as (dirty: boolean) => void)(true);
      }}>
        Mock dirty preview
      </button>
    ) : null}
    {typeof props.onRequestClose === "function" ? (
      <button type="button" onClick={() => (props.onRequestClose as () => void)()}>
        Mock close preview
      </button>
    ) : null}
  </div>
));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "git.commit": "Commit",
        "git.committing": "Committing...",
        "git.commitMessage": "Commit message...",
        "git.staged": "Staged Changes",
        "git.unstaged": "Changes",
        "git.commitStagedChanges": "Commit staged changes",
        "git.commitAllChanges": "Commit all unstaged changes",
        "git.noChangesToCommit": "No changes to commit",
        "git.enterCommitMessage": "Enter commit message",
        "git.selectFilesToCommit": "Select files to commit first",
        "git.selectedFilesForCommit": "{{count}} file selected for commit",
        "git.selectedFilesForCommit_other": "{{count}} files selected for commit",
        "git.commitSelectedChanges": "Commit selected changes",
        "git.commitSelectionToggleFile": "Toggle commit selection: {{path}}",
        "git.commitSelectionToggleScope": "Toggle commit selection: {{path}}",
        "git.sectionActions": "{{title}} actions",
        "git.commitRestoreSelectionFailed": "Commit completed, but failed to restore excluded staged files: {{error}}",
        "git.generateCommitMessage": "Generate commit message",
        "git.generateCommitMessageStaged": "Generate commit message from staged changes",
        "git.generateCommitMessageUnstaged": "Generate commit message from unstaged changes",
        "git.generateCommitMessageChinese": "Generate Chinese commit message",
        "git.generateCommitMessageEnglish": "Generate English commit message",
        "git.generateCommitMessageEngineCodex": "Use Codex engine",
        "git.generateCommitMessageEngineClaude": "Use Claude engine",
        "git.generateCommitMessageEngineGemini": "Use Gemini engine",
        "git.generateCommitMessageEngineOpenCode": "Use OpenCode engine",
        "git.generateCommitMessageLastConfig": "Use last configuration",
        "git.listFlat": "Flat",
        "git.listTree": "Tree",
        "git.listView": "List view",
        "git.refreshStatus": "Refresh Git status",
        "git.toggleCommitSection": "Toggle commit section",
        "git.panelView": "Git panel view",
        "git.previewInline": "Preview in center pane",
        "git.previewInlineAction": "Preview diff in center pane",
        "git.previewModal": "Preview in modal",
        "git.previewModalAction": "Open diff preview modal",
        "git.diffMode": "Diff",
        "git.diffModeDescription": "Inspect file changes",
        "git.logMode": "Git",
        "git.logModeDescription": "Browse commits and history",
        "git.issuesMode": "Issues",
        "git.issuesModeDescription": "Track repository issues",
        "git.prsMode": "PRs",
        "git.prsModeDescription": "Review pull requests",
        "git.fileActions": "File actions",
        "git.stageFile": "Stage file",
        "git.stageChanges": "Stage changes",
        "git.stageAllChangesAction": "Stage all changes",
        "git.path": "Path:",
        "git.change": "Switch",
        "git.unstageFile": "Unstage file",
        "git.unstageChanges": "Unstage changes",
        "git.unstageAllChangesAction": "Unstage all changes",
        "git.discardChanges": "Discard changes",
        "git.discardChange": "Discard change",
        "git.statusUnavailable": "Git status unavailable",
        "git.noRepositoriesFound": "No repositories found.",
        "git.historyQuickAction": "Hub",
        "git.switchRepository": "Switch Git repository",
        "git.switchRepositoryDescription": "Choose which repo the Diff panel uses",
        "menu.maximize": "Maximize",
        "common.restore": "Restore",
        "common.close": "Close",
        "files.unsavedChanges": "Unsaved changes",
        "files.unsavedChangesCloseDescription": "Changes will be lost.",
        "files.saveAndClose": "Save and close",
        "files.saving": "Saving...",
        "files.continueEditing": "Continue editing",
        "files.discardChangesAction": "Discard changes",
      };
      const template = translations[key] ?? key;
      if (!options) {
        return template;
      }
      return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(options[token] ?? ""));
    },
    i18n: {
      language: "en",
      changeLanguage: vi.fn(),
    },
  }),
}));

vi.mock("./WorkspaceEditableDiffReviewSurface", () => ({
  WorkspaceEditableDiffReviewSurface: (props: Record<string, unknown>) =>
    mockEditableDiffReviewSurface(props),
}));

import {
  GitDiffPanel,
  buildDiffTree,
  compactDiffTree,
  resolveRepositoryWorkspaceFilePath,
} from "./GitDiffPanel";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(async () => true),
}));

const logEntries: GitLogEntry[] = [];

const baseProps = {
  mode: "diff" as const,
  onModeChange: vi.fn(),
  filePanelMode: "git" as const,
  onFilePanelModeChange: vi.fn(),
  branchName: "main",
  totalAdditions: 0,
  totalDeletions: 0,
  fileStatus: "1 file changed",
  logEntries,
  stagedFiles: [],
  unstagedFiles: [],
};

afterEach(() => {
  cleanup();
  mockEditableDiffReviewSurface.mockClear();
  mockPreviewSave.mockReset();
  mockPreviewSave.mockResolvedValue(true);
  mockPreviewDiscard.mockReset();
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockResolvedValue(null);
  window.localStorage.clear();
});

async function chooseCodexEnglishCommitMessage() {
  fireEvent.click(screen.getByRole("button", { name: "Generate commit message" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Use Codex engine" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Generate English commit message" }));
}

describe("GitDiffPanel", () => {
  it("renders single-repository changes above the bottom commit composer", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        stagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
        commitMessage="fix: bottom composer"
        onCommit={vi.fn()}
        onGenerateCommitMessage={vi.fn()}
      />,
    );

    const content = document.querySelector(".diff-commit-workspace-content");
    const composer = document.querySelector(".git-commit-composer");
    expect(content).toBeTruthy();
    expect(composer).toBeTruthy();
    expect(Boolean(
      content && composer &&
      (content.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING),
    )).toBe(true);
  });

  it("maps nested repository diff paths to cross-platform workspace file paths", () => {
    expect(resolveRepositoryWorkspaceFilePath("/workspace", "services/api", "src/App.tsx"))
      .toBe("services/api/src/App.tsx");
    expect(resolveRepositoryWorkspaceFilePath(
      "C:\\workspace",
      "services\\api",
      "src\\App.tsx",
    )).toBe("services/api/src/App.tsx");
    expect(resolveRepositoryWorkspaceFilePath("/workspace", "services/api", "services/api/src/App.tsx"))
      .toBe("services/api/src/App.tsx");
  });

  it("passes the nested repository workspace path into the preview loader", async () => {
    render(
      <GitDiffPanel
        {...baseProps}
        workspaceId="workspace-1"
        workspacePath="/workspace"
        gitRoot="/workspace/services/api"
        unstagedFiles={[{ path: "src/App.tsx", status: "M", additions: 1, deletions: 1 }]}
        diffEntries={[{ path: "src/App.tsx", status: "M", diff: "@@ -1 +1 @@\n-old\n+new" }]}
        modalPreviewRequest={{ path: "src/App.tsx", requestId: 77, maximized: true }}
      />,
    );

    await waitFor(() => {
      expect(mockEditableDiffReviewSurface).toHaveBeenCalled();
    });
    const previewProps = mockEditableDiffReviewSurface.mock.lastCall?.[0] as {
      files?: Array<{ workspaceRelativeFilePath?: string }>;
      fullDiffLoader?: (path: string) => Promise<string>;
    };
    expect(previewProps.files?.[0]?.workspaceRelativeFilePath)
      .toBe("services/api/src/App.tsx");
    await previewProps.fullDiffLoader?.("src/App.tsx");
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_git_file_full_diff", {
      workspaceId: "workspace-1",
      path: "src/App.tsx",
      repositoryRoot: "services/api",
    });
  });
  it("disables commit and shows explicit hint when only unstaged changes exist", () => {
    const onCommit = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        commitMessage="feat: add thing"
        onCommit={onCommit}
        onGenerateCommitMessage={vi.fn()}
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );
    const commitButton = screen.getByRole("button", { name: "Commit" });
    expect((commitButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Select files to commit first")).toBeTruthy();
    fireEvent.click(commitButton);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("builds a nested tree from file paths", () => {
    const tree = buildDiffTree(
      [
        { path: "src/app/main.tsx", status: "M", additions: 1, deletions: 0 },
        { path: "src/git/GitDiffPanel.tsx", status: "A", additions: 2, deletions: 0 },
        { path: "README.md", status: "M", additions: 1, deletions: 1 },
      ],
      "unstaged",
    );

    expect(tree.folders.has("src")).toBe(true);
    expect(tree.files.map((entry) => entry.path)).toEqual(["README.md"]);
    const srcNode = tree.folders.get("src");
    expect(srcNode?.folders.has("app")).toBe(true);
    expect(srcNode?.folders.has("git")).toBe(true);
  });

  it("renders diff-only fallback rows as preview-only entries", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        unstagedFiles={[
          {
            path: "src/new-file.ts",
            status: "A",
            additions: 1,
            deletions: 0,
            isDiffOnlyFallback: true,
            mutationDisabled: true,
          },
        ]}
        onStageFile={vi.fn()}
        onRevertFile={vi.fn()}
        onGenerateCommitMessage={vi.fn()}
      />,
    );

    const row = screen.getByLabelText("src/new-file.ts");
    expect(row.getAttribute("data-diff-only-fallback")).toBe("true");
    expect(screen.queryByRole("button", { name: "Stage file" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Discard change" })).toBeNull();
    expect(
      screen.queryByRole("checkbox", {
        name: "Toggle commit selection: src/new-file.ts",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Preview diff in center pane" }),
    ).toBeTruthy();
  });

  it("invokes manual git status and diff refresh from the repository summary action", () => {
    const onRefreshGitStatus = vi.fn();
    const onRefreshGitDiffs = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/ccgui"
        onRefreshGitStatus={onRefreshGitStatus}
        onRefreshGitDiffs={onRefreshGitDiffs}
        unstagedFiles={[
          { path: "src/App.tsx", status: "M", additions: 2, deletions: 1 },
        ]}
      />,
    );

    const refreshButton = screen.getByRole("button", { name: "Refresh Git status" });
    const refreshAction = refreshButton.closest(".diff-tree-summary-root-action");
    const sectionHeader = refreshButton.closest(".git-filetree-section-header");

    expect(sectionHeader?.textContent).not.toContain("ccgui");
    expect(sectionHeader?.lastElementChild?.classList.contains("diff-section-count-badge")).toBe(true);
    expect(refreshAction?.parentElement).toBe(sectionHeader);

    fireEvent.click(refreshButton);

    expect(onRefreshGitStatus).toHaveBeenCalledTimes(1);
    expect(onRefreshGitDiffs).toHaveBeenCalledTimes(1);
  });

  it("spins the manual git status refresh icon when clicked", () => {
    vi.useFakeTimers();
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(performance.now());
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const onRefreshGitStatus = vi.fn();

    render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/ccgui"
        onRefreshGitStatus={onRefreshGitStatus}
        unstagedFiles={[
          { path: "src/App.tsx", status: "M", additions: 2, deletions: 1 },
        ]}
      />,
    );

    const refreshButton = screen.getByRole("button", { name: "Refresh Git status" });

    fireEvent.click(refreshButton);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(refreshButton.className).toContain("is-spinning");
    expect(onRefreshGitStatus).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(520);
    });
    expect(refreshButton.className).not.toContain("is-spinning");

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    vi.useRealTimers();
  });

  it("marks deleted rows with a stable deleted status hook", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        unstagedFiles={[
          { path: "src/old-file.ts", status: "D", additions: 0, deletions: 1 },
        ]}
        onRevertFile={vi.fn()}
        onGenerateCommitMessage={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("src/old-file.ts").getAttribute("data-status")).toBe("D");
  });

  it("builds a nested tree from Windows-style file paths", () => {
    const tree = buildDiffTree(
      [
        { path: "src\\app\\main.tsx", status: "M", additions: 1, deletions: 0 },
        { path: "README.md", status: "M", additions: 1, deletions: 1 },
      ],
      "unstaged",
    );

    expect(tree.folders.has("src")).toBe(true);
    const srcNode = tree.folders.get("src");
    expect(srcNode?.folders.has("app")).toBe(true);
    expect(tree.files.map((entry) => entry.path)).toEqual(["README.md"]);
  });

  it("keeps compact folder entries distinct when dotted display labels collide", () => {
    const tree = compactDiffTree(
      buildDiffTree(
        [
          { path: "a.b/file-a.ts", status: "M", additions: 1, deletions: 0 },
          { path: "a/b/file-b.ts", status: "M", additions: 1, deletions: 0 },
        ],
        "unstaged",
      ),
    );

    const folders = Array.from(tree.folders.values());
    expect(folders.map((folder) => folder.name)).toEqual(["a.b", "a.b"]);
    expect(folders.map((folder) => folder.key).sort()).toEqual([
      "unstaged:/a.b/",
      "unstaged:/a/b/",
    ]);
    expect(folders.flatMap((folder) => folder.files.map((file) => file.path)).sort()).toEqual([
      "a.b/file-a.ts",
      "a/b/file-b.ts",
    ]);
  });

  it("supports tree keyboard navigation and Enter-to-open", () => {
    const onSelectFile = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="tree"
        unstagedFiles={[
          { path: "a.ts", status: "M", additions: 1, deletions: 0 },
          { path: "b.ts", status: "M", additions: 1, deletions: 0 },
        ]}
        onSelectFile={onSelectFile}
      />,
    );

    const firstRow = document.querySelector<HTMLElement>('.diff-row[data-path="a.ts"]');
    const secondRow = document.querySelector<HTMLElement>('.diff-row[data-path="b.ts"]');
    expect(firstRow).toBeTruthy();
    expect(secondRow).toBeTruthy();
    firstRow?.focus();
    fireEvent.keyDown(firstRow as HTMLElement, { key: "ArrowDown" });
    expect(document.activeElement).toBe(secondRow);
    fireEvent.keyDown(secondRow as HTMLElement, { key: "Enter" });
    expect(onSelectFile).toHaveBeenCalledWith("b.ts");
  });

  it("opens engine menu then language menu before generating commit message", async () => {
    const onGenerateCommitMessage = vi.fn();

    render(
      <GitDiffPanel
        {...baseProps}
        onGenerateCommitMessage={onGenerateCommitMessage}
        unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Generate commit message" }));
    expect(await screen.findByRole("menuitem", { name: "Use Codex engine" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Use Claude engine" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Use Gemini engine" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Use OpenCode engine" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Use Codex engine" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Generate English commit message" }));

    await waitFor(() => {
      expect(onGenerateCommitMessage).toHaveBeenCalledWith("en", "codex");
    });
  });

  it("forwards repository-scoped selections from the multi-repository AI button", async () => {
    const onGenerateCommitMessage = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        workspaceId="ws-1"
        multiRepositoryMode
        repositoryStatuses={[
          {
            repositoryRoot: "services/api",
            displayName: "api",
            branchName: "main",
            stagedFiles: [],
            unstagedFiles: [
              { path: "pom.xml", status: "M", additions: 1, deletions: 0 },
            ],
            totalAdditions: 1,
            totalDeletions: 0,
            error: null,
          },
        ]}
        commitMessage=""
        onGenerateCommitMessage={onGenerateCommitMessage}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", {
      name: "Toggle commit selection: pom.xml",
    }));
    await chooseCodexEnglishCommitMessage();

    await waitFor(() => {
      expect(onGenerateCommitMessage).toHaveBeenCalledWith(
        "en",
        "codex",
        undefined,
        [{ repositoryRoot: "services/api", selectedPaths: ["pom.xml"] }],
      );
    });
  });

  it("forwards repository identity when a multi-repository file row opens", () => {
    const onOpenFile = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        workspaceId="ws-1"
        multiRepositoryMode
        repositoryStatuses={[
          {
            repositoryRoot: "services/api",
            displayName: "api",
            branchName: "main",
            stagedFiles: [],
            unstagedFiles: [
              { path: "pom.xml", status: "M", additions: 1, deletions: 0 },
            ],
            totalAdditions: 1,
            totalDeletions: 0,
            error: null,
          },
        ]}
        onOpenFile={onOpenFile}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "pom.xml" }));

    expect(onOpenFile).toHaveBeenCalledWith("pom.xml", "services/api");
  });

  it("opens the latest repository-scoped modal preview without same-path cross-talk", async () => {
    let resolveFirstRepository: ((value: unknown) => void) | null = null;
    vi.mocked(invoke).mockImplementation((command, args) => {
      const repositoryRoot = args && !Array.isArray(args)
        ? (args as Record<string, unknown>).repositoryRoot
        : undefined;
      if (command === "get_git_diffs" && repositoryRoot === "services/a") {
        return new Promise((resolve) => {
          resolveFirstRepository = resolve;
        });
      }
      if (command === "get_git_diffs" && repositoryRoot === "services/b") {
        return Promise.resolve([{
          path: "pom.xml",
          status: "M",
          diff: "@@ -1 +1 @@\n-old-b\n+new-b",
        }]);
      }
      if (command === "get_git_file_full_diff") {
        return Promise.resolve("full scoped diff");
      }
      return Promise.resolve(null);
    });

    render(
      <GitDiffPanel
        {...baseProps}
        workspaceId="ws-1"
        workspacePath="/workspace"
        multiRepositoryMode
        repositoryStatuses={[
          {
            repositoryRoot: "services/a",
            displayName: "a",
            branchName: "main",
            stagedFiles: [],
            unstagedFiles: [{ path: "pom.xml", status: "M", additions: 1, deletions: 1 }],
            totalAdditions: 1,
            totalDeletions: 1,
            error: null,
          },
          {
            repositoryRoot: "services/b",
            displayName: "b",
            branchName: "main",
            stagedFiles: [],
            unstagedFiles: [{ path: "pom.xml", status: "M", additions: 1, deletions: 1 }],
            totalAdditions: 1,
            totalDeletions: 1,
            error: null,
          },
        ]}
      />,
    );

    const previewButtons = document.querySelectorAll<HTMLButtonElement>(
      '.diff-row[data-path="pom.xml"] .diff-row-action--preview-modal',
    );
    expect(previewButtons).toHaveLength(2);
    fireEvent.click(previewButtons[0]);
    fireEvent.click(previewButtons[1]);

    await waitFor(() => {
      expect(mockEditableDiffReviewSurface).toHaveBeenCalled();
    });
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_git_diffs", {
      workspaceId: "ws-1",
      repositoryRoot: "services/a",
    });
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_git_diffs", {
      workspaceId: "ws-1",
      repositoryRoot: "services/b",
    });

    const latestPreviewProps = mockEditableDiffReviewSurface.mock.lastCall?.[0] as {
      files?: Array<{ diff?: string; workspaceRelativeFilePath?: string }>;
      fullDiffLoader?: (path: string) => Promise<string>;
    };
    expect(latestPreviewProps.files?.[0]).toMatchObject({
      diff: "@@ -1 +1 @@\n-old-b\n+new-b",
      workspaceRelativeFilePath: "services/b/pom.xml",
    });
    await latestPreviewProps.fullDiffLoader?.("pom.xml");
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_git_file_full_diff", {
      workspaceId: "ws-1",
      path: "pom.xml",
      repositoryRoot: "services/b",
    });

    await act(async () => {
      resolveFirstRepository?.([{
        path: "pom.xml",
        status: "M",
        diff: "@@ -1 +1 @@\n-old-a\n+new-a",
      }]);
    });
    const settledPreviewProps = mockEditableDiffReviewSurface.mock.lastCall?.[0] as {
      files?: Array<{ diff?: string; workspaceRelativeFilePath?: string }>;
    };
    expect(settledPreviewProps.files?.[0]).toMatchObject({
      diff: "@@ -1 +1 @@\n-old-b\n+new-b",
      workspaceRelativeFilePath: "services/b/pom.xml",
    });
  });

  it("invalidates a pending repository preview when the workspace changes", async () => {
    let resolveOldWorkspace: ((value: unknown) => void) | null = null;
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "get_git_diffs") {
        return new Promise((resolve) => {
          resolveOldWorkspace = resolve;
        });
      }
      return Promise.resolve(null);
    });
    const repositoryStatuses = [{
      repositoryRoot: "services/api",
      displayName: "api",
      branchName: "main",
      stagedFiles: [],
      unstagedFiles: [{ path: "pom.xml", status: "M", additions: 1, deletions: 1 }],
      totalAdditions: 1,
      totalDeletions: 1,
      error: null,
    }];
    const { rerender } = render(
      <GitDiffPanel
        {...baseProps}
        workspaceId="workspace-a"
        workspacePath="/workspace-a"
        multiRepositoryMode
        repositoryStatuses={repositoryStatuses}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open diff preview modal" }));
    expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();

    rerender(
      <GitDiffPanel
        {...baseProps}
        workspaceId="workspace-b"
        workspacePath="/workspace-b"
        multiRepositoryMode
        repositoryStatuses={repositoryStatuses}
      />,
    );
    await waitFor(() => {
      expect(document.querySelector(".git-history-diff-modal")).toBeNull();
    });

    await act(async () => {
      resolveOldWorkspace?.([{
        path: "pom.xml",
        status: "M",
        diff: "@@ -1 +1 @@\n-old-a\n+new-a",
      }]);
    });
    expect(document.querySelector(".git-history-diff-modal")).toBeNull();
  });

  it("preserves an explicit workspace-root repository scope", async () => {
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "get_git_diffs") {
        return Promise.resolve([{
          path: "pom.xml",
          status: "M",
          diff: "@@ -1 +1 @@\n-old\n+new",
        }]);
      }
      if (command === "get_git_file_full_diff") {
        return Promise.resolve("full root diff");
      }
      return Promise.resolve(null);
    });
    render(
      <GitDiffPanel
        {...baseProps}
        workspaceId="workspace-1"
        workspacePath="/workspace"
        multiRepositoryMode
        repositoryStatuses={[{
          repositoryRoot: "",
          displayName: "workspace",
          branchName: "main",
          stagedFiles: [],
          unstagedFiles: [{ path: "pom.xml", status: "M", additions: 1, deletions: 1 }],
          totalAdditions: 1,
          totalDeletions: 1,
          error: null,
        }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open diff preview modal" }));
    await waitFor(() => expect(mockEditableDiffReviewSurface).toHaveBeenCalled());
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_git_diffs", {
      workspaceId: "workspace-1",
      repositoryRoot: "",
    });
    const latestPreviewProps = mockEditableDiffReviewSurface.mock.lastCall?.[0] as {
      fullDiffLoader?: (path: string) => Promise<string>;
    };
    await latestPreviewProps.fullDiffLoader?.("pom.xml");
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_git_file_full_diff", {
      workspaceId: "workspace-1",
      path: "pom.xml",
      repositoryRoot: "",
    });
  });

  it("does not reopen a repository preview closed while its request is pending", async () => {
    let resolvePendingPreview: ((value: unknown) => void) | null = null;
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "get_git_diffs") {
        return new Promise((resolve) => {
          resolvePendingPreview = resolve;
        });
      }
      return Promise.resolve(null);
    });
    render(
      <GitDiffPanel
        {...baseProps}
        workspaceId="workspace-1"
        workspacePath="/workspace"
        multiRepositoryMode
        repositoryStatuses={[{
          repositoryRoot: "services/api",
          displayName: "api",
          branchName: "main",
          stagedFiles: [],
          unstagedFiles: [{ path: "pom.xml", status: "M", additions: 1, deletions: 1 }],
          totalAdditions: 1,
          totalDeletions: 1,
          error: null,
        }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open diff preview modal" }));
    const overlay = document.querySelector<HTMLElement>(".git-history-diff-modal-overlay");
    if (!overlay) {
      throw new Error("Expected repository preview overlay to open");
    }
    fireEvent.click(overlay);
    expect(document.querySelector(".git-history-diff-modal")).toBeNull();

    await act(async () => {
      resolvePendingPreview?.([{
        path: "pom.xml",
        status: "M",
        diff: "@@ -1 +1 @@\n-old\n+new",
      }]);
    });
    expect(document.querySelector(".git-history-diff-modal")).toBeNull();
  });

  it("settles a failed repository preview to unavailable", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "get_git_diffs") {
        return Promise.reject(new Error("scoped diff failed"));
      }
      return Promise.resolve(null);
    });
    render(
      <GitDiffPanel
        {...baseProps}
        workspaceId="workspace-1"
        workspacePath="/workspace"
        multiRepositoryMode
        repositoryStatuses={[{
          repositoryRoot: "services/api",
          displayName: "api",
          branchName: "main",
          stagedFiles: [],
          unstagedFiles: [{ path: "pom.xml", status: "M", additions: 1, deletions: 1 }],
          totalAdditions: 1,
          totalDeletions: 1,
          error: null,
        }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open diff preview modal" }));
    expect(await screen.findByText("git.diffUnavailable")).toBeTruthy();
    expect(screen.queryByText("common.loading")).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to load repository-scoped git diff",
      expect.any(Error),
    );
  });

  it("closes a single-repository preview when the selected git root changes", async () => {
    const previewProps = {
      ...baseProps,
      workspaceId: "workspace-1",
      workspacePath: "/workspace",
      gitRoot: "services/a",
      unstagedFiles: [{ path: "pom.xml", status: "M", additions: 1, deletions: 1 }],
      diffEntries: [{
        path: "pom.xml",
        status: "M",
        diff: "@@ -1 +1 @@\n-old\n+new",
      }],
    };
    const { rerender } = render(<GitDiffPanel {...previewProps} />);

    fireEvent.doubleClick(screen.getByLabelText("pom.xml"));
    expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();

    rerender(<GitDiffPanel {...previewProps} gitRoot="services/b" />);
    await waitFor(() => {
      expect(document.querySelector(".git-history-diff-modal")).toBeNull();
    });
  });

  it("disables the last-config quick option when no previous generation exists", async () => {
    render(
      <GitDiffPanel
        {...baseProps}
        onGenerateCommitMessage={vi.fn()}
        unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Generate commit message" }));

    const quickOption = await screen.findByRole("menuitem", {
      name: "Use last configuration",
    });
    expect((quickOption as HTMLButtonElement).disabled).toBe(true);
  });

  it("regenerates directly with the remembered engine and language from the quick option", async () => {
    const onGenerateCommitMessage = vi.fn();

    render(
      <GitDiffPanel
        {...baseProps}
        onGenerateCommitMessage={onGenerateCommitMessage}
        unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
      />,
    );
    await chooseCodexEnglishCommitMessage();
    await waitFor(() => {
      expect(onGenerateCommitMessage).toHaveBeenCalledWith("en", "codex");
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate commit message" }));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Use last configuration" }),
    );

    await waitFor(() => {
      expect(onGenerateCommitMessage).toHaveBeenCalledTimes(2);
    });
    expect(onGenerateCommitMessage).toHaveBeenLastCalledWith("en", "codex");
  });

  it("passes selected commit scope when generating commit message from the commit section", async () => {
    const onGenerateCommitMessage = vi.fn();

    render(
      <GitDiffPanel
        {...baseProps}
        onGenerateCommitMessage={onGenerateCommitMessage}
        unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Toggle commit selection: file.txt" }),
    );
    await chooseCodexEnglishCommitMessage();

    await waitFor(() => {
      expect(onGenerateCommitMessage).toHaveBeenCalledWith("en", "codex", [
        "file.txt",
      ]);
    });
  });

  it("passes an explicit empty scope after the user clears staged defaults", async () => {
    const onGenerateCommitMessage = vi.fn();

    render(
      <GitDiffPanel
        {...baseProps}
        onGenerateCommitMessage={onGenerateCommitMessage}
        stagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Toggle commit selection: file.txt" }),
    );
    await chooseCodexEnglishCommitMessage();

    await waitFor(() => {
      expect(onGenerateCommitMessage).toHaveBeenCalledWith("en", "codex", []);
    });
  });

  it("keeps an explicit empty scope after the user selects and re-clears an unstaged file", async () => {
    const onGenerateCommitMessage = vi.fn();

    render(
      <GitDiffPanel
        {...baseProps}
        onGenerateCommitMessage={onGenerateCommitMessage}
        unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
      />,
    );
    const selectionToggle = screen.getByRole("checkbox", {
      name: "Toggle commit selection: file.txt",
    });
    fireEvent.click(selectionToggle);
    fireEvent.click(selectionToggle);
    await chooseCodexEnglishCommitMessage();

    await waitFor(() => {
      expect(onGenerateCommitMessage).toHaveBeenCalledWith("en", "codex", []);
    });
  });

  it("shows spinning engine icon while generating commit message", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        commitMessageLoading
        onGenerateCommitMessage={vi.fn()}
        unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
      />,
    );
    expect(document.querySelector(".commit-message-engine-icon--spinning")).toBeTruthy();
  });

  it("applies unified file-tree semantic classes without diff stat badges", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="tree"
        stagedFiles={[
          { path: "src/core/a.ts", status: "M", additions: 2, deletions: 1 },
        ]}
      />,
    );

    const section = document.querySelector(".diff-section.git-filetree-section");
    const folderRow = document.querySelector(".diff-tree-folder-row.git-filetree-folder-row");
    const fileRow = document.querySelector(".diff-row.git-filetree-row.git-filetree-row--tree");
    const fileRowChildren = Array.from(fileRow?.children ?? []);

    expect(section).toBeTruthy();
    expect(folderRow).toBeTruthy();
    expect(fileRow).toBeTruthy();
    expect(fileRowChildren[0]?.classList.contains("diff-status-letter")).toBe(true);
    expect(fileRowChildren[1]?.classList.contains("diff-file-icon")).toBe(true);
    expect(fileRow?.querySelector(".diff-row-meta .diff-status-letter")).toBeNull();
    expect(document.querySelector(".diff-counts-inline.git-filetree-badge")).toBeNull();
  });

  it("does not render inline file stats in the compact Source Control list", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        unstagedFiles={[
          {
            path: "src/large.ts",
            status: "M",
            additions: 12_345,
            deletions: 10_001,
          },
        ]}
      />,
    );

    expect(screen.queryByText("+12.3k")).toBeNull();
    expect(screen.queryByText("-10k")).toBeNull();
    expect(document.querySelector(".diff-counts-inline.git-filetree-badge")).toBeNull();
  });

  it("renders single-path diff package folders in a.b.c style", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="tree"
        unstagedFiles={[
          {
            path: "test/java/com/example/demo/service/UserServiceTest.java",
            status: "M",
            additions: 95,
            deletions: 2,
          },
        ]}
      />,
    );

    expect(screen.getByText("test.java.com.example.demo.service")).toBeTruthy();
    expect(screen.queryByText("java")).toBeNull();
    expect(screen.queryByText("com")).toBeNull();
  });

  it("keeps diff folder branches unmerged when a folder contains files and child folders", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="tree"
        unstagedFiles={[
          { path: "service/UserService.java", status: "M", additions: 42, deletions: 2 },
          { path: "service/impl/UserServiceImpl.java", status: "M", additions: 57, deletions: 3 },
        ]}
      />,
    );

    expect(screen.getByText("service")).toBeTruthy();
    expect(screen.queryByText("service.impl")).toBeNull();
    expect(screen.getByText("impl")).toBeTruthy();
  });

  it("renders compact tree summary in single-section tree mode", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="tree"
        gitRoot="/repo/desktop-cc-gui"
        totalAdditions={1}
        totalDeletions={1}
        unstagedFiles={[{ path: "src/main.css", status: "M", additions: 1, deletions: 1 }]}
      />,
    );

    expect(document.querySelector(".git-filetree-section-header.is-compact")).toBeTruthy();
    expect(screen.getByText("desktop-cc-gui")).toBeTruthy();
    expect(screen.getByLabelText("Changes (1)")).toBeTruthy();
  });

  it("keeps staged and unstaged tree sections visually consistent", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="tree"
        gitRoot="/repo/codex-2026-03-12-v0.2.7"
        totalAdditions={12}
        totalDeletions={3}
        stagedFiles={[{ path: "src/staged.ts", status: "M", additions: 8, deletions: 1 }]}
        unstagedFiles={[{ path: "src/unstaged.ts", status: "M", additions: 4, deletions: 2 }]}
      />,
    );

    expect(document.querySelectorAll(".git-filetree-section-header.is-compact")).toHaveLength(2);
    expect(screen.getAllByText("codex-2026-03-12-v0.2.7")).toHaveLength(2);
  });

  it("renders compact flat summary in single-section flat mode", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        gitRoot="/repo/desktop-cc-gui"
        totalAdditions={302}
        totalDeletions={10}
        stagedFiles={[{ path: "src/main.css", status: "M", additions: 302, deletions: 10 }]}
      />,
    );

    const header = document.querySelector(".git-filetree-section-header.is-compact");
    expect(header).toBeTruthy();
    expect(screen.queryByText("1 file changed")).toBeNull();
    expect(screen.queryByText("desktop-cc-gui")).toBeNull();
    expect(screen.getByLabelText("Staged Changes (1)")).toBeTruthy();
    expect(header?.lastElementChild?.classList.contains("diff-section-count-badge")).toBe(true);
    expect(header?.lastElementChild?.textContent).toBe("1");
    expect(header?.lastElementChild?.getAttribute("data-slot")).toBe("badge");
    expect(header?.lastElementChild?.className).toContain("bg-secondary");
    expect(header?.lastElementChild?.className).toContain("text-secondary-foreground");
    expect(header?.lastElementChild?.className).toContain("sm:min-w-4");
  });

  it("collapses and expands a flat section from the section header", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        stagedFiles={[
          { path: "src/alpha.ts", status: "M", additions: 1, deletions: 0 },
          { path: "src/beta.ts", status: "M", additions: 2, deletions: 1 },
        ]}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Staged Changes (2)" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("src/alpha.ts")).toBeTruthy();

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("src/alpha.ts")).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("src/alpha.ts")).toBeTruthy();
  });

  it("collapses and expands a tree section from the section header", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="tree"
        gitRoot="/repo/desktop-cc-gui"
        unstagedFiles={[
          { path: "src/alpha.ts", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Changes (1)" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("desktop-cc-gui")).toBeTruthy();
    expect(screen.getByLabelText("src/alpha.ts")).toBeTruthy();

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("src/alpha.ts")).toBeNull();
  });

  it("toggles list view via shortcut when panel is focused", () => {
    const onGitDiffListViewChange = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        onGitDiffListViewChange={onGitDiffListViewChange}
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const focusAnchor = screen.getByRole("button", { name: "Git panel view" });
    focusAnchor.focus();
    fireEvent.keyDown(window, { key: "V", altKey: true, shiftKey: true });
    expect(onGitDiffListViewChange).toHaveBeenCalledWith("tree");
  });

  it("uses configured shortcut for list view toggle", () => {
    const onGitDiffListViewChange = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        onGitDiffListViewChange={onGitDiffListViewChange}
        toggleGitDiffListViewShortcut="alt+shift+x"
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const focusAnchor = screen.getByRole("button", { name: "Git panel view" });
    focusAnchor.focus();
    fireEvent.keyDown(window, { key: "V", altKey: true, shiftKey: true });
    expect(onGitDiffListViewChange).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "X", altKey: true, shiftKey: true });
    expect(onGitDiffListViewChange).toHaveBeenCalledWith("tree");
  });

  it("disables list view toggle when configured shortcut is cleared", () => {
    const onGitDiffListViewChange = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        onGitDiffListViewChange={onGitDiffListViewChange}
        toggleGitDiffListViewShortcut={null}
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const focusAnchor = screen.getByRole("button", { name: "Git panel view" });
    focusAnchor.focus();
    fireEvent.keyDown(window, { key: "V", altKey: true, shiftKey: true });
    expect(onGitDiffListViewChange).not.toHaveBeenCalled();
  });

  it("does not toggle list view shortcut while editing textarea", () => {
    const onGitDiffListViewChange = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        onGitDiffListViewChange={onGitDiffListViewChange}
        commitMessage="chore: test"
        onGenerateCommitMessage={vi.fn()}
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );
    const textarea = screen.getAllByPlaceholderText("Commit message...")[0];
    if (!textarea) {
      throw new Error("Commit textarea not found");
    }
    textarea.focus();
    fireEvent.keyDown(textarea, { key: "V", altKey: true, shiftKey: true });
    expect(onGitDiffListViewChange).not.toHaveBeenCalled();
  });

  it("opens git history panel from Hub button", () => {
    const onOpenGitHistoryPanel = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        onOpenGitHistoryPanel={onOpenGitHistoryPanel}
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Git panel view" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Hub" }));
    expect(onOpenGitHistoryPanel).toHaveBeenCalledTimes(1);
  });

  it("switches git panel mode from custom dropdown menu", () => {
    const onModeChange = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        onModeChange={onModeChange}
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Git panel view" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Issues/i }));
    expect(onModeChange).toHaveBeenCalledWith("issues");
  });

  it("keeps flat mode stage action behavior", () => {
    const onStageFile = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        onStageFile={onStageFile}
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const stageButton = screen.getByRole("button", { name: "Stage file" });
    fireEvent.click(stageButton);
    expect(onStageFile).toHaveBeenCalledWith("file.txt");
  });

  it("renders preview actions before mutation actions in flat mode", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        onStageFile={vi.fn()}
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const actionGroup = document.querySelector('.diff-row[data-path="file.txt"] .diff-row-actions');
    expect(actionGroup).toBeTruthy();
    const actionLabels = Array.from(actionGroup?.querySelectorAll("button") ?? []).map((button) =>
      button.getAttribute("aria-label"),
    );
    expect(actionLabels).toEqual([
      "Preview diff in center pane",
      "Open diff preview modal",
      "Stage file",
    ]);
  });

  it("renders file commit selection checkbox as the trailing row control", () => {
    const onSelectFile = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        onSelectFile={onSelectFile}
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const rowMeta = document.querySelector('.diff-row[data-path="file.txt"] .diff-row-meta');
    const selectionToggle = screen.getByRole("checkbox", {
      name: "Toggle commit selection: file.txt",
    });
    expect(rowMeta?.lastElementChild).toBe(selectionToggle);
    expect(selectionToggle.classList.contains("git-commit-scope-toggle")).toBe(true);

    fireEvent.click(selectionToggle);
    expect(onSelectFile).not.toHaveBeenCalled();
  });

  it("opens inline preview from explicit action in tree mode", () => {
    const onSelectFile = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="tree"
        onSelectFile={onSelectFile}
        unstagedFiles={[
          { path: "src/a.ts", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const inlinePreviewButton = document.querySelector<HTMLButtonElement>(
      '.diff-row[data-path="src/a.ts"] .diff-row-action--preview-inline',
    );
    expect(inlinePreviewButton).toBeTruthy();

    fireEvent.click(inlinePreviewButton as HTMLButtonElement);
    expect(onSelectFile).toHaveBeenCalledTimes(1);
    expect(onSelectFile).toHaveBeenCalledWith("src/a.ts");
  });

  it("opens the file editor instead of selecting diff on regular row click", () => {
    const onSelectFile = vi.fn();
    const onOpenFile = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        onSelectFile={onSelectFile}
        onOpenFile={onOpenFile}
        unstagedFiles={[
          { path: "src/a.ts", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const row = document.querySelector<HTMLElement>('.diff-row[data-path="src/a.ts"]');
    expect(row).toBeTruthy();

    fireEvent.click(row as HTMLElement);
    expect(onOpenFile).toHaveBeenCalledTimes(1);
    expect(onOpenFile).toHaveBeenCalledWith("src/a.ts");
    expect(onSelectFile).not.toHaveBeenCalled();
  });

  it("opens modal preview from explicit action without triggering row selection", () => {
    const onSelectFile = vi.fn();
    const onCreateCodeAnnotation = vi.fn();
    const codeAnnotations = [
      {
        id: "annotation-1",
        path: "file.txt",
        lineRange: { startLine: 2, endLine: 2 },
        body: "check this",
        source: "modal-diff-view" as const,
      },
    ];
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        onSelectFile={onSelectFile}
        onCreateCodeAnnotation={onCreateCodeAnnotation}
        codeAnnotations={codeAnnotations}
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
        diffEntries={[
          {
            path: "file.txt",
            status: "M",
            diff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
          },
        ]}
      />,
    );

    const modalPreviewButton = document.querySelector<HTMLButtonElement>(
      '.diff-row[data-path="file.txt"] .diff-row-action--preview-modal',
    );
    expect(modalPreviewButton).toBeTruthy();

    fireEvent.click(modalPreviewButton as HTMLButtonElement);
    expect(onSelectFile).not.toHaveBeenCalled();
    expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();
    expect(mockEditableDiffReviewSurface.mock.lastCall?.[0]).toMatchObject({
      onCreateCodeAnnotation,
      codeAnnotations,
      codeAnnotationSurface: "modal-diff-view",
    });
  });

  it("keeps flat mode stage-all action behavior", () => {
    const onStageAllChanges = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        onStageAllChanges={onStageAllChanges}
        unstagedFiles={[
          { path: "file-a.txt", status: "M", additions: 1, deletions: 0 },
          { path: "file-b.txt", status: "M", additions: 2, deletions: 0 },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Stage all changes" }),
    );
    expect(screen.getByRole("group", { name: "Changes actions" })).toBeTruthy();
    expect(onStageAllChanges).toHaveBeenCalledTimes(1);
  });

  it("toggles the unstaged commit scope from the section checkbox", () => {
    const onCommit = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        onCommit={onCommit}
        commitMessage="feat: selective commit"
        onGenerateCommitMessage={vi.fn()}
        unstagedFiles={[
          { path: "file-a.txt", status: "M", additions: 1, deletions: 0 },
          { path: "file-b.txt", status: "M", additions: 2, deletions: 0 },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Toggle commit selection: Changes" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Commit" }));

    expect(onCommit).toHaveBeenCalledWith(["file-a.txt", "file-b.txt"]);
  });

  it("keeps tree mode unstage-all action behavior", async () => {
    const onUnstageFile = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="tree"
        onUnstageFile={onUnstageFile}
        stagedFiles={[
          { path: "src/a.ts", status: "M", additions: 1, deletions: 0 },
          { path: "src/b.ts", status: "M", additions: 2, deletions: 0 },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Unstage all changes" }),
    );

    await waitFor(() => {
      expect(onUnstageFile).toHaveBeenNthCalledWith(1, "src/a.ts");
      expect(onUnstageFile).toHaveBeenNthCalledWith(2, "src/b.ts");
    });
  });

  it("toggles unstaged file commit selection through the file checkbox without staging", () => {
    const onStageFile = vi.fn();
    const onCommit = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        onStageFile={onStageFile}
        onCommit={onCommit}
        commitMessage="feat: selective commit"
        onGenerateCommitMessage={vi.fn()}
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Toggle commit selection: file.txt" }));
    expect(onStageFile).not.toHaveBeenCalled();
    expect(screen.getByText("1 file selected for commit")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Commit" }));
    expect(onCommit).toHaveBeenCalledWith(["file.txt"]);
  });

  it("keeps tree folder rows free of commit checkboxes and selects scope from trailing file controls", async () => {
    const onStageFile = vi.fn();
    const onCommit = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="tree"
        onStageFile={onStageFile}
        onCommit={onCommit}
        commitMessage="feat: selective commit"
        onGenerateCommitMessage={vi.fn()}
        stagedFiles={[
          { path: "src/already-staged.ts", status: "M", additions: 2, deletions: 0 },
        ]}
        unstagedFiles={[
          { path: "src/pending-a.ts", status: "M", additions: 1, deletions: 0 },
          { path: "src/pending-b.ts", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    expect(
      screen.queryByRole("checkbox", {
        name: "Toggle commit selection: src",
      }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Toggle commit selection: src/pending-a.ts",
      }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Toggle commit selection: src/pending-b.ts",
      }),
    );
    expect(onStageFile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Commit" }));

    await waitFor(() => {
      expect(onCommit).toHaveBeenCalledWith([
        "src/already-staged.ts",
        "src/pending-a.ts",
        "src/pending-b.ts",
      ]);
    });
  });

  it("keeps hybrid staged files locked to the existing git index semantics", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        stagedFiles={[
          { path: "src/hybrid.ts", status: "M", additions: 2, deletions: 0 },
        ]}
        unstagedFiles={[
          { path: "src/hybrid.ts", status: "M", additions: 1, deletions: 1 },
        ]}
      />,
    );

    const hybridToggles = screen.getAllByRole("checkbox", {
      name: "Toggle commit selection: src/hybrid.ts",
    });
    expect(hybridToggles).toHaveLength(2);
    for (const toggle of hybridToggles) {
      expect((toggle as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("shows staged commit count in the commit scope hint", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        commitMessage="feat: add thing"
        onGenerateCommitMessage={vi.fn()}
        stagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );
    expect(screen.getByText("1 file selected for commit")).toBeTruthy();
  });

  it("toggles preview modal maximize state", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
        diffEntries={[
          {
            path: "file.txt",
            status: "M",
            diff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
          },
        ]}
      />,
    );

    const fileRow = screen.getByLabelText("file.txt");
    fireEvent.doubleClick(fileRow);

    const modal = document.querySelector(".git-history-diff-modal");
    expect(modal).toBeTruthy();
    expect(modal?.classList.contains("is-maximized")).toBe(false);

    const maximizeButton = screen.getByRole("button", { name: "Maximize" });
    fireEvent.click(maximizeButton);
    expect(modal?.classList.contains("is-maximized")).toBe(true);

    const restoreButton = screen.getByRole("button", { name: "Restore" });
    fireEvent.click(restoreButton);
    expect(modal?.classList.contains("is-maximized")).toBe(false);
  });

  it("opens the existing modal from an external path request", async () => {
    const props = {
      ...baseProps,
      unstagedFiles: [
        { path: "src/new-file.ts", status: "A", additions: 2, deletions: 0 },
      ],
      diffEntries: [
        {
          path: "src/new-file.ts",
          status: "A",
          diff: "@@ -0,0 +1,2 @@\n+one\n+two",
        },
      ],
    };
    const { rerender } = render(
      <GitDiffPanel
        {...props}
        modalPreviewRequest={{ path: "src/new-file.ts", requestId: 1, maximized: true }}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector(".git-history-diff-modal")?.classList.contains("is-maximized"))
        .toBe(true);
    });
    fireEvent.click(screen.getByRole("button", { name: "Mock close preview" }));
    await waitFor(() => {
      expect(document.querySelector(".git-history-diff-modal")).toBeNull();
    });

    rerender(
      <GitDiffPanel
        {...props}
        modalPreviewRequest={{ path: "src/new-file.ts", requestId: 2, maximized: true }}
      />,
    );
    await waitFor(() => {
      expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();
    });
  });

  it("keeps an external request for a missing path as a stable no-op", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        modalPreviewRequest={{ path: "src/missing.ts", requestId: 1 }}
      />,
    );

    expect(document.querySelector(".git-history-diff-modal")).toBeNull();
  });

  it("retries an external request when the Git file list arrives later", async () => {
    const request = { path: "src/delayed.ts", requestId: 1, maximized: true };
    const { rerender } = render(
      <GitDiffPanel {...baseProps} modalPreviewRequest={request} />,
    );
    expect(document.querySelector(".git-history-diff-modal")).toBeNull();

    rerender(
      <GitDiffPanel
        {...baseProps}
        unstagedFiles={[
          { path: "src/delayed.ts", status: "A", additions: 1, deletions: 0 },
        ]}
        diffEntries={[
          { path: "src/delayed.ts", status: "A", diff: "@@ -0,0 +1 @@\n+new" },
        ]}
        modalPreviewRequest={request}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector(".git-history-diff-modal")?.classList.contains("is-maximized"))
        .toBe(true);
    });
  });

  it("opens a staged file from an external modal request", async () => {
    render(
      <GitDiffPanel
        {...baseProps}
        stagedFiles={[
          { path: "src/staged.ts", status: "M", additions: 1, deletions: 1 },
        ]}
        diffEntries={[
          {
            path: "src/staged.ts",
            status: "M",
            diff: "@@ -1 +1 @@\n-old\n+new",
          },
        ]}
        modalPreviewRequest={{ path: "src/staged.ts", requestId: 1, maximized: true }}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector(".git-history-diff-modal")?.classList.contains("is-maximized"))
        .toBe(true);
    });
  });

  it("routes preview modal close through GitDiffViewer external header controls", async () => {
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
        diffEntries={[
          {
            path: "file.txt",
            status: "M",
            diff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
          },
        ]}
      />,
    );

    fireEvent.doubleClick(screen.getByLabelText("file.txt"));

    await waitFor(() => {
      const latestProps = mockEditableDiffReviewSurface.mock.lastCall?.[0];
      expect(typeof latestProps?.onRequestClose).toBe("function");
      expect(latestProps?.headerControlsTarget).toBeInstanceOf(HTMLDivElement);
    });

    fireEvent.click(screen.getByRole("button", { name: "Mock close preview" }));

    await waitFor(() => {
      expect(document.querySelector(".git-history-diff-modal")).toBeNull();
    });
  });

  it("uses the custom unsaved-changes dialog before closing a dirty preview", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
        diffEntries={[{
          path: "file.txt",
          status: "M",
          diff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
        }]}
      />,
    );

    fireEvent.doubleClick(screen.getByLabelText("file.txt"));
    fireEvent.click(screen.getByRole("button", { name: "Mock dirty preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Mock close preview" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Unsaved changes" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mock close preview" }));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "Unsaved changes" })).toBeNull());
    expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mock close preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(mockPreviewDiscard).toHaveBeenCalledOnce();
    await waitFor(() => expect(document.querySelector(".git-history-diff-modal")).toBeNull());
  });

  it("keeps a dirty preview open when Git refresh removes the current file", async () => {
    const initialProps = {
      ...baseProps,
      gitDiffListView: "flat" as const,
      unstagedFiles: [{ path: "file.txt", status: "M", additions: 1, deletions: 0 }],
      diffEntries: [{
        path: "file.txt",
        status: "M",
        diff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
      }],
    };
    const { rerender } = render(<GitDiffPanel {...initialProps} />);

    fireEvent.doubleClick(screen.getByLabelText("file.txt"));
    fireEvent.click(screen.getByRole("button", { name: "Mock dirty preview" }));
    rerender(
      <GitDiffPanel
        {...initialProps}
        unstagedFiles={[]}
        diffEntries={[]}
      />,
    );

    expect(screen.getByRole("alertdialog", { name: "Unsaved changes" })).toBeTruthy();
    expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog", { name: "Unsaved changes" })).toBeNull();
    });
    expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();
  });

  it("saves a dirty preview before closing and stays open when saving fails", async () => {
    render(
      <GitDiffPanel
        {...baseProps}
        gitDiffListView="flat"
        unstagedFiles={[{ path: "file.txt", status: "M", additions: 1, deletions: 0 }]}
        diffEntries={[{
          path: "file.txt",
          status: "M",
          diff: "diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",
        }]}
      />,
    );

    fireEvent.doubleClick(screen.getByLabelText("file.txt"));
    fireEvent.click(screen.getByRole("button", { name: "Mock dirty preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Mock close preview" }));
    mockPreviewSave.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Save and close" }));

    await waitFor(() => expect(mockPreviewSave).toHaveBeenCalledOnce());
    expect(screen.getByRole("alertdialog", { name: "Unsaved changes" })).toBeTruthy();
    expect(document.querySelector(".git-history-diff-modal")).toBeTruthy();

    const retrySaveButton = await waitFor(() => {
      const button = screen.getByRole<HTMLButtonElement>("button", { name: "Save and close" });
      expect(button.disabled).toBe(false);
      return button;
    });
    fireEvent.click(retrySaveButton);
    await waitFor(() => expect(mockPreviewSave).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(document.querySelector(".git-history-diff-modal")).toBeNull());
  });

  it("keeps root summary visible and in first content row for non-git workspace path", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/non-git-workspace"
        gitRoot={null}
        onScanGitRoots={vi.fn()}
      />,
    );

    const rootPath = screen.getByText("/tmp/non-git-workspace");
    expect(rootPath).toBeTruthy();
    expect(screen.getByRole("button", { name: "Switch" })).toBeTruthy();

    const rootRow = document.querySelector(".git-root-current");
    const statusRow = document.querySelector(".diff-status");
    expect(rootRow).toBeTruthy();
    expect(statusRow).toBeTruthy();
    if (!rootRow || !statusRow) {
      throw new Error("Expected root/status rows to exist");
    }
    expect(Boolean(rootRow.compareDocumentPosition(statusRow) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("toggles git root panel by clicking change icon button", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/non-git-workspace"
        error="not a git repository"
        gitRoot={null}
        onScanGitRoots={vi.fn()}
      />,
    );

    const toggleButton = screen.getByRole("button", { name: "Switch" });
    expect(screen.getByText("git.chooseRepo")).toBeTruthy();

    fireEvent.click(toggleButton);
    expect(screen.queryByText("git.chooseRepo")).toBeNull();

    fireEvent.click(toggleButton);
    expect(screen.getByText("git.chooseRepo")).toBeTruthy();
  });

  it("opens git root panel from the Diff menu switch repository action", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/non-git-workspace"
        gitRoot={null}
        onScanGitRoots={vi.fn()}
      />,
    );

    expect(screen.queryByText("git.chooseRepo")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Git panel view" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Switch Git repository" }));

    expect(screen.getByText("git.chooseRepo")).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders compact red alert on root row and hides raw git error", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/non-git-workspace"
        error="could not find repository at '/tmp/non-git-workspace'; class=Repository (6); code=NotFound (-3)"
        gitRoot={null}
        onScanGitRoots={vi.fn()}
      />,
    );

    expect(screen.getByText("No repositories found.")).toBeTruthy();
    expect(screen.queryByText(/could not find repository/i)).toBeNull();
    expect(screen.queryByText("Git status unavailable")).toBeNull();
    expect(screen.queryByText("main")).toBeNull();
  });

  it("auto-collapses git root panel after selecting a repository", () => {
    const onSelectGitRoot = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/non-git-workspace"
        gitRoot={null}
        gitRootCandidates={["/tmp/non-git-workspace/repo-a"]}
        onScanGitRoots={vi.fn()}
        onSelectGitRoot={onSelectGitRoot}
      />,
    );

    const repoOption = screen.getByRole("button", { name: "/tmp/non-git-workspace/repo-a" });
    fireEvent.click(repoOption);
    expect(onSelectGitRoot).toHaveBeenCalledWith("/tmp/non-git-workspace/repo-a");
    expect(screen.queryByText("git.chooseRepo")).toBeNull();
  });

  it("auto-collapses git root panel when scan finishes with no repositories", () => {
    const { rerender } = render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/non-git-workspace"
        gitRoot={null}
        gitRootScanLoading={true}
        onScanGitRoots={vi.fn()}
      />,
    );

    expect(screen.getByText("git.chooseRepo")).toBeTruthy();

    rerender(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/non-git-workspace"
        gitRoot={null}
        gitRootScanLoading={false}
        gitRootScanHasScanned={true}
        gitRootCandidates={[]}
        gitRootScanError={null}
        onScanGitRoots={vi.fn()}
      />,
    );

    expect(screen.queryByText("git.chooseRepo")).toBeNull();
  });

  it("hides pick-folder action in root panel", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/non-git-workspace"
        gitRoot={null}
        gitRootScanLoading={true}
        onScanGitRoots={vi.fn()}
        onPickGitRoot={vi.fn()}
      />,
    );

    expect(screen.queryByText("git.pickFolder")).toBeNull();
  });
});
