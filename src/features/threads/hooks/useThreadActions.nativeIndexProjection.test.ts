import { describe, expect, it } from "vitest";
import type { SessionIndexRow } from "../../../services/tauri";
import {
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
});
