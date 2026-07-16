import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fileTreeCss = readFileSync(
  fileURLToPath(new URL("./file-tree.css", import.meta.url)),
  "utf8",
);
const composerCss = readFileSync(
  fileURLToPath(new URL("./composer.part2.css", import.meta.url)),
  "utf8",
);
const darkThemeCss = readFileSync(
  fileURLToPath(new URL("./themes.dark.css", import.meta.url)),
  "utf8",
);
const lightThemeCss = readFileSync(
  fileURLToPath(new URL("./themes.light.css", import.meta.url)),
  "utf8",
);
const systemThemeCss = readFileSync(
  fileURLToPath(new URL("./themes.system.css", import.meta.url)),
  "utf8",
);

describe("file tree Git decoration styles", () => {
  it("keeps repository folder icons untouched and colors semantic text tokens", () => {
    expect(fileTreeCss).not.toContain(".file-tree-row.is-git-repository .file-tree-icon");
    expect(fileTreeCss).not.toContain(".file-tree-row.is-git-repository .file-tree-icon-cell::after");
    expect(fileTreeCss).toContain(".file-tree-git-token.is-branch");
    expect(fileTreeCss).toContain(".file-tree-git-token.is-clean");
    expect(fileTreeCss).toContain(".file-tree-git-token.is-dirty");
    expect(fileTreeCss).toContain("color: var(--git-branch)");
    expect(fileTreeCss).toContain("color: var(--git-status-modified)");
    expect(fileTreeCss).toContain("color: var(--git-status-conflict)");
    expect(fileTreeCss).toContain("font-weight: 550");
    expect(fileTreeCss).toMatch(
      /\.file-tree-row\.is-git-repository \.file-tree-name\.git-a,[\s\S]*?color: var\(--git-repository-dirty\)/,
    );
    expect(fileTreeCss).toMatch(
      /\.file-tree-git-token\.is-branch\s*\{[^}]*font-weight: 600/,
    );
    expect(composerCss).toContain("color: var(--git-branch)");
    expect(composerCss).toContain("color: var(--git-status-modified)");
    expect(composerCss).toMatch(
      /\.composer-git-repository-token\.is-branch\s*\{[^}]*font-weight: 600/,
    );
  });

  it("defines distinct IDEA-inspired Git palettes for dark, light, and system-light themes", () => {
    const darkPalette = [
      "--git-status-added: #73d0a9",
      "--git-status-modified: #ffaa3e",
      "--git-status-deleted: #f07178",
      "--git-status-renamed: #82aaff",
      "--git-status-type-changed: #c792ea",
      "--git-status-conflict: #ff5370",
      "--git-repository-dirty: #82aaff",
      "--git-branch: #ffb37a",
    ];
    const lightPalette = [
      "--git-status-added: #2e9d69",
      "--git-status-modified: #d97706",
      "--git-status-deleted: #c2414b",
      "--git-status-renamed: #2563eb",
      "--git-status-type-changed: #7c3fa3",
      "--git-status-conflict: #d32f4b",
      "--git-repository-dirty: #2563eb",
      "--git-branch: #c96b2c",
    ];

    darkPalette.forEach((token) => expect(darkThemeCss).toContain(token));
    lightPalette.forEach((token) => {
      expect(lightThemeCss).toContain(token);
      expect(systemThemeCss).toContain(token);
    });
  });
});
