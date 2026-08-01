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

vi.mock("../../git/components/WorkspaceReadOnlyDiffCompare", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../git/components/WorkspaceReadOnlyDiffCompare")>();
  return {
    ...actual,
    WorkspaceReadOnlyDiffCompare: ({
      filePath,
      diff,
      resizableColumns,
    }: {
      filePath: string;
      diff: string;
      resizableColumns?: boolean;
    }) => (
      <div
        data-testid="read-only-diff-compare"
        data-file-path={filePath}
        data-resizable-columns={resizableColumns ? "true" : "false"}
      >
        {diff}
        {resizableColumns ? <div data-testid="file-history-compare-resizer" /> : null}
      </div>
    ),
  };
});

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
    await act(async () => secondDiff.resolve([{ path: targetA.path, status: "M", diff: "@@ -1 +1 @@\n-second line\n+second line" }]));
    await waitFor(() => expect(screen.getByTestId("read-only-diff-compare").textContent).toContain("second line"));

    await act(async () => firstDiff.resolve([{ path: targetA.path, status: "M", diff: "@@ -1 +1 @@\n-first line\n+first line" }]));
    const renderedText = screen.getByTestId("read-only-diff-compare").textContent ?? "";
    expect(renderedText).toContain("second line");
    expect(renderedText).not.toContain("first line");
  });

  it("renders the selected text diff through the shared resizable aligned compare", async () => {
    vi.mocked(getGitCommitHistory).mockResolvedValue(history({
      sha: "aaaaaaa1",
      summary: "First commit",
    }));
    vi.mocked(getGitCommitDiff).mockResolvedValue([
      {
        path: targetA.path,
        status: "M",
        diff: [
          "diff --git a/x.ts b/x.ts",
          "index 0000..0001 100644",
          "@@ -1 +1 @@",
          "-old line",
          "+new line",
          " context",
        ].join("\n"),
      },
    ]);
    render(<FileHistoryView target={targetA} onClose={vi.fn()} />);
    const compare = await screen.findByTestId("read-only-diff-compare");
    expect(compare.getAttribute("data-file-path")).toBe(targetA.path);
    expect(compare.getAttribute("data-resizable-columns")).toBe("true");
  });

  it("renders two draggable splitters inside the workbench and compare grid", async () => {
    vi.mocked(getGitCommitHistory).mockResolvedValue(history({
      sha: "aaaaaaa1",
      summary: "Splitters",
    }));
    vi.mocked(getGitCommitDiff).mockResolvedValue([
      { path: targetA.path, status: "M", diff: "@@ -1 +1 @@\n-old\n+new" },
    ]);
    render(<FileHistoryView target={targetA} onClose={vi.fn()} />);
    expect(screen.getByTestId("file-history-commit-resizer")).toBeTruthy();
    expect(await screen.findByTestId("file-history-compare-resizer")).toBeTruthy();
  });

  it("resizes the commit rail when dragging the outer splitter and resets on double-click", async () => {
    vi.mocked(getGitCommitHistory).mockResolvedValue(history({
      sha: "aaaaaaa1",
      summary: "Drag me",
    }));
    vi.mocked(getGitCommitDiff).mockResolvedValue([
      { path: targetA.path, status: "M", diff: "@@ -1 +1 @@\n-old\n+new" },
    ]);

    const hostWidth = 1000;
    const getBoundingClientRect = () => ({
      width: hostWidth,
      height: 600,
      top: 0,
      left: 0,
      right: hostWidth,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    });

    render(<FileHistoryView target={targetA} onClose={vi.fn()} />);

    const workbench = screen.getByTestId("file-history-commit-resizer").parentElement;
    if (!workbench) throw new Error("workbench not found");
    workbench.getBoundingClientRect = getBoundingClientRect;

    const splitter = screen.getByTestId("file-history-commit-resizer");
    fireEvent.mouseDown(splitter, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 20, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 40, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 80, clientY: 0 });
    fireEvent.mouseUp(window, { clientX: 80, clientY: 0 });

    await waitFor(() => {
      const inline = workbench.getAttribute("style") ?? "";
      expect(inline).toContain("--file-history-commit-rail-width: 380px");
    });

    fireEvent.doubleClick(splitter);
    await waitFor(() => {
      const inline = workbench.getAttribute("style") ?? "";
      expect(inline).toContain("--file-history-commit-rail-width: 300px");
    });
  });

  it("clamps the commit rail drag to its 60% ratio upper bound", async () => {
    vi.mocked(getGitCommitHistory).mockResolvedValue(history({
      sha: "aaaaaaa1",
      summary: "Clamp",
    }));
    vi.mocked(getGitCommitDiff).mockResolvedValue([
      { path: targetA.path, status: "M", diff: "@@ -1 +1 @@\n-old\n+new" },
    ]);

    const hostWidth = 800;
    const rect = {
      width: hostWidth,
      height: 600,
      top: 0,
      left: 0,
      right: hostWidth,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON() { return {}; },
    };

    render(<FileHistoryView target={targetA} onClose={vi.fn()} />);
    const workbench = screen.getByTestId("file-history-commit-resizer").parentElement;
    if (!workbench) throw new Error("workbench not found");
    workbench.getBoundingClientRect = () => rect;

    const splitter = screen.getByTestId("file-history-commit-resizer");
    // Try to drag +1000px past start — should clamp to hostWidth * 0.6 = 480.
    fireEvent.mouseDown(splitter, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 1000, clientY: 0 });
    fireEvent.mouseUp(window, { clientX: 1000, clientY: 0 });

    await waitFor(() => {
      const inline = workbench.getAttribute("style") ?? "";
      expect(inline).toContain("--file-history-commit-rail-width: 480px");
    });
  });

  it("cleans up the outer splitter global drag state on unmount", async () => {
    vi.mocked(getGitCommitHistory).mockResolvedValue(history({
      sha: "aaaaaaa1",
      summary: "Cleanup",
    }));
    const view = render(<FileHistoryView target={targetA} onClose={vi.fn()} />);
    const splitter = screen.getByTestId("file-history-commit-resizer");
    const workbench = splitter.parentElement;
    if (!workbench) throw new Error("workbench not found");
    workbench.getBoundingClientRect = () => ({
      width: 1000,
      height: 600,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.mouseDown(splitter, { clientX: 0, clientY: 0 });
    expect(document.body.dataset.fileHistoryColumnResizing).toBe("true");
    view.unmount();
    expect(document.body.dataset.fileHistoryColumnResizing).toBeUndefined();
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
      .mockResolvedValueOnce([{ path: targetA.path, status: "M", diff: "@@ -1 +1 @@\n-retry line\n+retry line" }]);
    render(<FileHistoryView target={targetA} onClose={vi.fn()} />);

    expect(await screen.findByText("diff unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "git.fileHistoryRetry" }));
    await waitFor(() =>
      expect(screen.getByTestId("read-only-diff-compare").textContent).toContain("retry line"),
    );
    expect(screen.getAllByText("Retry commit").length).toBeGreaterThan(0);
  });
});
