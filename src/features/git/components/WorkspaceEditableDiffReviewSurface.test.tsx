/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      "common.close": "Close",
      "files.unsavedChanges": "Unsaved changes",
      "files.unsavedChangesCloseDescription": "Changes will be lost.",
      "files.saveAndClose": "Save and close",
      "files.saving": "Saving...",
      "files.continueEditing": "Continue editing",
      "files.discardChangesAction": "Discard changes",
      "files.readOnly": "Read only",
      "files.editableDiff.title": "Editable diff",
    }[key] ?? key),
  }),
}));

vi.mock("../../../services/tauri", () => ({
  getGitFileFullDiff: vi.fn(async () => ""),
}));

vi.mock("./GitDiffViewer", () => ({
  GitDiffViewer: ({
    onRequestClose,
    onDiffStyleChange,
    onContentModeChange,
    selectedPath,
    toolbarOnly,
    showAllContentControl,
    fullDiffLoader,
  }: {
    onRequestClose?: () => void;
    onDiffStyleChange?: (style: "split" | "unified") => void;
    onContentModeChange?: (path: string, mode: "all" | "focused") => void;
    selectedPath: string;
    toolbarOnly?: boolean;
    showAllContentControl?: boolean;
    fullDiffLoader?: ((path: string) => Promise<string>) | null;
  }) => (
    <div
      data-toolbar-only={toolbarOnly ? "true" : "false"}
      data-has-full-loader={fullDiffLoader ? "true" : "false"}
    >
      Read-only diff viewer
      <button type="button" onClick={() => onDiffStyleChange?.("split")}>Dual panel</button>
      <button type="button" onClick={() => onDiffStyleChange?.("unified")}>Single column</button>
      {showAllContentControl !== false ? (
        <button type="button" onClick={() => onContentModeChange?.(selectedPath, "all")}>All content</button>
      ) : null}
      <button type="button" onClick={() => onContentModeChange?.(selectedPath, "focused")}>Focused content</button>
      {onRequestClose ? <button type="button" onClick={onRequestClose}>Close</button> : null}
    </div>
  ),
}));

vi.mock("./WorkspaceEditableDiffCompare", () => ({
  WorkspaceEditableDiffCompare: ({ onDirtyChange, onDraftActionsChange, contentMode, fullDiffLoader }: {
    onDirtyChange: (isDirty: boolean) => void;
    onDraftActionsChange: (actions: {
      save: () => Promise<boolean>;
      discard: () => void;
      isSaving: boolean;
    }) => void;
    contentMode?: "all" | "focused";
    fullDiffLoader?: ((path: string) => Promise<string>) | null;
  }) => (
    <div
      data-content-mode={contentMode}
      data-editable-has-full-loader={fullDiffLoader ? "true" : "false"}
    >
      IDEA compare
      <button type="button" onClick={() => {
        onDraftActionsChange({
          save: mockSaveDraft,
          discard: mockDiscardDraft,
          isSaving: false,
        });
        onDirtyChange(true);
      }}>Make dirty</button>
    </div>
  ),
}));

vi.mock("./WorkspaceReadOnlyDiffCompare", () => ({
  WorkspaceReadOnlyDiffCompare: ({ useFullDiff }: { useFullDiff?: boolean }) => (
    <div data-full-diff={useFullDiff ? "true" : "false"}>Read-only aligned compare</div>
  ),
}));

const mockSaveDraft = vi.fn(async () => true);
const mockDiscardDraft = vi.fn();

import { WorkspaceEditableDiffReviewSurface } from "./WorkspaceEditableDiffReviewSurface";

const editableFile = {
  filePath: "example.ts",
  status: "M",
  additions: 1,
  deletions: 1,
  diff: "@@ -1 +1 @@\n-before\n+after\n",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockSaveDraft.mockReset();
  mockSaveDraft.mockResolvedValue(true);
  mockDiscardDraft.mockReset();
});

describe("WorkspaceEditableDiffReviewSurface", () => {
  it("keeps explicit read-only commit review in the legacy focused patch body", () => {
    render(
      <WorkspaceEditableDiffReviewSurface
        workspaceId="workspace-1"
        workspacePath="/repo"
        files={[editableFile]}
        readOnlyAlignedCompare
      />,
    );

    expect(screen.queryByText("Read-only aligned compare")).toBeNull();
    expect(screen.queryByText("IDEA compare")).toBeNull();
    expect(screen.queryByRole("button", { name: "All content" })).toBeNull();
    expect(screen.getByRole("button", { name: "Focused content" })).toBeTruthy();
    expect(document.querySelector('[data-toolbar-only="false"]')).toBeTruthy();
    expect(document.querySelector('[data-has-full-loader="false"]')).toBeTruthy();
    expect(document.querySelector(".editable-diff-review-viewer.is-toolbar-only")).toBeNull();
  });

  it("opens editable text diffs directly in the IDEA compare surface", () => {
    const fullDiffLoader = vi.fn(async () => "full diff");
    render(
      <WorkspaceEditableDiffReviewSurface
        workspaceId="workspace-1"
        workspacePath="/repo"
        files={[editableFile]}
        allowEditing
        fullDiffLoader={fullDiffLoader}
      />,
    );

    expect(screen.getByText("IDEA compare")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Dual panel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Single column" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All content" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Focused content" })).toBeTruthy();
    expect(document.querySelector(".editable-diff-review-viewer.is-toolbar-only")).toBeTruthy();
    expect(document.querySelector('[data-toolbar-only="true"]')).toBeTruthy();
    expect(document.querySelector('[data-toolbar-only="false"]')).toBeNull();
    expect(document.querySelector('[data-editable-has-full-loader="true"]')).toBeTruthy();
  });

  it("keeps the aligned renderer for focused-content review", () => {
    render(
      <WorkspaceEditableDiffReviewSurface
        workspaceId="workspace-1"
        workspacePath="/repo"
        files={[editableFile]}
        allowEditing
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Focused content" }));

    expect(screen.getByText("IDEA compare")).toBeTruthy();
    expect(document.querySelector('[data-content-mode="focused"]')).toBeTruthy();
    expect(document.querySelector(".editable-diff-review-viewer.is-toolbar-only")).toBeTruthy();
  });

  it("keeps deleted files in the read-only diff viewer", () => {
    render(
      <WorkspaceEditableDiffReviewSurface
        workspaceId="workspace-1"
        workspacePath="/repo"
        files={[{ ...editableFile, status: "D" }]}
        allowEditing
      />,
    );

    expect(screen.getByText("Read-only diff viewer")).toBeTruthy();
    expect(screen.queryByText("IDEA compare")).toBeNull();
  });

  it("delegates dirty close to the parent without opening a native confirm", () => {
    const onRequestClose = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm");
    render(
      <WorkspaceEditableDiffReviewSurface
        workspaceId="workspace-1"
        workspacePath="/repo"
        files={[editableFile]}
        allowEditing
        onRequestClose={onRequestClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Make dirty" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onRequestClose).toHaveBeenCalledOnce();
  });

  it("keeps editing when the custom unsaved-changes dialog is cancelled", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    render(
      <WorkspaceEditableDiffReviewSurface
        workspaceId="workspace-1"
        workspacePath="/repo"
        files={[editableFile]}
        allowEditing
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Make dirty" }));
    fireEvent.click(screen.getByRole("button", { name: "Focused content" }));
    expect(screen.getByRole("alertdialog", { name: "Unsaved changes" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByText("IDEA compare")).toBeTruthy();
    expect(document.querySelector(".editable-diff-review-viewer.is-toolbar-only")).toBeTruthy();
  });

  it("discards the draft and applies a pending view-mode change", () => {
    const onDirtyChange = vi.fn();
    render(
      <WorkspaceEditableDiffReviewSurface
        workspaceId="workspace-1"
        workspacePath="/repo"
        files={[editableFile]}
        allowEditing
        onDirtyChange={onDirtyChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Make dirty" }));
    fireEvent.click(screen.getByRole("button", { name: "Focused content" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(mockDiscardDraft).toHaveBeenCalledOnce();
    expect(screen.getByText("IDEA compare")).toBeTruthy();
    expect(document.querySelector('[data-content-mode="focused"]')).toBeTruthy();
    expect(document.querySelector(".editable-diff-review-viewer.is-toolbar-only")).toBeTruthy();
  });

  it("saves before applying a pending view-mode change", async () => {
    render(
      <WorkspaceEditableDiffReviewSurface
        workspaceId="workspace-1"
        workspacePath="/repo"
        files={[editableFile]}
        allowEditing
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Make dirty" }));
    fireEvent.click(screen.getByRole("button", { name: "Focused content" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and close" }));

    await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledOnce());
    expect(screen.getByText("IDEA compare")).toBeTruthy();
    expect(document.querySelector('[data-content-mode="focused"]')).toBeTruthy();
  });

  it("keeps the dialog and editable compare open when save fails", async () => {
    mockSaveDraft.mockResolvedValueOnce(false);
    render(
      <WorkspaceEditableDiffReviewSurface
        workspaceId="workspace-1"
        workspacePath="/repo"
        files={[editableFile]}
        allowEditing
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Make dirty" }));
    fireEvent.click(screen.getByRole("button", { name: "Focused content" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and close" }));

    await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledOnce());
    expect(screen.getByRole("alertdialog", { name: "Unsaved changes" })).toBeTruthy();
    expect(screen.getByText("IDEA compare")).toBeTruthy();
  });
});
