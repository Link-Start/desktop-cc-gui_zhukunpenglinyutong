import { describe, expect, it } from "vitest";
import {
  appendCodeAnnotationsToPrompt,
  buildCodeAnnotationDedupeKey,
  createCodeAnnotationAnchor,
  createCodeAnnotationSelection,
  formatCodeAnnotationForPrompt,
  isSameCodeAnnotationPath,
  normalizeCodeAnnotationTarget,
  resolveCodeAnnotationAnchor,
} from "./codeAnnotations";

describe("code annotation helpers", () => {
  it("normalizes path, body and reversed line ranges", () => {
    expect(
      normalizeCodeAnnotationTarget({
        path: "\\src\\App.tsx",
        lineRange: { startLine: 9, endLine: 3 },
        body: "  解释这里  ",
        source: "file-edit-mode",
      }),
    ).toEqual({
      path: "src/App.tsx",
      lineRange: { startLine: 3, endLine: 9 },
      body: "解释这里",
      source: "file-edit-mode",
    });
  });

  it("rejects invalid targets", () => {
    expect(
      normalizeCodeAnnotationTarget({
        path: "",
        lineRange: { startLine: 1, endLine: 1 },
        body: "body",
        source: "file-edit-mode",
      }),
    ).toBeNull();
    expect(
      normalizeCodeAnnotationTarget({
        path: "src/App.tsx",
        lineRange: { startLine: 0, endLine: 1 },
        body: "body",
        source: "file-edit-mode",
      }),
    ).toBeNull();
    expect(
      normalizeCodeAnnotationTarget({
        path: "src/App.tsx",
        lineRange: { startLine: 1, endLine: 1 },
        body: " ",
        source: "file-edit-mode",
      }),
    ).toBeNull();
  });

  it("creates stable dedupe keys and prompt blocks", () => {
    const selection = createCodeAnnotationSelection({
      path: "src/App.tsx",
      lineRange: { startLine: 12, endLine: 18 },
      body: "这里需要说明状态恢复逻辑",
      source: "file-edit-mode",
    });
    expect(selection?.id).toMatch(/^code-annotation:[a-z0-9]+$/);
    expect(
      buildCodeAnnotationDedupeKey({
        path: "C:\\Repo\\src\\App.tsx",
        lineRange: { startLine: 12, endLine: 18 },
        body: "A",
        source: "file-edit-mode",
      }),
    ).toBe("c:/repo/src/app.tsx::12::18::A");
    expect(selection ? formatCodeAnnotationForPrompt(selection) : "").toBe(
      "@file `src/App.tsx#L12-L18`\n标注：这里需要说明状态恢复逻辑",
    );
  });

  it("appends annotations after user text without losing full body", () => {
    const selection = createCodeAnnotationSelection({
      path: "src/App.tsx",
      lineRange: { startLine: 5, endLine: 5 },
      body: "解释这一行",
      source: "file-preview-mode",
    });
    expect(selection ? appendCodeAnnotationsToPrompt("请处理", [selection]) : "").toBe(
      "请处理\n\n@file `src/App.tsx#L5`\n标注：解释这一行",
    );
  });

  it("compares annotation paths across Windows and POSIX separators", () => {
    expect(isSameCodeAnnotationPath("src\\App.tsx", "src/App.tsx")).toBe(true);
    expect(isSameCodeAnnotationPath("C:\\Repo\\src\\App.tsx", "c:/repo/src/App.tsx")).toBe(true);
    expect(isSameCodeAnnotationPath("src/App.tsx", "src/app.tsx")).toBe(false);
    expect(isSameCodeAnnotationPath("", "src/App.tsx")).toBe(false);
  });

  it("relocates an exact anchored selection after lines are inserted above it", () => {
    const originalContent = [
      "import React from 'react';",
      "",
      "function App() {",
      "  return <main>Hello</main>;",
      "}",
    ].join("\n");
    const anchor = createCodeAnnotationAnchor(originalContent, {
      startLine: 3,
      endLine: 4,
    });
    expect(anchor?.selectedText).toBe(
      "function App() {\n  return <main>Hello</main>;",
    );

    expect(
      resolveCodeAnnotationAnchor(
        ["// inserted", "// inserted again", originalContent].join("\n"),
        {
          lineRange: { startLine: 3, endLine: 4 },
          anchor,
        },
      ),
    ).toEqual({
      lineRange: { startLine: 5, endLine: 6 },
      status: "relocated",
    });
  });

  it("uses context fingerprint to resolve duplicate exact snapshots", () => {
    const originalContent = [
      "first context",
      "shared();",
      "first suffix",
      "second context",
      "shared();",
      "second suffix",
    ].join("\n");
    const anchor = createCodeAnnotationAnchor(originalContent, {
      startLine: 5,
      endLine: 5,
    });
    const shiftedContent = [
      "inserted",
      "first context",
      "shared();",
      "first suffix",
      "second context",
      "shared();",
      "second suffix",
    ].join("\n");

    expect(
      resolveCodeAnnotationAnchor(shiftedContent, {
        lineRange: { startLine: 5, endLine: 5 },
        anchor,
      }),
    ).toEqual({
      lineRange: { startLine: 6, endLine: 6 },
      status: "relocated",
    });
  });

  it("returns stale for ambiguous or out-of-window matches", () => {
    const ambiguousAnchor = createCodeAnnotationAnchor(
      "shared();",
      { startLine: 1, endLine: 1 },
    );
    expect(
      resolveCodeAnnotationAnchor(
        ["unchanged", "changed", "shared();", "gap", "shared();"].join("\n"),
        {
          lineRange: { startLine: 2, endLine: 2 },
          anchor: ambiguousAnchor,
        },
      ).status,
    ).toBe("stale");

    const originalContent = ["before", "target();", "after"].join("\n");
    const distantAnchor = createCodeAnnotationAnchor(originalContent, {
      startLine: 2,
      endLine: 2,
    });
    const distantContent = [
      "before changed",
      ...Array.from({ length: 121 }, (_, index) => `padding ${index}`),
      "target();",
      "after",
    ].join("\n");
    expect(
      resolveCodeAnnotationAnchor(distantContent, {
        lineRange: { startLine: 2, endLine: 2 },
        anchor: distantAnchor,
      }).status,
    ).toBe("stale");
  });

  it("keeps legacy annotations unanchored and includes snapshots in new prompts", () => {
    expect(
      resolveCodeAnnotationAnchor("one\ntwo", {
        lineRange: { startLine: 2, endLine: 2 },
      }),
    ).toEqual({
      lineRange: { startLine: 2, endLine: 2 },
      status: "unanchored",
    });

    const anchor = createCodeAnnotationAnchor("one\ntwo", {
      startLine: 2,
      endLine: 2,
    });
    const selection = createCodeAnnotationSelection({
      path: "src/App.tsx",
      lineRange: { startLine: 2, endLine: 2 },
      body: "解释",
      source: "file-preview-mode",
      anchor,
    });
    expect(selection ? formatCodeAnnotationForPrompt(selection) : "").toBe(
      "@file `src/App.tsx#L2`\n标注：解释\n选中代码：\ntwo",
    );
  });
});
