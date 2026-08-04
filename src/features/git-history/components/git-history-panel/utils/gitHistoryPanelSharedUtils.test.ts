import { describe, expect, it, vi } from "vitest";
import type { GitCommitFileChange } from "../../../../../types";
import {
  buildFileTreeItems,
  collectDirPaths,
  getBranchAheadBehindTooltip,
} from "./gitHistoryPanelSharedUtils";

function createFileChange(path: string): GitCommitFileChange {
  return {
    path,
    status: "M",
    additions: 1,
    deletions: 0,
    diff: "",
    lineCount: 0,
    truncated: false,
  };
}

describe("gitHistoryPanelSharedUtils file tree projection", () => {
  it("compacts a single-child directory chain onto its deepest canonical path", () => {
    const files = [createFileChange("a/b/c/d.txt")];
    const items = buildFileTreeItems(files, collectDirPaths(files));

    expect(items.map((item) => item.label)).toEqual(["a.b.c", "d.txt"]);
    expect(items[0]).toMatchObject({
      id: "dir:a/b/c",
      type: "dir",
      path: "a/b/c",
      depth: 0,
      expanded: true,
    });
    expect(items[1]).toMatchObject({
      type: "file",
      path: "a/b/c/d.txt",
      depth: 1,
    });

    const collapsedItems = buildFileTreeItems(files, new Set(["a", "a/b"]));
    expect(collapsedItems).toEqual([
      expect.objectContaining({
        id: "dir:a/b/c",
        label: "a.b.c",
        path: "a/b/c",
        expanded: false,
      }),
    ]);
  });

  it("stops at a branch and compacts each child chain independently", () => {
    const files = [
      createFileChange("src/main/java/com/example/App.java"),
      createFileChange("src/test/java/com/example/AppTest.java"),
    ];
    const items = buildFileTreeItems(files, collectDirPaths(files));

    expect(items.map((item) => item.label)).toEqual([
      "src",
      "main.java.com.example",
      "App.java",
      "test.java.com.example",
      "AppTest.java",
    ]);
    expect(items.filter((item) => item.type === "dir")).toEqual([
      expect.objectContaining({ path: "src", depth: 0 }),
      expect.objectContaining({ path: "src/main/java/com/example", depth: 1 }),
      expect.objectContaining({ path: "src/test/java/com/example", depth: 1 }),
    ]);
  });

  it("does not compact across a directory containing a direct file", () => {
    const files = [
      createFileChange("src/package.json"),
      createFileChange("src/app/main.ts"),
    ];
    const items = buildFileTreeItems(files, collectDirPaths(files));

    expect(items.map((item) => item.label)).toEqual([
      "src",
      "app",
      "main.ts",
      "package.json",
    ]);
    expect(items.find((item) => item.path === "src/package.json")).toMatchObject({
      type: "file",
      depth: 1,
    });
  });

  it("normalizes Windows paths while keeping colliding dotted labels distinct", () => {
    const files = [
      createFileChange("a.b/file-a.ts"),
      createFileChange("a\\b\\file-b.ts"),
    ];
    const items = buildFileTreeItems(files, collectDirPaths(files), "repository");
    const folders = items.filter((item) => item.type === "dir");

    expect(items[0]).toMatchObject({
      id: "dir:/",
      label: "repository",
      depth: 0,
      expanded: true,
    });
    expect(folders.filter((item) => item.label === "a.b")).toEqual([
      expect.objectContaining({ id: "dir:a.b", path: "a.b", depth: 1 }),
      expect.objectContaining({ id: "dir:a/b", path: "a/b", depth: 1 }),
    ]);
    expect(items.filter((item) => item.type === "file").map((item) => item.label)).toEqual([
      "file-a.ts",
      "file-b.ts",
    ]);
  });

  it("keeps the synthetic root distinct from a real root-named directory", () => {
    const files = [createFileChange("__repo_root__/file.ts")];
    const items = buildFileTreeItems(files, collectDirPaths(files), "repository");

    expect(items.filter((item) => item.type === "dir")).toEqual([
      expect.objectContaining({ id: "dir:/", path: "/", depth: 0 }),
      expect.objectContaining({
        id: "dir:__repo_root__",
        path: "__repo_root__",
        depth: 1,
      }),
    ]);
  });
});

describe("getBranchAheadBehindTooltip", () => {
  it("prefers upstream-specific copy when upstream is present", () => {
    const t = vi.fn((key: string, options?: Record<string, unknown>) => {
      if (key === "git.historyBranchBehindOfTooltip") {
        return `落后 ${options?.upstream} ${options?.count} 个提交`;
      }
      if (key === "git.historyBranchAheadOfTooltip") {
        return `领先 ${options?.upstream} ${options?.count} 个提交`;
      }
      return key;
    });

    expect(getBranchAheadBehindTooltip("behind", 14, "origin/chore/bump-version-0.7.7", t))
      .toBe("落后 origin/chore/bump-version-0.7.7 14 个提交");
    expect(getBranchAheadBehindTooltip("ahead", 3, "origin/main", t))
      .toBe("领先 origin/main 3 个提交");
  });

  it("falls back to generic upstream wording when upstream is missing", () => {
    const t = vi.fn((key: string, options?: Record<string, unknown>) => {
      if (key === "git.historyBranchBehindTooltip") {
        return `落后上游 ${options?.count} 个提交`;
      }
      if (key === "git.historyBranchAheadTooltip") {
        return `领先上游 ${options?.count} 个提交`;
      }
      return key;
    });

    expect(getBranchAheadBehindTooltip("behind", 14, null, t))
      .toBe("落后上游 14 个提交");
    expect(getBranchAheadBehindTooltip("ahead", 2, "   ", t))
      .toBe("领先上游 2 个提交");
  });
});
