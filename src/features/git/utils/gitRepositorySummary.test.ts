import { describe, expect, it } from "vitest";
import {
  areGitRepositorySummariesEqual,
  gitRepositoryStatusTokens,
  normalizeGitRepositorySummaries,
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
    });
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
  });
});
