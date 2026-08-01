import { describe, expect, it, vi } from "vitest";
import type { GitRepositorySummary } from "../../../types";
import {
  buildGitRepositoryIconColorSlots,
  compareGitIdentity,
} from "./gitRepositoryIconColors";

const repository = (repositoryRoot: string): GitRepositorySummary => ({
  repositoryRoot,
  displayName: repositoryRoot || ".",
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
});

describe("gitRepositoryIconColors", () => {
  it("orders Git identities without host locale collation", () => {
    const localeCompare = vi.spyOn(String.prototype, "localeCompare");
    const identities = ["仓库", "services\\api", "service", "Service"];

    expect(identities.sort(compareGitIdentity)).toEqual([
      "Service",
      "service",
      "services\\api",
      "仓库",
    ]);
    expect(localeCompare).not.toHaveBeenCalled();
  });

  it("keeps colliding repository color slots stable across input order", () => {
    const forward = buildGitRepositoryIconColorSlots([
      repository("repo-3"),
      repository("repo-10"),
      repository("services\\api"),
      repository("仓库"),
    ]);
    const reversed = buildGitRepositoryIconColorSlots([
      repository("仓库"),
      repository("services\\api"),
      repository("repo-10"),
      repository("repo-3"),
    ]);

    expect(Object.fromEntries(forward)).toEqual(Object.fromEntries(reversed));
    expect(forward.get("repo-3")).not.toBe(forward.get("repo-10"));
    expect(forward.has("services\\api")).toBe(true);
    expect(forward.has("仓库")).toBe(true);
  });
});
