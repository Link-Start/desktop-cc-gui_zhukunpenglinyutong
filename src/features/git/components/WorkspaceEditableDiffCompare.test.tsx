/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getGitFileFullDiff } = vi.hoisted(() => ({
  getGitFileFullDiff: vi.fn(async () => ""),
}));

const handleSave = vi.fn(async () => true);
const handleDiscard = vi.fn();
const setContent = vi.fn();
let documentState = {
  content: "const value = 'after';\n",
  setContent,
  isLoading: false,
  isSaving: false,
  error: null as string | null,
  truncated: false,
  isDirty: false,
  handleSave,
  handleDiscard,
  savedContentRef: { current: "const value = 'after';\n" },
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number>) => {
      const labels: Record<string, string> = {
        "files.editableDiff.previousVersion": "Previous version",
        "files.editableDiff.sourceCode": "Source code",
        "files.fileCompare.previousDifference": "Previous difference",
        "files.fileCompare.nextDifference": "Next difference",
        "files.fileCompare.noDifferences": "No differences",
        "files.save": "Save",
        "git.diffUnavailable": "Diff unavailable",
      };
      if (key === "files.fileCompare.differenceCount") {
        return `${values?.current} / ${values?.total} differences`;
      }
      return labels[key] ?? key;
    },
  }),
}));

vi.mock("../../files/hooks/useFileDocumentState", () => ({
  useFileDocumentState: () => documentState,
}));

vi.mock("../../../styles/featureStyleLoaders", () => ({
  loadFileViewStyles: vi.fn(async () => undefined),
}));

vi.mock("../../../services/tauri", () => ({
  getGitFileFullDiff,
}));

vi.mock("../../files/components/WorkspaceFileComparePanel", () => ({
  useFileCompareEditorTheme: () => "light",
  CompareEditorColumn: ({ draft, collapsedRanges = [] }: { draft: {
    title: string;
    content: string;
    editable: boolean;
    error: string | null;
    onChange: (value: string) => void;
    onSave: () => void;
  }; collapsedRanges?: Array<{ fromLine: number; toLine: number }> }) => (
    <section aria-label={draft.title} data-collapsed-ranges={JSON.stringify(collapsedRanges)}>
      <textarea
        aria-label={`${draft.title} editor`}
        value={draft.content}
        disabled={!draft.editable}
        onChange={(event) => draft.onChange(event.currentTarget.value)}
      />
      {draft.error ? <span>{draft.error}</span> : null}
      {draft.editable ? (
        <button type="button" onClick={draft.onSave}>Save source</button>
      ) : null}
    </section>
  ),
}));

import { WorkspaceEditableDiffCompare } from "./WorkspaceEditableDiffCompare";

const PATCH = [
  "diff --git a/example.ts b/example.ts",
  "--- a/example.ts",
  "+++ b/example.ts",
  "@@ -1 +1 @@",
  "-const value = 'before';",
  "+const value = 'after';",
  "",
].join("\n");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  getGitFileFullDiff.mockResolvedValue("");
  documentState = {
    ...documentState,
    content: "const value = 'after';\n",
    isDirty: false,
    error: null,
    truncated: false,
    savedContentRef: { current: "const value = 'after';\n" },
  };
});

describe("WorkspaceEditableDiffCompare", () => {
  it("renders a read-only previous version and an immediately editable source", async () => {
    render(
      <WorkspaceEditableDiffCompare
        workspaceId="workspace-1"
        workspacePath="/repo"
        filePath="example.ts"
        diff={PATCH}
        onSaveSuccess={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );

    const previousEditor = await screen.findByLabelText("Previous version editor");
    const sourceEditor = screen.getByLabelText("Source code editor");
    const columns = document.querySelector<HTMLElement>(".editable-diff-compare-columns");
    expect(columns?.style.getPropertyValue("--file-compare-column-count")).toBe("2");
    expect((previousEditor as HTMLTextAreaElement).disabled).toBe(true);
    expect((previousEditor as HTMLTextAreaElement).value).toBe(
      "const value = 'before';\n",
    );
    expect((sourceEditor as HTMLTextAreaElement).disabled).toBe(false);

    fireEvent.change(sourceEditor, { target: { value: "const value = 'edited';\n" } });
    expect(setContent).toHaveBeenCalledWith("const value = 'edited';\n");
  });

  it("keeps the source editable while focused mode only collapses unchanged ranges", async () => {
    const sourceLines = Array.from({ length: 12 }, (_unused, index) =>
      index === 5 ? "const value = 'after';" : `// stable ${index + 1}`,
    );
    documentState = {
      ...documentState,
      content: `${sourceLines.join("\n")}\n`,
      savedContentRef: { current: `${sourceLines.join("\n")}\n` },
    };
    const patch = "@@ -6 +6 @@\n-const value = 'before';\n+const value = 'after';\n";

    render(
      <WorkspaceEditableDiffCompare
        workspaceId="workspace-1"
        workspacePath="/repo"
        filePath="example.ts"
        diff={patch}
        contentMode="focused"
        onSaveSuccess={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );

    const sourceEditor = await screen.findByLabelText("Source code editor");
    expect((sourceEditor as HTMLTextAreaElement).disabled).toBe(false);
    expect((sourceEditor as HTMLTextAreaElement).value).toBe(`${sourceLines.join("\n")}\n`);
    expect(screen.getByLabelText("Source code").getAttribute("data-collapsed-ranges"))
      .not.toBe("[]");
  });

  it("uses the existing save contract and reports save success", async () => {
    const onSaveSuccess = vi.fn();
    documentState = { ...documentState, isDirty: true };
    render(
      <WorkspaceEditableDiffCompare
        workspaceId="workspace-1"
        workspacePath="/repo"
        filePath="example.ts"
        diff={PATCH}
        onSaveSuccess={onSaveSuccess}
        onDirtyChange={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Save source" }));
    await waitFor(() => expect(handleSave).toHaveBeenCalledOnce());
    expect(onSaveSuccess).toHaveBeenCalledOnce();
  });

  it("keeps the editable compare when the baseline cannot be reconstructed", async () => {
    render(
      <WorkspaceEditableDiffCompare
        workspaceId="workspace-1"
        workspacePath="/repo"
        filePath="example.ts"
        diff="not a unified patch"
        onSaveSuccess={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );

    expect(await screen.findByText("Diff unavailable")).toBeTruthy();
    expect(screen.getByLabelText("Source code editor")).toBeTruthy();
    expect(screen.queryByText("Read-only fallback")).toBeNull();
  });

  it("recovers the editable compare with a full diff when the preview patch is truncated", async () => {
    getGitFileFullDiff.mockResolvedValueOnce(PATCH);
    render(
      <WorkspaceEditableDiffCompare
        workspaceId="workspace-1"
        workspacePath="/repo"
        filePath="example.ts"
        diff="@@ -1 +1 @@\n[diff truncated for performance]"
        onSaveSuccess={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );

    expect(
      (await screen.findByLabelText("Previous version editor") as HTMLTextAreaElement).value,
    ).toBe("const value = 'before';\n");
    expect(getGitFileFullDiff).toHaveBeenCalledWith("workspace-1", "example.ts");
    expect(screen.queryByText("Read-only fallback")).toBeNull();
  });

  it("keeps the editable shell while the full diff request is pending", async () => {
    let resolveFullDiff: (diff: string) => void = () => {};
    getGitFileFullDiff.mockReturnValueOnce(new Promise((resolve) => {
      resolveFullDiff = resolve;
    }));
    render(
      <WorkspaceEditableDiffCompare
        workspaceId="workspace-1"
        workspacePath="/repo"
        filePath="example.ts"
        diff="not a unified patch"
        onSaveSuccess={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Source code editor")).toBeTruthy();
    expect(screen.queryByText("Diff unavailable")).toBeNull();
    expect(screen.queryByText("Read-only fallback")).toBeNull();

    await act(async () => resolveFullDiff(PATCH));
    await waitFor(() => {
      expect(
        (screen.getByLabelText("Previous version editor") as HTMLTextAreaElement).value,
      ).toBe("const value = 'before';\n");
    });
  });

  it("reconstructs the baseline from saved source when reopening a dirty cached draft", async () => {
    documentState = {
      ...documentState,
      content: "const value = 'after';\nconst localDraft = true;\n",
      isDirty: true,
      savedContentRef: { current: "const value = 'after';\n" },
    };

    render(
      <WorkspaceEditableDiffCompare
        workspaceId="workspace-1"
        workspacePath="/repo"
        filePath="example.ts"
        diff={PATCH}
        onSaveSuccess={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );

    expect(
      (await screen.findByLabelText("Previous version editor") as HTMLTextAreaElement).value,
    ).toBe("const value = 'before';\n");
    expect(
      (screen.getByLabelText("Source code editor") as HTMLTextAreaElement).value,
    ).toBe("const value = 'after';\nconst localDraft = true;\n");
    expect(screen.queryByText("Read-only fallback")).toBeNull();
  });

  it("reports only real inserted rows when a large file exceeds the matrix alignment budget", async () => {
    const headerControlsTarget = document.createElement("div");
    headerControlsTarget.className = "test-header-controls";
    document.body.appendChild(headerControlsTarget);
    const baseLines = Array.from(
      { length: 4_000 },
      (_unused, index) => `stable line ${String(index + 1).padStart(4, "0")}`,
    );
    const insertedLines = Array.from(
      { length: 14 },
      (_unused, index) => `inserted changelog line ${index + 1}`,
    );
    const sourceLines = [
      ...baseLines.slice(0, 13),
      ...insertedLines,
      ...baseLines.slice(13),
    ];
    const source = `${sourceLines.join("\n")}\n`;
    const patch = [
      "diff --git a/CHANGELOG.md b/CHANGELOG.md",
      "--- a/CHANGELOG.md",
      "+++ b/CHANGELOG.md",
      "@@ -14,0 +14,14 @@",
      ...insertedLines.map((line) => `+${line}`),
      "",
    ].join("\n");
    documentState = {
      ...documentState,
      content: source,
      savedContentRef: { current: source },
    };

    render(
      <WorkspaceEditableDiffCompare
        workspaceId="workspace-1"
        workspacePath="/repo"
        filePath="CHANGELOG.md"
        diff={patch}
        onSaveSuccess={vi.fn()}
        onDirtyChange={vi.fn()}
        headerControlsTarget={headerControlsTarget}
      />,
    );

    expect(await screen.findByText("1 / 1 differences")).toBeTruthy();
    expect(
      headerControlsTarget.querySelector(
        ".editable-diff-compare-nav.is-external",
      ),
    ).toBeTruthy();
    expect(
      document.querySelector(
        ".editable-diff-compare > .editable-diff-compare-nav",
      ),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next difference" }));
    expect(screen.getByText("1 / 1 differences")).toBeTruthy();
    expect(screen.queryByText("Read-only fallback")).toBeNull();
    headerControlsTarget.remove();
  });
});
