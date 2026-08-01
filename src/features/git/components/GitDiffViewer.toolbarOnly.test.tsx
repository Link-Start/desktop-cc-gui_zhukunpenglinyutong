/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGitFileFullDiff } from "../../../services/tauri";
import { GitDiffViewer } from "./GitDiffViewer";

vi.mock("../../../services/tauri", () => ({
  getGitFileFullDiff: vi.fn(async () => "full diff"),
}));

vi.mock("./WorkspaceReadOnlyDiffCompare", () => ({
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
      data-testid="aligned-read-only-compare"
      data-file-path={filePath}
      data-resizable={String(resizableColumns)}
    >
      {diff}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GitDiffViewer toolbar-only mode", () => {
  it("renders external controls without loading or rendering diff content", async () => {
    const controlsTarget = document.createElement("div");
    document.body.appendChild(controlsTarget);

    render(
      <GitDiffViewer
        workspaceId="workspace-1"
        diffs={[{
          path: "example.ts",
          status: "M",
          diff: "@@ -1 +1 @@\n-before\n+after\n",
        }]}
        selectedPath="example.ts"
        isLoading={false}
        error={null}
        showContentModeControls
        headerControlsTarget={controlsTarget}
        contentMode="all"
        toolbarOnly
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "git.dualPanelDiff" })).toBeTruthy();
    });
    expect(document.querySelector(".diff-viewer-list")).toBeNull();
    expect(getGitFileFullDiff).not.toHaveBeenCalled();
    controlsTarget.remove();
  });

  it("can hide the full-content control while retaining focused content", async () => {
    render(
      <GitDiffViewer
        workspaceId="workspace-1"
        diffs={[{
          path: "example.ts",
          status: "M",
          diff: "@@ -1 +1 @@\n-before\n+after\n",
        }]}
        selectedPath="example.ts"
        isLoading={false}
        error={null}
        showContentModeControls
        showAllContentControl={false}
        contentMode="focused"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "git.viewFocusedContent" })).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /git\.viewAllContent/ })).toBeNull();
    expect(getGitFileFullDiff).not.toHaveBeenCalled();
  });

  it("keeps the center preview toolbar while using the shared aligned split renderer", async () => {
    const { rerender } = render(
      <GitDiffViewer
        workspaceId="workspace-1"
        diffs={[{
          path: "example.ts",
          status: "M",
          diff: "@@ -1 +1 @@\n-before\n+after\n",
        }]}
        selectedPath="example.ts"
        isLoading={false}
        error={null}
        alignedTextPreview
        showContentModeControls
        contentMode="focused"
        diffStyle="split"
      />,
    );

    expect(await screen.findByRole("button", { name: "git.dualPanelDiff" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "git.singleColumnDiff" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "git.viewFocusedContent" })).toBeTruthy();
    expect(screen.getByTestId("aligned-read-only-compare").getAttribute("data-file-path"))
      .toBe("example.ts");
    expect(screen.getByTestId("aligned-read-only-compare").getAttribute("data-resizable"))
      .toBe("true");
    expect(document.querySelector(".diff-viewer-list")).toBeNull();

    rerender(
      <GitDiffViewer
        workspaceId="workspace-1"
        diffs={[{
          path: "example.ts",
          status: "M",
          diff: "@@ -1 +1 @@\n-before\n+after\n",
        }]}
        selectedPath="example.ts"
        isLoading={false}
        error={null}
        alignedTextPreview
        showContentModeControls
        contentMode="focused"
        diffStyle="unified"
      />,
    );

    expect(screen.queryByTestId("aligned-read-only-compare")).toBeNull();
    expect(document.querySelector(".diff-viewer-list")).not.toBeNull();
  });
});
