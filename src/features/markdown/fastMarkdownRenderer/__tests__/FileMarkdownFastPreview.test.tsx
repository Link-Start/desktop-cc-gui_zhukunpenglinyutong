/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileMarkdownFastPreview } from "../FileMarkdownFastPreview";
import { useFastMarkdownRender } from "../useFastMarkdownRender";
import type { FastMarkdownRenderResult } from "../types";

vi.mock("../useFastMarkdownRender", () => ({
  useFastMarkdownRender: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

describe("FileMarkdownFastPreview annotation action", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the standard annotation action from fast renderer overlay anchors", () => {
    vi.mocked(useFastMarkdownRender).mockReturnValue({
      result: buildFastMarkdownResult(),
      status: "ready",
      resolvedProfile: "fast-html",
      error: null,
      shouldFallback: false,
    });
    const onAnnotationStart = vi.fn();

    render(
      <FileMarkdownFastPreview
        value={"# Title\n\nbody\n"}
        documentKey="docs/large.md"
        onAnnotationStart={onAnnotationStart}
        annotationActionLabel="标注给 AI"
      />,
    );

    const preview = screen.getByTestId("file-markdown-fast-preview");
    const paragraph = preview.querySelector<HTMLElement>("[data-source-block-id='paragraph-1']");
    expect(paragraph).not.toBeNull();

    fireEvent.mouseMove(paragraph as HTMLElement);

    const actionButton = screen.getByRole("button", { name: "标注给 AI L3-3" });
    expect(actionButton.getAttribute("data-active")).toBe("true");

    fireEvent.click(actionButton);

    expect(onAnnotationStart).toHaveBeenCalledWith({ startLine: 3, endLine: 3 });
    expect(preview.getAttribute("data-markdown-annotation-action-count")).toBeNull();
    expect(
      screen
        .getByTestId("file-markdown-fast-annotation-layer")
        .getAttribute("data-markdown-annotation-action-count"),
    ).toBe("2");
  });

  it("keeps annotation overlay diagnostics off the fast HTML surface", () => {
    vi.mocked(useFastMarkdownRender).mockReturnValue({
      result: buildFastMarkdownResult(),
      status: "ready",
      resolvedProfile: "fast-html",
      error: null,
      shouldFallback: false,
    });
    const { rerender } = render(
      <FileMarkdownFastPreview
        value={"# Title\n\nbody\n"}
        documentKey="docs/large.md"
        annotationDraft={null}
        renderAnnotationDraft={(draft) => <span>{draft.body}</span>}
      />,
    );
    const preview = screen.getByTestId("file-markdown-fast-preview");

    rerender(
      <FileMarkdownFastPreview
        value={"# Title\n\nbody\n"}
        documentKey="docs/large.md"
        annotationDraft={{ lineRange: { startLine: 3, endLine: 3 }, body: "draft" }}
        renderAnnotationDraft={(draft) => <span>{draft.body}</span>}
      />,
    );

    expect(screen.getByTestId("file-markdown-fast-preview")).toBe(preview);
    expect(preview.getAttribute("data-markdown-annotation-overlay-count")).toBeNull();
    expect(
      screen
        .getByTestId("file-markdown-fast-annotation-layer")
        .getAttribute("data-markdown-annotation-overlay-count"),
    ).toBe("1");
  });
});

function buildFastMarkdownResult(): FastMarkdownRenderResult {
  return {
    cacheKey: "docs-large:fast-html:hash",
    contentHash: "hash",
    html: [
      '<h1 data-source-block-id="heading-1" data-source-line-start="1" data-source-line-end="1">Title</h1>',
      '<p data-source-block-id="paragraph-1" data-source-line-start="3" data-source-line-end="3">body</p>',
    ].join(""),
    outline: [],
    sourceLineAnchors: [
      { blockId: "heading-1", startLine: 1, endLine: 1 },
      { blockId: "paragraph-1", startLine: 3, endLine: 3 },
    ],
    heavyBlocks: [],
    diagnostics: {
      profile: "fast-html",
      contentHash: "hash",
      cacheKey: "docs-large:fast-html:hash",
      cacheState: "miss",
      compileDurationMs: 1,
      sanitizeDurationMs: 1,
      totalSourceLines: 3,
      totalHeadings: 1,
      totalHeavyBlocks: 0,
      fallbackReason: "none",
      truncated: false,
      featureFlagApplied: true,
    },
    rendererProfile: "fast-html",
  };
}
