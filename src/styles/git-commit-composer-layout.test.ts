import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const diffCss = readFileSync(
  fileURLToPath(new URL("./diff.css", import.meta.url)),
  "utf8",
);

describe("Git commit composer layout", () => {
  it("keeps single and multi repository file content scrollable above a fixed footer", () => {
    expect(diffCss).toMatch(
      /\.diff-commit-workspace-content,[\s\S]*?\.git-multi-repository-changes__content\s*\{[^}]*overflow-y:\s*auto/s,
    );
    expect(diffCss).toMatch(
      /\.git-commit-composer\s*\{[^}]*flex:\s*0 0 auto/s,
    );
    expect(diffCss).toMatch(
      /\.git-multi-repository-changes\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s,
    );
  });
});
