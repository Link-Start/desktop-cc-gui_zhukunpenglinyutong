import { describe, expect, it } from "vitest";
import type { GitRepositorySummary } from "../../../types";
import { resolveFileGitScope } from "./fileGitScope";

function repository(repositoryRoot: string): GitRepositorySummary {
  return {
    repositoryRoot,
    displayName: repositoryRoot || "root",
    currentBranch: "main",
    headState: "branch",
    upstream: null,
    ahead: 0,
    behind: 0,
    stagedCount: 0,
    modifiedCount: 0,
    untrackedCount: 0,
    conflictedCount: 0,
    fileStatuses: [],
    isClean: true,
    error: null,
  };
}

describe("resolveFileGitScope", () => {
  it("keeps a root repository file workspace-relative", () => {
    expect(resolveFileGitScope("src/app.ts", [repository("")])).toEqual({
      repositoryRoot: "",
      path: "src/app.ts",
    });
  });

  it("selects the longest nested repository match", () => {
    expect(resolveFileGitScope("packages/app/src/main.ts", [
      repository(""),
      repository("packages"),
      repository("packages/app"),
    ])).toEqual({
      repositoryRoot: "packages/app",
      path: "src/main.ts",
    });
  });

  it("normalizes Windows separators", () => {
    expect(resolveFileGitScope("packages\\app\\src\\main.ts", [
      repository("packages\\app"),
    ])).toEqual({
      repositoryRoot: "packages/app",
      path: "src/main.ts",
    });
  });

  it.each(["../secret", "src/../../secret", "/absolute.ts", "C:\\absolute.ts"])(
    "rejects escaping or absolute path %s",
    (path) => expect(resolveFileGitScope(path, [repository("")])).toBeNull(),
  );

  it("returns null when no repository owns the file", () => {
    expect(resolveFileGitScope("apps/web/main.ts", [repository("packages/app")])).toBeNull();
  });
});
