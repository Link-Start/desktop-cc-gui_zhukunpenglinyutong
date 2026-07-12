import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  areTurnFileChangesSummariesEqual,
  buildTurnFileChangesByBoundaryId,
  mergeTurnFileChangesSummaries,
  type TurnFileChange,
} from "./turnFileChanges";

function userMessage(id: string): ConversationItem {
  return { id, kind: "message", role: "user", text: "hi" };
}

function finalAssistant(id: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "assistant",
    text: "done",
    isFinal: true,
  };
}

function editTool(
  id: string,
  filePath: string,
  oldString: string,
  newString: string,
): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "other",
    title: "Tool: Edit",
    detail: JSON.stringify({
      file_path: filePath,
      old_string: oldString,
      new_string: newString,
    }),
    status: "completed",
    output: "ok",
  };
}

function writeTool(
  id: string,
  filePath: string,
  content: string,
): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "other",
    title: "Tool: Write",
    detail: JSON.stringify({ file_path: filePath, content }),
    status: "completed",
    output: "ok",
  };
}

function fileChangeTool(
  id: string,
  changes: { path: string; diff?: string }[],
): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "fileChange",
    title: "Tool: fileChange",
    detail: "",
    status: "completed",
    changes,
  };
}

describe("buildTurnFileChangesByBoundaryId", () => {
  it("aggregates edit tools of a turn onto its final assistant boundary", () => {
    const items: ConversationItem[] = [
      userMessage("u1"),
      editTool("t1", "src/a.ts", "line1\nline2", "line1\nline2changed\nline3"),
      writeTool("t2", "src/b.ts", "x\ny"),
      finalAssistant("a1"),
    ];
    const result = buildTurnFileChangesByBoundaryId(items);
    expect(result.size).toBe(1);
    const summary = result.get("a1");
    expect(summary?.files).toEqual([
      { path: "src/a.ts", additions: 2, deletions: 1, status: "completed" },
      { path: "src/b.ts", additions: 2, deletions: 0, status: "completed" },
    ]);
    expect(summary?.totalAdditions).toBe(4);
    expect(summary?.totalDeletions).toBe(1);
  });

  it("accumulates repeated edits to the same file", () => {
    const items: ConversationItem[] = [
      userMessage("u1"),
      editTool("t1", "src/a.ts", "old", "new"),
      editTool("t2", "src/a.ts", "foo", "bar\nbaz"),
      finalAssistant("a1"),
    ];
    const summary = buildTurnFileChangesByBoundaryId(items).get("a1");
    expect(summary?.files).toHaveLength(1);
    expect(summary?.files[0]).toEqual({
      path: "src/a.ts",
      additions: 3,
      deletions: 2,
      status: "completed",
    });
  });

  it("counts unified patch stats and splits multi-file fileChange items", () => {
    const items: ConversationItem[] = [
      userMessage("u1"),
      fileChangeTool("t1", [
        { path: "src/a.ts", diff: "@@ -1,2 +1,2 @@\n-old\n+new\n context" },
        { path: "src/b.ts", diff: "@@ -0,0 +1,2 @@\n+one\n+two" },
      ]),
      finalAssistant("a1"),
    ];
    const summary = buildTurnFileChangesByBoundaryId(items).get("a1");
    expect(summary?.files).toEqual([
      { path: "src/a.ts", additions: 1, deletions: 1, status: "completed" },
      { path: "src/b.ts", additions: 2, deletions: 0, status: "completed" },
    ]);
  });

  it("keeps turns separated by user messages", () => {
    const items: ConversationItem[] = [
      userMessage("u1"),
      editTool("t1", "src/a.ts", "a", "b"),
      finalAssistant("a1"),
      userMessage("u2"),
      editTool("t2", "src/b.ts", "c", "d"),
      finalAssistant("a2"),
    ];
    const result = buildTurnFileChangesByBoundaryId(items);
    expect(result.get("a1")?.files[0]?.path).toBe("src/a.ts");
    expect(result.get("a2")?.files[0]?.path).toBe("src/b.ts");
  });

  it("uses the last final assistant of a turn as boundary", () => {
    const items: ConversationItem[] = [
      userMessage("u1"),
      editTool("t1", "src/a.ts", "a", "b"),
      finalAssistant("a1"),
      finalAssistant("a2"),
    ];
    const result = buildTurnFileChangesByBoundaryId(items);
    expect(result.has("a1")).toBe(false);
    expect(result.get("a2")?.files).toHaveLength(1);
  });

  it("produces no entry for turns without a final assistant or without edits", () => {
    const items: ConversationItem[] = [
      userMessage("u1"),
      editTool("t1", "src/a.ts", "a", "b"),
      // 回合进行中：还没有 final assistant
      userMessage("u2"),
      finalAssistant("a2"),
    ];
    const result = buildTurnFileChangesByBoundaryId(items);
    expect(result.size).toBe(0);
  });

  it("ignores non-edit tools", () => {
    const items: ConversationItem[] = [
      userMessage("u1"),
      {
        id: "t1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: ls",
        detail: '{"command":"ls"}',
        status: "completed",
        output: "ok",
      },
      {
        id: "t2",
        kind: "tool",
        toolType: "other",
        title: "Tool: Read",
        detail: JSON.stringify({ file_path: "src/a.ts" }),
        status: "completed",
        output: "file body",
      },
      finalAssistant("a1"),
    ];
    expect(buildTurnFileChangesByBoundaryId(items).size).toBe(0);
  });

  it("merges turn summaries into a session total, accumulating same paths", () => {
    const items: ConversationItem[] = [
      userMessage("u1"),
      editTool("t1", "src/a.ts", "a", "b"),
      finalAssistant("a1"),
      userMessage("u2"),
      editTool("t2", "src/a.ts", "x", "y\nz"),
      editTool("t3", "src/b.ts", "", "new"),
      finalAssistant("a2"),
    ];
    const map = buildTurnFileChangesByBoundaryId(items);
    const session = mergeTurnFileChangesSummaries(map.values());
    expect(session?.files).toEqual([
      { path: "src/a.ts", additions: 3, deletions: 2, status: "completed" },
      { path: "src/b.ts", additions: 1, deletions: 0, status: "completed" },
    ]);
    expect(session?.totalAdditions).toBe(4);
    expect(session?.totalDeletions).toBe(2);
  });

  it("returns null when merging empty summaries", () => {
    expect(mergeTurnFileChangesSummaries([])).toBeNull();
    expect(
      mergeTurnFileChangesSummaries(
        buildTurnFileChangesByBoundaryId([userMessage("u1")]).values(),
      ),
    ).toBeNull();
  });

  it("drops files with no net change (no-op / failed-retry residue)", () => {
    const items: ConversationItem[] = [
      userMessage("u1"),
      editTool("t1", "src/a.ts", "same", "same"),
      editTool("t2", "src/b.ts", "x", "y"),
      finalAssistant("a1"),
    ];
    const summary = buildTurnFileChangesByBoundaryId(items).get("a1");
    expect(summary?.files.map((file) => file.path)).toEqual(["src/b.ts"]);
  });

  it("produces no entry when every edit is a no-op", () => {
    const items: ConversationItem[] = [
      userMessage("u1"),
      editTool("t1", "src/a.ts", "same", "same"),
      finalAssistant("a1"),
    ];
    expect(buildTurnFileChangesByBoundaryId(items).size).toBe(0);
  });

  it("marks merged file status as failed when any edit failed", () => {
    const failed: ConversationItem = {
      id: "t2",
      kind: "tool",
      toolType: "other",
      title: "Tool: Edit",
      detail: JSON.stringify({
        file_path: "src/a.ts",
        old_string: "x",
        new_string: "y",
      }),
      status: "failed",
      output: "error",
    };
    const items: ConversationItem[] = [
      userMessage("u1"),
      editTool("t1", "src/a.ts", "a", "b"),
      failed,
      finalAssistant("a1"),
    ];
    const summary = buildTurnFileChangesByBoundaryId(items).get("a1");
    expect(summary?.files[0]?.status).toBe("failed");
  });
});

describe("areTurnFileChangesSummariesEqual", () => {
  const makeSummary = (files: TurnFileChange[]) => ({
    files,
    totalAdditions: files.reduce((sum, file) => sum + file.additions, 0),
    totalDeletions: files.reduce((sum, file) => sum + file.deletions, 0),
  });
  const base = makeSummary([
    { path: "a.ts", additions: 2, deletions: 1, status: "completed" },
  ]);

  it("returns true for structurally identical summaries", () => {
    const clone = makeSummary([
      { path: "a.ts", additions: 2, deletions: 1, status: "completed" },
    ]);
    expect(areTurnFileChangesSummariesEqual(base, clone)).toBe(true);
  });

  it("returns false when any field or the file count differs", () => {
    expect(
      areTurnFileChangesSummariesEqual(
        base,
        makeSummary([
          { path: "a.ts", additions: 3, deletions: 1, status: "completed" },
        ]),
      ),
    ).toBe(false);
    expect(
      areTurnFileChangesSummariesEqual(
        base,
        makeSummary([
          { path: "b.ts", additions: 2, deletions: 1, status: "completed" },
        ]),
      ),
    ).toBe(false);
    expect(
      areTurnFileChangesSummariesEqual(
        base,
        makeSummary([
          { path: "a.ts", additions: 2, deletions: 1, status: "failed" },
        ]),
      ),
    ).toBe(false);
    expect(areTurnFileChangesSummariesEqual(base, makeSummary([]))).toBe(false);
  });
});
