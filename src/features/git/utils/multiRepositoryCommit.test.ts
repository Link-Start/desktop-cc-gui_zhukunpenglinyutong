import { describe, expect, it, vi } from "vitest";
import { runMultiRepositoryCommitOperations } from "./multiRepositoryCommit";

const status = (path: string) => ({
  stagedFiles: [{ path }],
  unstagedFiles: [],
});

describe("runMultiRepositoryCommitOperations", () => {
  it("commits repositories sequentially with explicit repository roots", async () => {
    const calls: string[] = [];
    const commit = vi.fn(async (_workspaceId: string, _message: string, repositoryRoot: string) => {
      calls.push(repositoryRoot);
    });
    const outcomes = await runMultiRepositoryCommitOperations({
      workspaceId: "ws-1",
      commitMessage: "feat: multi repository",
      repositories: [
        { repositoryRoot: "a", displayName: "a", gitStatus: status("pom.xml"), selectedPaths: ["pom.xml"] },
        { repositoryRoot: "b", displayName: "b", gitStatus: status("pom.xml"), selectedPaths: ["pom.xml"] },
      ],
      stageFile: vi.fn(),
      unstageFile: vi.fn(),
      commit,
      push: vi.fn(),
    });

    expect(calls).toEqual(["a", "b"]);
    expect(outcomes.map((outcome) => outcome.committed)).toEqual([true, true]);
  });

  it("continues after one repository fails and only pushes successful commits", async () => {
    const commit = vi.fn(async (_workspaceId: string, _message: string, repositoryRoot: string) => {
      if (repositoryRoot === "a") throw new Error("hook rejected");
    });
    const push = vi.fn(async () => undefined);
    const outcomes = await runMultiRepositoryCommitOperations({
      workspaceId: "ws-1",
      commitMessage: "fix: partial success",
      repositories: [
        { repositoryRoot: "a", displayName: "a", gitStatus: status("same.ts"), selectedPaths: ["same.ts"] },
        { repositoryRoot: "b", displayName: "b", gitStatus: status("same.ts"), selectedPaths: ["same.ts"] },
      ],
      pushAfterCommit: true,
      stageFile: vi.fn(),
      unstageFile: vi.fn(),
      commit,
      push,
    });

    expect(outcomes[0]).toMatchObject({ committed: false, commitError: "hook rejected", pushed: false });
    expect(outcomes[1]).toMatchObject({ committed: true, commitError: null, pushed: true });
    expect(push).toHaveBeenCalledWith("ws-1", "b");
  });

  it("returns one failure outcome per repository when all commits fail", async () => {
    const outcomes = await runMultiRepositoryCommitOperations({
      workspaceId: "ws-1",
      commitMessage: "fix: rejected commits",
      repositories: [
        { repositoryRoot: "a", displayName: "a", gitStatus: status("a.ts"), selectedPaths: ["a.ts"] },
        { repositoryRoot: "b", displayName: "b", gitStatus: status("b.ts"), selectedPaths: ["b.ts"] },
      ],
      stageFile: vi.fn(),
      unstageFile: vi.fn(),
      commit: vi.fn(async () => { throw new Error("commit rejected"); }),
      push: vi.fn(),
    });

    expect(outcomes).toHaveLength(2);
    expect(outcomes.every((outcome) => !outcome.committed && outcome.commitError === "commit rejected")).toBe(true);
  });

  it("reports push failure without changing a successful commit outcome", async () => {
    const outcomes = await runMultiRepositoryCommitOperations({
      workspaceId: "ws-1",
      commitMessage: "feat: committed locally",
      repositories: [
        { repositoryRoot: "a", displayName: "a", gitStatus: status("a.ts"), selectedPaths: ["a.ts"] },
      ],
      pushAfterCommit: true,
      stageFile: vi.fn(),
      unstageFile: vi.fn(),
      commit: vi.fn(),
      push: vi.fn(async () => { throw new Error("remote rejected"); }),
    });

    expect(outcomes[0]).toMatchObject({
      committed: true,
      pushed: false,
      commitError: null,
      pushError: "remote rejected",
    });
  });
});
