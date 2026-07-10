/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../../files/components/WorkspaceFileComparePanel", () => ({
  useFileCompareEditorTheme: () => "light",
  CompareEditorColumn: ({ draft }: { draft: {
    title: string;
    content: string;
    editable: boolean;
    onChange: (value: string) => void;
    onSave: () => void;
  } }) => (
    <section aria-label={draft.title}>
      <textarea
        aria-label={`${draft.title} editor`}
        value={draft.content}
        disabled={!draft.editable}
        onChange={(event) => draft.onChange(event.currentTarget.value)}
      />
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
        fallback={<div>Read-only fallback</div>}
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

  it("uses the existing save contract and reports save success", async () => {
    const onSaveSuccess = vi.fn();
    documentState = { ...documentState, isDirty: true };
    render(
      <WorkspaceEditableDiffCompare
        workspaceId="workspace-1"
        workspacePath="/repo"
        filePath="example.ts"
        diff={PATCH}
        fallback={<div>Read-only fallback</div>}
        onSaveSuccess={onSaveSuccess}
        onDirtyChange={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Save source" }));
    await waitFor(() => expect(handleSave).toHaveBeenCalledOnce());
    expect(onSaveSuccess).toHaveBeenCalledOnce();
  });

  it("falls back when the patch cannot reconstruct the previous version", async () => {
    render(
      <WorkspaceEditableDiffCompare
        workspaceId="workspace-1"
        workspacePath="/repo"
        filePath="example.ts"
        diff="not a unified patch"
        fallback={<div>Read-only fallback</div>}
        onSaveSuccess={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    );

    expect(await screen.findByText("Read-only fallback")).toBeTruthy();
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
        fallback={<div>Read-only fallback</div>}
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
});
