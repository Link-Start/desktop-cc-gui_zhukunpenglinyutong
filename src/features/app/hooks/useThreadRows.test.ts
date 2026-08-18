// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ThreadSummary } from "../../../types";
import { useThreadRows } from "./useThreadRows";

const getPinTimestamp = () => null;

describe("useThreadRows", () => {
  it("renders Codex subagent sessions under one parent root", () => {
    const parent: ThreadSummary = {
      id: "parent-session",
      name: "Parent",
      updatedAt: 100,
      engineSource: "codex",
    };
    const child: ThreadSummary = {
      id: "child-session",
      name: "Aristotle",
      parentThreadId: "parent-session",
      updatedAt: 200,
      engineSource: "codex",
    };

    const { result } = renderHook(() => useThreadRows({}));
    const rows = result.current.getThreadRows(
      [parent, child],
      false,
      "ws-1",
      getPinTimestamp,
    );

    expect(rows.totalRoots).toBe(1);
    expect(rows.unpinnedRows.map((row) => [row.thread.id, row.depth])).toEqual([
      ["parent-session", 0],
      ["child-session", 1],
    ]);
  });

  it("sorts roots by createdAt so later activity does not reshuffle the list", () => {
    const older: ThreadSummary = {
      id: "claude:older",
      name: "Older session",
      createdAt: 100,
      updatedAt: 9_000,
      engineSource: "claude",
    };
    const newer: ThreadSummary = {
      id: "codex:newer",
      name: "Newer session",
      createdAt: 500,
      updatedAt: 600,
      engineSource: "codex",
    };

    const { result } = renderHook(() => useThreadRows({}));
    const rows = result.current.getThreadRows(
      [older, newer],
      false,
      "ws-1",
      getPinTimestamp,
    );

    expect(rows.unpinnedRows.map((row) => row.thread.id)).toEqual([
      "codex:newer",
      "claude:older",
    ]);
  });

  it("hides Shared-owned subagent pups from the sidebar tree without removing native trees", () => {
    const shared: ThreadSummary = {
      id: "shared:s1",
      name: "Shared Session",
      updatedAt: 300,
      engineSource: "codex",
      threadKind: "shared",
      nativeThreadIds: ["codex:hidden-owner"],
    };
    // parent 已 remap 到 shared: — 侧栏必须隐藏（不下崽）
    const remountedPup: ThreadSummary = {
      id: "child-archimedes",
      name: "Archimedes",
      parentThreadId: "shared:s1",
      updatedAt: 400,
      engineSource: "codex",
    };
    // parent 仍为 hidden owner raw — 同样隐藏
    const rawParentPup: ThreadSummary = {
      id: "child-aristotle",
      name: "Aristotle",
      parentThreadId: "hidden-owner",
      updatedAt: 350,
      engineSource: "codex",
    };
    // Native 父子：不受影响
    const nativeParent: ThreadSummary = {
      id: "codex:native-parent",
      name: "Native Parent",
      updatedAt: 100,
      engineSource: "codex",
    };
    const nativeChild: ThreadSummary = {
      id: "codex:native-child",
      name: "Native Child",
      parentThreadId: "codex:native-parent",
      updatedAt: 200,
      engineSource: "codex",
    };

    const { result } = renderHook(() => useThreadRows({}));
    const rows = result.current.getThreadRows(
      [shared, remountedPup, rawParentPup, nativeParent, nativeChild],
      true,
      "ws-1",
      getPinTimestamp,
    );

    const visibleIds = rows.unpinnedRows.map((row) => row.thread.id);
    expect(visibleIds).toContain("shared:s1");
    expect(visibleIds).toContain("codex:native-parent");
    expect(visibleIds).toContain("codex:native-child");
    expect(visibleIds).not.toContain("child-archimedes");
    expect(visibleIds).not.toContain("child-aristotle");
    // Shared 不展示 hasChildren（崽子已从树剔除）
    const sharedRow = rows.unpinnedRows.find((row) => row.thread.id === "shared:s1");
    expect(sharedRow?.hasChildren).toBe(false);
    expect(rows.totalRoots).toBe(2);
  });

  it("hides Shared Codex pups whose parent is a rollout stem alias on any OS", () => {
    const uuid = "b7e2c1a0-4d3f-4a21-9c8e-1f2a3b4c5d6e";
    const rolloutStem = `rollout-2026-04-10T10-00-00-${uuid}`;
    const shared: ThreadSummary = {
      id: "shared:s-codex",
      name: "Shared Codex",
      updatedAt: 300,
      engineSource: "codex",
      threadKind: "shared",
      nativeThreadIds: [`codex:${uuid}`],
    };
    const windowsLivePup: ThreadSummary = {
      id: `codex:${rolloutStem}-child`,
      name: "Socrates",
      parentThreadId: rolloutStem,
      updatedAt: 400,
      engineSource: "codex",
    };
    const prefixedStemPup: ThreadSummary = {
      id: "child-singer",
      name: "Singer",
      parentThreadId: `codex:${rolloutStem}`,
      updatedAt: 390,
      engineSource: "codex",
    };
    const nativeParent: ThreadSummary = {
      id: "codex:visible-parent",
      name: "Native Parent",
      updatedAt: 100,
      engineSource: "codex",
    };
    const nativeChild: ThreadSummary = {
      id: "codex:visible-child",
      name: "Native Child",
      parentThreadId: "codex:visible-parent",
      updatedAt: 200,
      engineSource: "codex",
    };

    const { result } = renderHook(() => useThreadRows({}));
    const rows = result.current.getThreadRows(
      [shared, windowsLivePup, prefixedStemPup, nativeParent, nativeChild],
      true,
      "ws-1",
      getPinTimestamp,
    );

    const visibleIds = rows.unpinnedRows.map((row) => row.thread.id);
    expect(visibleIds).toEqual([
      "shared:s-codex",
      "codex:visible-parent",
      "codex:visible-child",
    ]);
    expect(visibleIds).not.toContain(windowsLivePup.id);
    expect(visibleIds).not.toContain("child-singer");
  });
});
