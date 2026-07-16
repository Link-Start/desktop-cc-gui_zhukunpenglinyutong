import { describe, expect, it } from "vitest";
import {
  areGitRepositorySummariesEqual,
  gitRepositoryStatusTokens,
  gitRepositoryStatusItems,
  normalizeGitRepositorySummaries,
  projectGitRepositoryFileStatuses,
} from "./gitRepositorySummary";

describe("gitRepositorySummary", () => {
  it("normalizes cross-platform roots and keeps root repository first", () => {
    const repositories = normalizeGitRepositorySummaries([
      {
        repository_root: "packages\\child\\",
        display_name: "child",
        current_branch: "feature/test",
        head_state: "branch",
        staged_count: 1,
        modified_count: 2,
        file_statuses: [
          { path: "src\\index.ts", status: "m" },
          { path: "../escape.ts", status: "M" },
          { path: "/absolute.ts", status: "A" },
        ],
      },
      {
        repositoryRoot: "",
        displayName: "workspace",
        headState: "detached",
        isClean: true,
      },
    ]);

    expect(repositories.map((repository) => repository.repositoryRoot)).toEqual([
      "",
      "packages/child",
    ]);
    expect(repositories[1]).toMatchObject({
      currentBranch: "feature/test",
      stagedCount: 1,
      modifiedCount: 2,
      fileStatuses: [{ path: "src/index.ts", status: "M" }],
    });
  });

  it("projects root and nested repository statuses into safe workspace paths", () => {
    const repositories = normalizeGitRepositorySummaries([
      {
        repositoryRoot: "",
        displayName: "workspace",
        headState: "branch",
        fileStatuses: [{ path: "README.md", status: "M" }],
      },
      {
        repositoryRoot: "services\\api",
        displayName: "api",
        headState: "branch",
        fileStatuses: [{ path: "src/index.ts", status: "A" }],
      },
    ]);

    expect(projectGitRepositoryFileStatuses(repositories)).toEqual([
      { path: "README.md", status: "M" },
      { path: "services/api/src/index.ts", status: "A" },
    ]);
  });

  it("compares semantic summary values instead of array identity", () => {
    const repositories = normalizeGitRepositorySummaries([
      { repositoryRoot: "repo", displayName: "repo", headState: "unborn" },
    ]);

    expect(areGitRepositorySummariesEqual(repositories, [...repositories])).toBe(true);
    expect(
      areGitRepositorySummariesEqual(repositories, [
        { ...repositories[0], untrackedCount: 1 },
      ]),
    ).toBe(false);
  });

  it("formats detached, error, sync, and dirty states consistently", () => {
    const repository = normalizeGitRepositorySummaries([
      {
        repositoryRoot: "repo",
        displayName: "repo",
        headState: "detached",
        ahead: 2,
        modifiedCount: 1,
      },
    ])[0];

    expect(repository ? gitRepositoryStatusTokens(repository) : []).toEqual([
      "HEAD",
      "↑2",
      "M1",
    ]);
    expect(repository ? gitRepositoryStatusItems(repository) : []).toEqual([
      { label: "HEAD", kind: "branch" },
      { label: "↑2", kind: "sync" },
      { label: "M1", kind: "dirty" },
    ]);
  });
});
