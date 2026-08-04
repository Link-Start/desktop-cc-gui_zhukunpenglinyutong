import { useTranslation } from "react-i18next";
import Minus from "lucide-react/dist/esm/icons/minus";
import Plus from "lucide-react/dist/esm/icons/plus";
import Undo2 from "lucide-react/dist/esm/icons/undo-2";
import { FloatingTooltipButton } from "@/components/ui/floating-tooltip-button";
import {
  InclusionToggle,
  runSequentialPathAction,
  type InclusionState,
} from "./GitDiffPanelInclusion";

type GitDiffPanelSectionActionsProps = {
  title: string;
  section: "staged" | "unstaged";
  sectionInclusionState: InclusionState;
  toggleableFilePaths: string[];
  filePaths: string[];
  onSetCommitSelection?: (paths: string[], selected: boolean) => void;
  onStageAllChanges?: () => Promise<void> | void;
  onStageFile?: (path: string) => Promise<void> | void;
  onUnstageAllChanges?: () => Promise<void> | void;
  onUnstageFile?: (path: string) => Promise<void> | void;
  onUnstageFiles?: (paths: string[]) => Promise<void> | void;
  onDiscardFiles?: (paths: string[]) => Promise<void> | void;
};

export function GitDiffPanelSectionActions({
  title,
  section,
  sectionInclusionState,
  toggleableFilePaths,
  filePaths,
  onSetCommitSelection,
  onStageAllChanges,
  onStageFile,
  onUnstageAllChanges,
  onUnstageFile,
  onUnstageFiles,
  onDiscardFiles,
}: GitDiffPanelSectionActionsProps) {
  const { t } = useTranslation();
  const canToggleSelection = toggleableFilePaths.length > 0 && Boolean(onSetCommitSelection);
  const canStageAll = section === "unstaged" && filePaths.length > 0;
  const canUnstageAll =
    section === "staged" &&
    filePaths.length > 0 &&
    Boolean(onUnstageAllChanges || onUnstageFiles || onUnstageFile);
  const canDiscardAll =
    section === "unstaged" && Boolean(onDiscardFiles) && filePaths.length > 0;

  if (!canToggleSelection && !canStageAll && !canUnstageAll && !canDiscardAll) {
    return null;
  }

  return (
    <div
      className="diff-section-actions git-filetree-section-actions"
      role="group"
      aria-label={t("git.sectionActions", { title })}
    >
      {canToggleSelection ? (
        <InclusionToggle
          state={sectionInclusionState}
          label={t("git.commitSelectionToggleScope", { path: title })}
          className="git-commit-scope-toggle--section"
          stopPropagation
          tooltipSide="bottom"
          onToggle={() => {
            onSetCommitSelection?.(toggleableFilePaths, sectionInclusionState !== "all");
          }}
        />
      ) : null}
      {canStageAll ? (
        <FloatingTooltipButton
          type="button"
          className="diff-row-action diff-row-action--stage"
          tooltipLabel={t("git.stageAllChanges")}
          tooltipSide="bottom"
          tooltipAlign="end"
          tooltipDelay={180}
          aria-label={t("git.stageAllChangesAction")}
          onClick={() => {
            if (onStageAllChanges) {
              void onStageAllChanges();
              return;
            }
            void runSequentialPathAction(filePaths, onStageFile);
          }}
        >
          <Plus size={12} aria-hidden />
        </FloatingTooltipButton>
      ) : null}
      {canUnstageAll ? (
        <FloatingTooltipButton
          type="button"
          className="diff-row-action diff-row-action--unstage"
          tooltipLabel={t("git.unstageAllChanges")}
          tooltipSide="bottom"
          tooltipAlign="end"
          tooltipDelay={180}
          aria-label={t("git.unstageAllChangesAction")}
          onClick={() => {
            if (onUnstageAllChanges) {
              void onUnstageAllChanges();
              return;
            }
            if (onUnstageFiles) {
              void onUnstageFiles(filePaths);
              return;
            }
            void runSequentialPathAction(filePaths, onUnstageFile);
          }}
        >
          <Minus size={12} aria-hidden />
        </FloatingTooltipButton>
      ) : null}
      {canDiscardAll ? (
        <FloatingTooltipButton
          type="button"
          className="diff-row-action diff-row-action--discard"
          tooltipLabel={t("git.discardAllChanges")}
          tooltipSide="bottom"
          tooltipAlign="end"
          tooltipDelay={180}
          aria-label={t("git.discardAllChangesAction")}
          onClick={() => {
            void onDiscardFiles?.(filePaths);
          }}
        >
          <Undo2 size={12} aria-hidden />
        </FloatingTooltipButton>
      ) : null}
    </div>
  );
}
