import { describe, expect, it, vi } from "vitest";
import { searchActions, type SearchActionDescriptor } from "./actionsProvider";

const actions: SearchActionDescriptor[] = [
  {
    id: "open-settings",
    title: "设置",
    subtitle: "Settings",
    keywords: ["settings", "preferences", "偏好设置"],
    execute: vi.fn(),
  },
  {
    id: "open-terminal",
    title: "终端",
    subtitle: "Terminal",
    keywords: ["terminal", "shell"],
    execute: vi.fn(),
  },
];

describe("searchActions", () => {
  it.each(["设置", "settings", "preferences"])("matches %s", (query) => {
    expect(searchActions(query, actions)[0]).toMatchObject({
      id: "action:open-settings",
      kind: "action",
      actionId: "open-settings",
    });
  });

  it("keeps stable action identity", () => {
    expect(searchActions("terminal", actions)[0]?.actionId).toBe("open-terminal");
  });

  it("ranks an exact match before a looser keyword match", () => {
    const results = searchActions("settings", [
      {
        id: "open-terminal",
        title: "Terminal settings",
        keywords: [],
        execute: vi.fn(),
      },
      actions[0]!,
    ]);

    expect(results.map((result) => result.actionId)).toEqual([
      "open-settings",
      "open-terminal",
    ]);
  });
});
