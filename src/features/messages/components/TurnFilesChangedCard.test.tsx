// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TurnFilesChangedCard } from "./TurnFilesChangedCard";
import type { TurnFileChangesSummary } from "../utils/turnFileChanges";

function buildSummary(fileCount: number): TurnFileChangesSummary {
  const files = Array.from({ length: fileCount }, (_, index) => ({
    path: `src/file-${index}.ts`,
    additions: index + 1,
    deletions: index,
    status: "completed" as const,
  }));
  return {
    files,
    totalAdditions: files.reduce((sum, file) => sum + file.additions, 0),
    totalDeletions: files.reduce((sum, file) => sum + file.deletions, 0),
  };
}

afterEach(() => {
  cleanup();
});

describe("TurnFilesChangedCard", () => {
  it("renders title, total stats and collapses long file lists", () => {
    render(<TurnFilesChangedCard summary={buildSummary(6)} />);
    expect(screen.getByText("messages.turnFilesChanged.title")).toBeTruthy();
    // 总计 +21 -15（1+..+6 / 0+..+5）
    expect(screen.getByText("+21")).toBeTruthy();
    expect(screen.getByText("-15")).toBeTruthy();
    // 收起态只显示前 4 个文件
    expect(screen.getByText("file-0.ts")).toBeTruthy();
    expect(screen.getByText("file-3.ts")).toBeTruthy();
    expect(screen.queryByText("file-4.ts")).toBeNull();
    expect(screen.getByText("messages.turnFilesChanged.showMore")).toBeTruthy();
  });

  it("hides undo and review entry points in the display-only version", () => {
    render(<TurnFilesChangedCard summary={buildSummary(2)} />);
    expect(screen.queryByText("messages.turnFilesChanged.revert")).toBeNull();
    expect(screen.queryByText("messages.turnFilesChanged.review")).toBeNull();
  });

  it("expands hidden files when clicking show-more", () => {
    render(<TurnFilesChangedCard summary={buildSummary(6)} />);
    fireEvent.click(screen.getByText("messages.turnFilesChanged.showMore"));
    expect(screen.getByText("file-5.ts")).toBeTruthy();
    expect(screen.queryByText("messages.turnFilesChanged.showMore")).toBeNull();
  });

  it("renders file rows as non-clickable display-only elements", () => {
    render(<TurnFilesChangedCard summary={buildSummary(2)} />);
    expect(screen.getByText("file-0.ts").closest("button")).toBeNull();
    expect(screen.getByText("file-1.ts").closest("button")).toBeNull();
  });
});
