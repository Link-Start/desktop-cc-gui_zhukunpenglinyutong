/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "./FileViewPanel.test-utils";
import { FileViewPanel } from "./FileViewPanel";
import { getGitFileBlame, readWorkspaceFile } from "../../../services/tauri";
import { clearFileDocumentSessionCacheForTests } from "../hooks/useFileDocumentState";
import { clearFileGitBlameCacheForTests } from "../hooks/useFileGitBlame";
import type { GitRepositorySummary } from "../../../types";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

const blameResponse = {
  path: "src/value.ts",
  headSha: "abc123",
  lineCount: 1,
  hunks: [],
};

function repository(repositoryRoot: string): GitRepositorySummary {
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
    fileStatuses: [],
    isClean: true,
    error: null,
  };
}

describe("FileViewPanel Git Blame", () => {
  afterEach(() => {
    cleanup();
    clearFileDocumentSessionCacheForTests();
    clearFileGitBlameCacheForTests();
    vi.clearAllMocks();
  });

  it("keeps file open blame-free until the user enables it", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "export const value = 1;",
      truncated: false,
    });
    vi.mocked(getGitFileBlame).mockResolvedValue({
      path: "src/value.ts",
      headSha: "abc123",
      lineCount: 1,
      hunks: [],
    });

    render(
      <FileViewPanel
        workspaceId="ws-1"
        workspacePath="/repo"
        filePath="src/value.ts"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    expect(getGitFileBlame).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "files.gitBlame" }));

    await waitFor(() => {
      expect(getGitFileBlame).toHaveBeenCalledWith("ws-1", "src/value.ts", null);
    });
  });

  it("keeps the first useful editor viewport usable while blame is slow", async () => {
    const slowBlame = createDeferred<typeof blameResponse>();
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "export const value = 1;",
      truncated: false,
    });
    vi.mocked(getGitFileBlame).mockReturnValue(slowBlame.promise);

    render(
      <FileViewPanel
        workspaceId="ws-slow-blame"
        workspacePath="/repo"
        filePath="src/value.ts"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const editor = await screen.findByTestId("mock-codemirror");
    fireEvent.click(screen.getByRole("button", { name: "files.gitBlame" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "files.gitBlameLoading" })).toBeTruthy();
    });
    expect((editor as HTMLTextAreaElement).value).toBe("export const value = 1;");
    fireEvent.select(editor, { target: { selectionStart: 7, selectionEnd: 7 } });
    expect(getGitFileBlame).toHaveBeenCalledTimes(1);

    await act(async () => {
      slowBlame.resolve(blameResponse);
      await slowBlame.promise;
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "files.gitBlame" })).toBeTruthy();
    });
  });

  it("keeps the editor usable and exposes a blame error inline", async () => {
    const failedBlame = createDeferred<typeof blameResponse>();
    vi.mocked(readWorkspaceFile).mockResolvedValue({ content: "one", truncated: false });
    vi.mocked(getGitFileBlame).mockReturnValue(failedBlame.promise);

    render(
      <FileViewPanel
        workspaceId="ws-blame-error"
        workspacePath="/repo"
        filePath="src/value.ts"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const editor = await screen.findByTestId("mock-codemirror");
    fireEvent.click(screen.getByRole("button", { name: "files.gitBlame" }));
    await act(async () => {
      failedBlame.reject(new Error("blame backend unavailable"));
      await failedBlame.promise.catch(() => undefined);
    });

    const errorButton = await screen.findByRole("button", { name: "files.gitBlameError" });
    expect(errorButton.getAttribute("title")).toBe("blame backend unavailable");
    expect((editor as HTMLTextAreaElement).disabled).toBe(false);
  });

  it("declines over-budget files without issuing blame IPC", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: Array.from({ length: 50_001 }, () => "x").join("\n"),
      truncated: false,
    });

    render(
      <FileViewPanel
        workspaceId="ws-blame-budget"
        workspacePath="/repo"
        filePath="src/large.ts"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    const blameButton = screen.getByRole("button", { name: "files.gitBlame" });
    expect((blameButton as HTMLButtonElement).disabled).toBe(true);
    expect(blameButton.getAttribute("title")).toBe("files.gitBlameUnavailable");
    expect(getGitFileBlame).not.toHaveBeenCalled();
  });

  it("invalidates an in-flight blame request when the same file snapshot changes", async () => {
    const obsoleteBlame = createDeferred<typeof blameResponse>();
    const refreshedBlame = createDeferred<typeof blameResponse>();
    vi.mocked(readWorkspaceFile)
      .mockResolvedValueOnce({ content: "const value = 1;", truncated: false })
      .mockResolvedValue({ content: "const value = 2;", truncated: false });
    vi.mocked(getGitFileBlame)
      .mockReturnValueOnce(obsoleteBlame.promise)
      .mockReturnValueOnce(refreshedBlame.promise);

    render(
      <FileViewPanel
        workspaceId="ws-blame-snapshot-race"
        workspacePath="/repo"
        filePath="src/value.ts"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
        externalChangeMonitoringEnabled
        externalChangePollIntervalMs={20}
      />,
    );

    const editor = await screen.findByTestId("mock-codemirror");
    fireEvent.click(screen.getByRole("button", { name: "files.gitBlame" }));
    await waitFor(() => expect(getGitFileBlame).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect((editor as HTMLTextAreaElement).value).toBe("const value = 2;");
    });

    expect(getGitFileBlame).toHaveBeenCalledTimes(2);

    await act(async () => {
      obsoleteBlame.resolve(blameResponse);
      await obsoleteBlame.promise;
    });
    expect(screen.getByRole("button", { name: "files.gitBlameLoading" })).toBeTruthy();

    await act(async () => {
      refreshedBlame.resolve({ ...blameResponse, headSha: "def456" });
      await refreshedBlame.promise;
    });
  });

  it("preserves nested repository scope and does not refetch while typing", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({ content: "one", truncated: false });
    vi.mocked(getGitFileBlame).mockResolvedValue({
      path: "src/value.ts",
      headSha: "abc123",
      lineCount: 1,
      hunks: [],
    });

    render(
      <FileViewPanel
        workspaceId="ws-1"
        workspacePath="/repo"
        gitRoot="/repo/packages/app"
        filePath="packages/app/src/value.ts"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const editor = await screen.findByTestId("mock-codemirror");
    fireEvent.click(screen.getByRole("button", { name: "files.gitBlame" }));
    await waitFor(() => expect(getGitFileBlame).toHaveBeenCalledTimes(1));
    expect(getGitFileBlame).toHaveBeenCalledWith(
      "ws-1",
      "src/value.ts",
      "packages/app",
    );

    fireEvent.change(editor, { target: { value: "two" } });
    fireEvent.select(editor, { target: { selectionStart: 1, selectionEnd: 1 } });
    expect(getGitFileBlame).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "files.gitBlameStale" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("uses the longest owning repository instead of the configured git root", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({ content: "one", truncated: false });
    vi.mocked(getGitFileBlame).mockResolvedValue({
      ...blameResponse,
      path: "src/value.ts",
    });

    render(
      <FileViewPanel
        workspaceId="ws-multi-blame"
        workspacePath="/repo"
        gitRoot="repo-a"
        gitRepositories={[
          repository(""),
          repository("repo-b"),
          repository("repo-b/nested"),
        ]}
        filePath="repo-b/nested/src/value.ts"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    fireEvent.click(screen.getByRole("button", { name: "files.gitBlame" }));

    await waitFor(() => {
      expect(getGitFileBlame).toHaveBeenCalledWith(
        "ws-multi-blame",
        "src/value.ts",
        "repo-b/nested",
      );
    });
  });

  it("does not blame through another repository when the known inventory has no owner", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({ content: "one", truncated: false });

    render(
      <FileViewPanel
        workspaceId="ws-no-owner"
        workspacePath="/repo"
        gitRoot="repo-a"
        gitRepositories={[repository("repo-a"), repository("repo-b")]}
        filePath="outside/value.ts"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId("mock-codemirror");
    const blameButton = screen.getByRole("button", { name: "files.gitBlame" });
    expect((blameButton as HTMLButtonElement).disabled).toBe(true);
    expect(getGitFileBlame).not.toHaveBeenCalled();
  });
});
