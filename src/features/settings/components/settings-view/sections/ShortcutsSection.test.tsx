// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildShortcutDrafts,
  shortcutActions,
  type ShortcutSettingKey,
} from "../settingsViewShortcuts";
import { ShortcutsSection } from "./ShortcutsSection";

afterEach(cleanup);

describe("ShortcutsSection", () => {
  it("renders the twelve featured module actions in the first group", () => {
    const settings = Object.fromEntries(
      shortcutActions.map((action) => [action.setting, action.defaultShortcut]),
    ) as Record<ShortcutSettingKey, string | null>;
    const { container } = render(
      <ShortcutsSection
        active
        t={(key) => key}
        shortcutDrafts={buildShortcutDrafts(settings)}
        handleShortcutKeyDown={vi.fn()}
        updateShortcut={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const groups = container.querySelectorAll(".settings-shortcuts-group");
    const commonGroup = groups[0];
    expect(commonGroup?.textContent).toContain(
      "settings.commonModulesSubtitle",
    );
    expect(
      commonGroup?.querySelectorAll(".settings-shortcuts-item"),
    ).toHaveLength(12);
    expect(
      Array.from(
        commonGroup?.querySelectorAll(".settings-shortcuts-item-title") ?? [],
      ).map((node) => node.textContent),
    ).toEqual([
      "settings.toggleLeftConversationSidebar",
      "settings.toggleRightConversationSidebar",
      "git.historyQuickAction",
      "panels.files",
      "panels.git",
      "panels.notes",
      "panels.intentCanvas",
      "panels.radar",
      "panels.projectMap",
      "browserAgent.dock.panelTitle",
      "files.fileCompare.title",
      "settings.toggleTerminalPanel",
    ]);
  });
});
