import { describe, expect, it } from "vitest";
import { buildCodeSelectionNoteDraft } from "./noteCapture";

describe("buildCodeSelectionNoteDraft", () => {
  it("builds a single-line source-aware draft", () => {
    const draft = buildCodeSelectionNoteDraft({
      path: "src/features/demo.ts",
      content: "const answer = 42;",
      startLine: 7,
      endLine: 7,
      language: "typescript",
    });

    expect(draft).toEqual({
      title: "demo.ts · L7",
      bodyMarkdown: ["```typescript", "const answer = 42;", "```"].join("\n"),
      source: {
        kind: "codeSelection",
        path: "src/features/demo.ts",
        startLine: 7,
        endLine: 7,
        language: "typescript",
      },
    });
  });

  it("uses a fence longer than embedded backtick runs", () => {
    const draft = buildCodeSelectionNoteDraft({
      path: "README.md",
      content: "before\n```\ninside\n```\nafter",
      startLine: 3,
      endLine: 7,
      language: "markdown",
    });

    expect(draft?.bodyMarkdown).toContain("````markdown");
    expect(draft?.bodyMarkdown.endsWith("````")).toBe(true);
    expect(draft?.bodyMarkdown).not.toContain("## README.md");
    expect(draft?.bodyMarkdown).not.toContain("L3–L7");
  });

  it("preserves leading indentation and an existing trailing newline", () => {
    const content = "    if (ready) {\n      await run();\n    }\n";
    const draft = buildCodeSelectionNoteDraft({
      path: "src/run.ts",
      content,
      startLine: 12,
      endLine: 14,
      language: "typescript",
    });

    expect(draft?.bodyMarkdown).toBe(`\`\`\`typescript\n${content}\`\`\``);
  });

  it("rejects empty content and invalid ranges", () => {
    expect(
      buildCodeSelectionNoteDraft({
        path: "src/demo.ts",
        content: " ",
        startLine: 1,
        endLine: 1,
      }),
    ).toBeNull();
    expect(
      buildCodeSelectionNoteDraft({
        path: "src/demo.ts",
        content: "value",
        startLine: 4,
        endLine: 2,
      }),
    ).toBeNull();
  });
});
