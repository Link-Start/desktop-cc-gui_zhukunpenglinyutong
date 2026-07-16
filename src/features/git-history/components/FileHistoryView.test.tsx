// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitCommitDiff, GitHistoryResponse } from "../../../types";
import { getGitCommitDiff, getGitCommitHistory } from "../../../services/tauri";
import type { FileHistoryTarget } from "../types";
import { FileHistoryView } from "./FileHistoryView";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
      index,
      key: index,
      start: index * 72,
    })),
    getTotalSize: () => count * 72,
    measureElement: () => undefined,
  }),
}));

vi.mock("../../../styles/featureStyleLoaders", () => ({
  loadFileHistoryStyles: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../services/tauri", () => ({
  getGitCommitHistory: vi.fn(),
  getGitCommitDiff: vi.fn(),
}));

vi.mock("../../git/components/WorkspaceReadOnlyDiffCompare", () => ({
  WorkspaceReadOnlyDiffCompare: ({ filePath, diff }: { filePath: string; diff: string }) => (
    <div data-testid="read-only-diff-compare" data-file-path={filePath}>{diff}</div>
  ),
}));

vi.mock("../../git/components/GitDiffViewer", () => ({
  GitDiffViewer: ({ diffs }: { diffs: GitCommitDiff[] }) => (
    <div data-testid="image-diff-viewer">{diffs.map((entry) => entry.path).join("|")}</div>
  ),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function history(...commits: Array<{ sha: string; summary: string; filePath?: string }>): GitHistoryResponse {
  return {
    snapshotId: "snapshot",
    total: commits.length,
    offset: 0,
    limit: 100,
    hasMore: false,
    commits: commits.map(({ sha, summary, filePath }) => ({
      sha,
      shortSha: sha.slice(0, 7),
      summary,
      message: summary,
      author: "Tester",
      authorEmail: "tester@example.com",
      timestamp: 1,
      parents: [],
      refs: [],
      ...(filePath ? { filePath } : {}),
    })),
  };
}

const targetA: FileHistoryTarget = {
  workspaceId: "workspace",
  workspacePath: "/workspace",
  repositoryRoot: "",
  path: "src/a.ts",
  displayPath: "src/a.ts",
};

describe("FileHistoryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGitCommitDiff).mockResolvedValue([]);
  });

  it("drops a late history response after the file target changes", async () => {
    const first = deferred<GitHistoryResponse>();
    const second = deferred<GitHistoryResponse>();
    vi.mocked(getGitCommitHistory)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { rerender } = render(<FileHistoryView target={targetA} onClose={vi.fn()} />);
    await waitFor(() => expect(getGitCommitHistory).toHaveBeenCalledTimes(1));

    const targetB = { ...targetA, path: "src/b.ts", displayPath: "src/b.ts" };
    rerender(<FileHistoryView target={targetB} onClose={vi.fn()} />);
    await waitFor(() => expect(getGitCommitHistory).toHaveBeenCalledTimes(2));
    await act(async () => second.resolve(history({ sha: "bbbbbbb2", summary: "B commit" })));
    await waitFor(() => expect(screen.getAllByText("B commit").length).toBeGreaterThan(0));

    await act(async () => first.resolve(history({ sha: "aaaaaaa1", summary: "A commit" })));
    await waitFor(() => expect(screen.queryByText("A commit")).toBeNull());
  });

  it("drops a late diff response after commit selection changes", async () => {
    vi.mocked(getGitCommitHistory).mockResolvedValue(history(
      { sha: "aaaaaaa1", summary: "First commit" },
      { sha: "bbbbbbb2", summary: "Second commit" },
    ));
    const firstDiff = deferred<GitCommitDiff[]>();
    const secondDiff = deferred<GitCommitDiff[]>();
    vi.mocked(getGitCommitDiff)
      .mockReturnValueOnce(firstDiff.promise)
      .mockReturnValueOnce(secondDiff.promise);
    render(<FileHistoryView target={targetA} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByText("Second commit"));
    await waitFor(() => expect(getGitCommitDiff).toHaveBeenCalledTimes(2));
    await act(async () => secondDiff.resolve([{ path: targetA.path, status: "M", diff: "second diff" }]));
    expect(await screen.findByText("second diff")).toBeTruthy();

    await act(async () => firstDiff.resolve([{ path: targetA.path, status: "M", diff: "first diff" }]));
    await waitFor(() => expect(screen.queryByText("first diff")).toBeNull());
  });

  it("renders the selected text diff with the shared aligned read-only compare", async () => {
    vi.mocked(getGitCommitHistory).mockResolvedValue(history({
      sha: "aaaaaaa1",
      summary: "Aligned compare",
    }));
    vi.mocked(getGitCommitDiff).mockResolvedValue([
      { path: targetA.path, status: "M", diff: "aligned diff" },
    ]);

    render(<FileHistoryView target={targetA} onClose={vi.fn()} />);

    const compare = await screen.findByTestId("read-only-diff-compare");
    expect(compare.getAttribute("data-file-path")).toBe(targetA.path);
    expect(compare.textContent).toBe("aligned diff");
  });

  it("requests and renders a pre-rename commit with its historical path", async () => {
    vi.mocked(getGitCommitHistory).mockResolvedValue(history({
      sha: "aaaaaaa1",
      summary: "Before rename",
      filePath: "src/before.ts",
    }));
    vi.mocked(getGitCommitDiff).mockResolvedValue([
      { path: "src/before.ts", status: "M", diff: "historical diff" },
    ]);

    render(<FileHistoryView target={{ ...targetA, path: "src/after.ts" }} onClose={vi.fn()} />);

    await waitFor(() => expect(getGitCommitDiff).toHaveBeenCalledWith(
      targetA.workspaceId,
      "aaaaaaa1",
      { path: "src/before.ts", repositoryRoot: "" },
    ));
    expect((await screen.findByTestId("read-only-diff-compare")).getAttribute("data-file-path"))
      .toBe("src/before.ts");
  });

  it("does not render an unrelated first diff when the historical path is absent", async () => {
    vi.mocked(getGitCommitHistory).mockResolvedValue(history({
      sha: "aaaaaaa1",
      summary: "Scoped commit",
      filePath: "src/expected.ts",
    }));
    vi.mocked(getGitCommitDiff).mockResolvedValue([
      { path: "src/unrelated.ts", status: "M", diff: "unrelated diff" },
    ]);

    render(<FileHistoryView target={targetA} onClose={vi.fn()} />);

    expect(await screen.findByText("git.diffUnavailable")).toBeTruthy();
    expect(screen.queryByText("unrelated diff")).toBeNull();
  });

  it("keeps image history on the shared image-capable diff viewer", async () => {
    vi.mocked(getGitCommitHistory).mockResolvedValue(history({
      sha: "aaaaaaa1",
      summary: "Image compare",
    }));
    vi.mocked(getGitCommitDiff).mockResolvedValue([
      { path: "assets/logo.png", status: "M", diff: "", isImage: true },
    ]);

    render(<FileHistoryView target={{ ...targetA, path: "assets/logo.png" }} onClose={vi.fn()} />);

    expect((await screen.findByTestId("image-diff-viewer")).textContent).toBe("assets/logo.png");
    expect(screen.queryByTestId("read-only-diff-compare")).toBeNull();
  });

  it("shows an explicit state for a non-image binary", async () => {
    vi.mocked(getGitCommitHistory).mockResolvedValue(history({
      sha: "aaaaaaa1",
      summary: "Binary compare",
    }));
    vi.mocked(getGitCommitDiff).mockResolvedValue([
      { path: targetA.path, status: "M", diff: "", isBinary: true, isImage: false },
    ]);

    render(<FileHistoryView target={targetA} onClose={vi.fn()} />);

    expect(await screen.findByText("git.binaryFile")).toBeTruthy();
  });

  it("settles an empty history and retries a failed history request", async () => {
    vi.mocked(getGitCommitHistory)
      .mockRejectedValueOnce(new Error("history unavailable"))
      .mockResolvedValueOnce(history());
    render(<FileHistoryView target={targetA} onClose={vi.fn()} />);

    expect(await screen.findByText("history unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /git.fileHistoryRetry/ }));
    expect(await screen.findByText("git.fileHistoryEmpty")).toBeTruthy();
  });

  it("retries the selected commit diff without changing selection", async () => {
    vi.mocked(getGitCommitHistory).mockResolvedValue(history({
      sha: "aaaaaaa1",
      summary: "Retry commit",
    }));
    vi.mocked(getGitCommitDiff)
      .mockRejectedValueOnce(new Error("diff unavailable"))
      .mockResolvedValueOnce([{ path: targetA.path, status: "M", diff: "retry diff" }]);
    render(<FileHistoryView target={targetA} onClose={vi.fn()} />);

    expect(await screen.findByText("diff unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "git.fileHistoryRetry" }));
    expect(await screen.findByText("retry diff")).toBeTruthy();
    expect(screen.getAllByText("Retry commit").length).toBeGreaterThan(0);
  });
});
