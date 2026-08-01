import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readComponentSource(fileName: string): string {
  return readFileSync(join(currentDir, fileName), "utf8");
}

describe("shared Markdown lazy runtime boundary", () => {
  it("keeps full parser imports out of the canonical Markdown shell", () => {
    const shellSource = readComponentSource("Markdown.tsx");

    expect(shellSource).not.toMatch(/^import .*["']react-markdown["'];?$/m);
    expect(shellSource).not.toMatch(/^import .*["']remark-[^"']+["'];?$/m);
    expect(shellSource).not.toMatch(/^import .*["']rehype-[^"']+["'];?$/m);
    expect(shellSource).toContain('import("../runtime/FullMarkdownRuntime")');
  });

  it("keeps file-preview fast HTML body renderer out of canonical Markdown", () => {
    const shellSource = readComponentSource("Markdown.tsx");

    expect(shellSource).not.toContain("FileMarkdownFastPreview");
    expect(shellSource).not.toContain("FileMarkdownPreviewFast");
    expect(shellSource).not.toContain("dangerouslySetInnerHTML={{ __html: result.html }}");
  });

  it("keeps the full parser stack isolated in the shared runtime", () => {
    const runtimeSource = readComponentSource("../runtime/FullMarkdownRuntime.tsx");

    expect(runtimeSource).toContain('from "react-markdown"');
    expect(runtimeSource).toContain('from "remark-gfm"');
    expect(runtimeSource).toContain('from "rehype-sanitize"');
  });
});
