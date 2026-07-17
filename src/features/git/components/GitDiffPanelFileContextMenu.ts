import type { TFunction } from "i18next";
import type {
  RendererContextMenuItem,
  RendererContextMenuLeafItem,
} from "../../../components/ui/RendererContextMenu";

type GitDiffPanelFileContextMenuAction = {
  count: number;
  onSelect: () => void | Promise<void>;
};

type GitDiffPanelFileContextMenuHistoryAction = {
  onSelect: () => void;
};

type BuildGitDiffPanelFileContextMenuItemsOptions = {
  t: TFunction;
  unstageAction?: GitDiffPanelFileContextMenuAction;
  stageAction?: GitDiffPanelFileContextMenuAction;
  historyAction?: GitDiffPanelFileContextMenuHistoryAction;
  discardAction?: GitDiffPanelFileContextMenuAction;
};

export function buildGitDiffPanelFileContextMenuItems({
  t,
  unstageAction,
  stageAction,
  historyAction,
  discardAction,
}: BuildGitDiffPanelFileContextMenuItemsOptions): RendererContextMenuItem[] {
  const gitItems: RendererContextMenuLeafItem[] = [];

  if (unstageAction && unstageAction.count > 0) {
    gitItems.push({
      type: "item",
      id: "unstage",
      label:
        unstageAction.count === 1
          ? t("git.unstageFile")
          : `${t("git.unstageFiles")} (${unstageAction.count})`,
      onSelect: unstageAction.onSelect,
    });
  }

  if (stageAction && stageAction.count > 0) {
    gitItems.push({
      type: "item",
      id: "stage",
      label:
        stageAction.count === 1
          ? t("git.stageFile")
          : `${t("git.stageFiles")} (${stageAction.count})`,
      onSelect: stageAction.onSelect,
    });
  }

  if (historyAction) {
    gitItems.push({
      type: "item",
      id: "file-history",
      label: t("git.repositoryMenuFileHistory"),
      onSelect: historyAction.onSelect,
    });
  }

  if (discardAction && discardAction.count > 0) {
    if (gitItems.length > 0) {
      gitItems.push({ type: "separator", id: "discard-separator" });
    }
    gitItems.push({
      type: "item",
      id: "discard",
      label:
        discardAction.count === 1
          ? t("git.discardChange")
          : `${t("git.discardChangeMultiple")} (${discardAction.count})`,
      tone: "danger",
      onSelect: discardAction.onSelect,
    });
  }

  if (gitItems.length === 0) {
    return [];
  }

  return [
    {
      type: "submenu",
      id: "git-file-actions",
      label: t("git.repositoryMenuTitle"),
      items: gitItems,
    },
  ];
}
