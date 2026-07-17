import type { TFunction } from "i18next";
import { describe, expect, it, vi } from "vitest";
import { buildGitDiffPanelFileContextMenuItems } from "./GitDiffPanelFileContextMenu";

const translations: Record<string, string> = {
  "git.discardChange": "Discard change",
  "git.discardChangeMultiple": "Discard changes",
  "git.repositoryMenuFileHistory": "Show file history",
  "git.repositoryMenuTitle": "Git",
  "git.stageFile": "Stage file",
  "git.stageFiles": "Stage files",
  "git.unstageFile": "Unstage file",
  "git.unstageFiles": "Unstage files",
};

const t = ((key: string) => translations[key] ?? key) as TFunction;

describe("buildGitDiffPanelFileContextMenuItems", () => {
  it("builds one ordered Git submenu with plural labels and destructive separation", () => {
    const onUnstage = vi.fn();
    const onStage = vi.fn();
    const onHistory = vi.fn();
    const onDiscard = vi.fn();

    const items = buildGitDiffPanelFileContextMenuItems({
      t,
      unstageAction: { count: 2, onSelect: onUnstage },
      stageAction: { count: 3, onSelect: onStage },
      historyAction: { onSelect: onHistory },
      discardAction: { count: 4, onSelect: onDiscard },
    });

    expect(items).toEqual([
      {
        type: "submenu",
        id: "git-file-actions",
        label: "Git",
        items: [
          {
            type: "item",
            id: "unstage",
            label: "Unstage files (2)",
            onSelect: onUnstage,
          },
          {
            type: "item",
            id: "stage",
            label: "Stage files (3)",
            onSelect: onStage,
          },
          {
            type: "item",
            id: "file-history",
            label: "Show file history",
            onSelect: onHistory,
          },
          { type: "separator", id: "discard-separator" },
          {
            type: "item",
            id: "discard",
            label: "Discard changes (4)",
            tone: "danger",
            onSelect: onDiscard,
          },
        ],
      },
    ]);
  });

  it("omits unavailable actions and returns no menu for an empty action set", () => {
    const onStage = vi.fn();

    expect(
      buildGitDiffPanelFileContextMenuItems({
        t,
        stageAction: { count: 1, onSelect: onStage },
      }),
    ).toEqual([
      {
        type: "submenu",
        id: "git-file-actions",
        label: "Git",
        items: [
          {
            type: "item",
            id: "stage",
            label: "Stage file",
            onSelect: onStage,
          },
        ],
      },
    ]);
    expect(buildGitDiffPanelFileContextMenuItems({ t })).toEqual([]);
    expect(
      buildGitDiffPanelFileContextMenuItems({
        t,
        discardAction: { count: 0, onSelect: vi.fn() },
      }),
    ).toEqual([]);
  });

  it("keeps a read-only History action available without mutations", () => {
    const onHistory = vi.fn();

    expect(
      buildGitDiffPanelFileContextMenuItems({
        t,
        historyAction: { onSelect: onHistory },
      }),
    ).toEqual([
      {
        type: "submenu",
        id: "git-file-actions",
        label: "Git",
        items: [
          {
            type: "item",
            id: "file-history",
            label: "Show file history",
            onSelect: onHistory,
          },
        ],
      },
    ]);
  });
});
