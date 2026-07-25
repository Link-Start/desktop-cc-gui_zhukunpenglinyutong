import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

describe("file Markdown preview renderer boundary", () => {
  it("keeps FileViewBody on the canonical router", () => {
    const consumerSource = readSource(
      "src/features/files/components/FileViewBody.tsx",
    );

    expect(consumerSource).toContain(
      'import { FileMarkdownPreview } from "./FileMarkdownPreviewRouter";',
    );
    expect(consumerSource).not.toContain('from "./FileMarkdownPreviewFast"');
    expect(consumerSource).not.toContain('from "./FileMarkdownPreviewRich"');
  });

  it("keeps renderer dependencies one-way", () => {
    const routerSource = readSource(
      "src/features/files/components/FileMarkdownPreviewRouter.tsx",
    );
    const richSource = readSource(
      "src/features/files/components/FileMarkdownPreview.tsx",
    );

    expect(routerSource).toContain('from "./FileMarkdownPreview"');
    expect(richSource).not.toContain('from "./FileMarkdownPreviewRouter"');
    expect(richSource).not.toContain('from "./FileMarkdownPreviewFast"');
  });

  it("keeps the legacy Fast entry as a logic-free compatibility alias", () => {
    const compatibilitySource = readSource(
      "src/features/files/components/FileMarkdownPreviewFast.tsx",
    );

    expect(compatibilitySource).toContain(
      "FileMarkdownPreview as FileMarkdownPreviewFast",
    );
    expect(compatibilitySource).not.toContain("useState");
    expect(compatibilitySource).not.toContain("FileMarkdownPreviewRich");
  });
});
