import { describe, expect, it, beforeEach } from "vitest";
import {
  closeSubagentInspector,
  closeSubagentInspectorIfScopeChanged,
  getSubagentInspectorSelection,
  openSubagentInspector,
  syncSubagentInspectorFromCards,
  syncSubagentInspectorSelection,
} from "./useSubagentInspectorStore";
import type { SubagentCardViewModel } from "../utils/subagentViewModel";

function card(
  id: string,
  overrides: Partial<SubagentCardViewModel> = {},
): SubagentCardViewModel {
  return {
    id,
    displayName: "tester",
    indexLabel: "01",
    description: "task",
    typeLabel: "explore",
    status: "running",
    progress: 0.2,
    toolCount: null,
    outputText: null,
    taskOutput: null,
    agentId: null,
    sessionThreadId: null,
    githubLogin: null,
    githubProfileUrl: null,
    avatarSrc: null,
    ...overrides,
  };
}

describe("useSubagentInspectorStore", () => {
  beforeEach(() => {
    closeSubagentInspector();
    // 重置 scope 哨兵：用假 thread 切一次再切回
    closeSubagentInspectorIfScopeChanged("ws-reset", "thread-reset");
  });

  it("opens and toggles closed on same card", () => {
    openSubagentInspector(card("a"));
    expect(getSubagentInspectorSelection()?.id).toBe("a");
    openSubagentInspector(card("a"));
    expect(getSubagentInspectorSelection()).toBeNull();
  });

  it("replaces selection when opening another card", () => {
    openSubagentInspector(card("a"));
    openSubagentInspector(card("b"));
    expect(getSubagentInspectorSelection()?.id).toBe("b");
  });

  it("close clears selection", () => {
    openSubagentInspector(card("a"));
    closeSubagentInspector();
    expect(getSubagentInspectorSelection()).toBeNull();
  });

  it("does not close on same scope remount signal", () => {
    closeSubagentInspectorIfScopeChanged("ws-1", "t-1");
    openSubagentInspector(card("a"));
    // 模拟 Messages remount 再次上报同一 scope
    closeSubagentInspectorIfScopeChanged("ws-1", "t-1");
    expect(getSubagentInspectorSelection()?.id).toBe("a");
  });

  it("closes when thread scope actually changes", () => {
    closeSubagentInspectorIfScopeChanged("ws-1", "t-1");
    openSubagentInspector(card("a"));
    closeSubagentInspectorIfScopeChanged("ws-1", "t-2");
    expect(getSubagentInspectorSelection()).toBeNull();
  });

  it("does not close when only nested subagent thread would differ (parent scope stable)", () => {
    closeSubagentInspectorIfScopeChanged("ws-1", "claude:parent");
    openSubagentInspector(card("a"));
    // 右侧嵌套 Messages 的 threadId 是子会话；关抽屉只能看父 scope
    closeSubagentInspectorIfScopeChanged("ws-1", "claude:parent");
    expect(getSubagentInspectorSelection()?.id).toBe("a");
  });

  it("syncs selected card status after re-enrich (breaks open-time freeze)", () => {
    openSubagentInspector(card("a", { status: "running", progress: 0.2 }));
    syncSubagentInspectorSelection(
      card("a", { status: "completed", progress: 1, outputText: "done" }),
    );
    const selected = getSubagentInspectorSelection();
    expect(selected?.status).toBe("completed");
    expect(selected?.progress).toBe(1);
    expect(selected?.outputText).toBe("done");
  });

  it("syncFromCards only updates matching selection id", () => {
    openSubagentInspector(card("a", { status: "running" }));
    syncSubagentInspectorFromCards([
      card("b", { status: "completed", progress: 1 }),
      card("a", { status: "completed", progress: 1 }),
    ]);
    expect(getSubagentInspectorSelection()?.status).toBe("completed");
  });

  it("does not sync unrelated card ids", () => {
    openSubagentInspector(card("a", { status: "running" }));
    syncSubagentInspectorSelection(card("b", { status: "completed", progress: 1 }));
    expect(getSubagentInspectorSelection()?.status).toBe("running");
  });
});
