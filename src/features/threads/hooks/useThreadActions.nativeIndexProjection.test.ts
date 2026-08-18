import { describe, expect, it } from "vitest";
import type { SessionIndexRow } from "../../../services/tauri";
import type { ThreadSummary } from "../../../types";
import {
  buildNativeIndexEarlyPaintSummaries,
  projectNativeIndexRowsToSummaries,
  selectNativeSessionIndexRows,
  shouldRememberHideUnreadiness,
} from "./useThreadActions.nativeIndexProjection";

function indexRow(
  engine: SessionIndexRow["engine"],
  sessionId: string,
): SessionIndexRow {
  return {
    engine,
    sessionId,
    title: sessionId,
    updatedAt: 100,
  };
}

describe("native Session Index projection", () => {
  it("hide unreadiness keeps every native engine, not PI only", () => {
    const rows = [
      indexRow("claude", "claude-1"),
      indexRow("grok", "grok-1"),
      indexRow("pi", "pi-1"),
      indexRow("dsh", "dsh-1"),
    ];
    expect(shouldRememberHideUnreadiness(false)).toBe(true);
    const projected = projectNativeIndexRowsToSummaries(
      selectNativeSessionIndexRows(rows),
      {
        workspaceId: "ws-1",
        mappedTitles: {},
        getCustomName: () => undefined,
        hiddenSharedBindingIds: new Set(),
      },
    );
    const engines = projected.map((row) => row.engineSource);
    expect(engines).toEqual(
      expect.arrayContaining(["claude", "grok", "pi", "dsh"]),
    );
    expect(engines).not.toEqual(["pi"]);
  });

  it("first-paint keeps newer last-good C when Index only has A,B", () => {
    const painted = buildNativeIndexEarlyPaintSummaries({
      rows: [
        { ...indexRow("claude", "a"), updatedAt: 10 },
        { ...indexRow("claude", "b"), updatedAt: 11 },
      ],
      workspaceId: "ws-1",
      getCustomName: () => undefined,
      hideSet: new Set(),
      currentThreads: undefined,
      lastGood: [
        {
          id: "claude:c",
          name: "C",
          createdAt: 20,
          updatedAt: 20,
          engineSource: "claude",
        } as ThreadSummary,
      ],
    });
    expect(painted.map((row) => row.id).sort()).toEqual([
      "claude:a",
      "claude:b",
      "claude:c",
    ]);
  });
});
