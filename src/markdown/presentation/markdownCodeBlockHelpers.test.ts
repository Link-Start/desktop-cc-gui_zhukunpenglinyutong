import { describe, expect, it } from "vitest";
import {
  extractCodeFenceMeta,
  extractCodeFromPre,
  extractLanguageTag,
  extractLatexContent,
  extractMarkdownContent,
  extractMermaidContent,
  extractUrlLines,
  shouldRenderMarkdownFenceAsCard,
  type MarkdownPreNode,
} from "./markdownCodeBlockHelpers";

describe("markdownCodeBlockHelpers", () => {
  it("extracts language tags from code class names", () => {
    expect(extractLanguageTag("language-ts")).toBe("ts");
    expect(extractLanguageTag("foo language-python bar")).toBe("python");
    expect(extractLanguageTag("plain")).toBeNull();
  });

  it("shows the filename and line range for start:end:path citation fences", () => {
    const meta = extractCodeFenceMeta(
      "language-247:249:src/features/update/hooks/useReleaseNotes.ts",
    );
    expect(meta.label).toBe("useReleaseNotes.ts:247-249");
    expect(meta.filePath).toBe(
      "src/features/update/hooks/useReleaseNotes.ts",
    );
    expect(meta.languageTag).toBe("typescript");
    expect(meta.startLine).toBe(247);
    expect(meta.endLine).toBe(249);
  });

  it("keeps ordinary language tags as the header label", () => {
    expect(extractCodeFenceMeta("language-ts").label).toBe("ts");
    expect(extractCodeFenceMeta("language-ts").languageTag).toBe("ts");
    expect(extractCodeFenceMeta(undefined).label).toBe("Code");
  });

  it("uses the basename when the fence info is only a file path", () => {
    const meta = extractCodeFenceMeta("language-src/markdown/components/Markdown.tsx");
    expect(meta.label).toBe("Markdown.tsx");
    expect(meta.filePath).toBe("src/markdown/components/Markdown.tsx");
  });

  it("collapses a single-line citation to file:line", () => {
    expect(
      extractCodeFenceMeta("language-12:12:src/app.ts").label,
    ).toBe("app.ts:12");
  });

  it("treats the citation tail as a path even without an extension", () => {
    expect(extractCodeFenceMeta("language-10:20:Dockerfile").label).toBe(
      "Dockerfile:10-20",
    );
  });

  it("keeps the Windows path basename for citation fences", () => {
    const meta = extractCodeFenceMeta(
      "language-10:12:C:\\repo\\src\\useReleaseNotes.ts",
    );
    expect(meta.label).toBe("useReleaseNotes.ts:10-12");
    expect(meta.filePath).toBe("C:\\repo\\src\\useReleaseNotes.ts");
  });

  it("extracts markdown, latex, and mermaid fenced content", () => {
    expect(extractMarkdownContent("md", "# Title")).toBe("# Title");
    expect(extractMarkdownContent(null, "```markdown\n# Title\n```")).toBe(
      "# Title",
    );
    expect(extractLatexContent("tex", "x^2")).toBe("x^2");
    expect(extractLatexContent(null, "```latex\nx^2\n```")).toBe("x^2");
    expect(extractMermaidContent("mermaid", "graph TD")).toBe("graph TD");
    expect(extractMermaidContent("flowchart", "flowchart TD\nA-->B")).toBe(
      "flowchart TD\nA-->B",
    );
    expect(extractMermaidContent(null, "```mermaid\ngraph TD\n```")).toBe(
      "graph TD",
    );
    expect(
      extractMermaidContent(null, "```flowchart\nflowchart TD\nA-->B\n```"),
    ).toBe("flowchart TD\nA-->B");
  });

  it("extracts code and normalizes a trailing newline from pre nodes", () => {
    const node: MarkdownPreNode = {
      children: [
        {
          tagName: "code",
          properties: { className: ["language-ts", "highlight"] },
          children: [{ value: "const value = 1;\n" }],
        },
      ],
    };

    expect(extractCodeFromPre(node)).toEqual({
      className: "language-ts highlight",
      value: "const value = 1;",
    });
  });

  it("accepts link-only pre blocks and rejects mixed text", () => {
    expect(
      extractUrlLines(["- https://example.com/a", "1. https://example.com/b"].join("\n")),
    ).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(extractUrlLines("https://example.com/a\nnot a url")).toBeNull();
  });

  it("only renders top-level markdown fences as cards", () => {
    expect(
      shouldRenderMarkdownFenceAsCard(
        { position: { start: { offset: 0 } } },
        "```markdown\n# Title\n```",
      ),
    ).toBe(true);
    expect(
      shouldRenderMarkdownFenceAsCard(
        { position: { start: { offset: 3 } } },
        "  ```markdown\n# Title\n```",
      ),
    ).toBe(false);
  });
});
