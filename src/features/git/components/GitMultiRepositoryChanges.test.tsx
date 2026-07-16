/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RepositoryGitStatus } from "../hooks/useMultiRepositoryGitStatus";
import { GitMultiRepositoryChanges } from "./GitMultiRepositoryChanges";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.path ? `${key}:${params.path}` : params?.count !== undefined ? `${key}:${params.count}` : key,
  }),
}));

const repositoryStatus = (repositoryRoot: string): RepositoryGitStatus => ({
  repositoryRoot,
  displayName: repositoryRoot,
  branchName: repositoryRoot === "a" ? "main" : "sit-p2",
  stagedFiles: [],
  unstagedFiles: [{ path: "pom.xml", status: "M", additions: 1, deletions: 0 }],
  totalAdditions: 1,
  totalDeletions: 0,
  error: null,
});

describe("GitMultiRepositoryChanges", () => {
  it("renders repository groups and isolates the same relative path selection", () => {
    const onCommitRepositories = vi.fn();
    const onOpenGenerateMenu = vi.fn();
    render(
      <GitMultiRepositoryChanges
        workspaceId="ws-1"
        statuses={[repositoryStatus("a"), repositoryStatus("b")]}
        isLoading={false}
        commitMessage="fix: scoped"
        commitLoading={false}
        onCommitRepositories={onCommitRepositories}
        onOpenGenerateMenu={onOpenGenerateMenu}
      />,
    );

    const groups = document.querySelectorAll(".git-repository-change-group");
    expect(groups).toHaveLength(2);
    expect(within(groups[0] as HTMLElement).getByText("main")).not.toBeNull();
    expect(within(groups[1] as HTMLElement).getByText("sit-p2")).not.toBeNull();
    const content = document.querySelector(".git-multi-repository-changes__content");
    const composer = document.querySelector(".git-commit-composer");
    expect(Boolean(
      content && composer &&
      (content.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING),
    )).toBe(true);

    const secondFileToggle = within(groups[1] as HTMLElement).getByRole("checkbox", {
      name: "git.commitSelectionToggleFile:pom.xml",
    });
    fireEvent.click(secondFileToggle);
    const generateButton = screen.getByRole("button", {
      name: "git.generateCommitMessage",
    });
    expect(generateButton.querySelector(".commit-message-engine-icon")).not.toBeNull();
    fireEvent.click(generateButton);
    expect(onOpenGenerateMenu).toHaveBeenCalledWith(
      expect.anything(),
      [{ repositoryRoot: "b", selectedPaths: ["pom.xml"] }],
    );
    fireEvent.click(screen.getByRole("button", { name: "git.commit" }));

    expect(onCommitRepositories).toHaveBeenCalledWith([
      { repositoryRoot: "b", selectedPaths: ["pom.xml"] },
    ]);
  });
});
