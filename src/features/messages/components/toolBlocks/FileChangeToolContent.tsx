/**
 * fileChange 工具的多文件列表（GenericToolBlock 旁路）。
 * 幕布主路径连续 fileChange 已并入 EditToolGroupBlock；本组件保持同款折叠契约作 fallback。
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import FilePen from "lucide-react/dist/esm/icons/file-pen";
import type { GenericToolDisplayChange, GenericToolMarkerStatus } from "./genericToolPresentation";
import { FileChangeRow, unifiedDiffToPreview } from "./FileChangeRow";
import { ToolMarkerShell, ToolStatusIcon } from "./ToolMarkerShell";
import {
  mergeEditSceneStatus,
  normalizeEditScenePath,
} from "./fileEditSceneUtils";
import type { ToolStatusTone } from "./toolConstants";

type FileChangeToolContentProps = {
  changes: GenericToolDisplayChange[];
  status: GenericToolMarkerStatus;
  /** Prefer editor open when a row has no expandable diff. */
  onOpenFilePath?: (path: string) => void;
  onOpenDiffPath?: (path: string) => void;
  defaultCollapsed?: boolean;
};

export function FileChangeToolContent({
  changes,
  status,
  onOpenFilePath,
  onOpenDiffPath,
  defaultCollapsed = true,
}: FileChangeToolContentProps) {
  const openMissingDiffPath = onOpenFilePath ?? onOpenDiffPath;
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);

  const normalizedChanges = useMemo(() => {
    const byPath = new Map<string, GenericToolDisplayChange>();
    for (const change of changes) {
      const path = normalizeEditScenePath(change.path);
      if (!path) {
        continue;
      }
      byPath.set(path, { ...change, path });
    }
    return Array.from(byPath.values());
  }, [changes]);

  if (normalizedChanges.length === 0) {
    return null;
  }

  const fileCount = normalizedChanges.length;
  const sceneLabel = t("tools.fileEditSceneCount", { count: fileCount });
  const sceneAriaLabel = t("tools.fileEditSceneToggle", { count: fileCount });
  const sceneStatus = mergeEditSceneStatus([status as ToolStatusTone]);

  return (
    <ToolMarkerShell
      icon={<FilePen />}
      label={sceneLabel}
      ariaLabel={sceneAriaLabel}
      expanded={isExpanded}
      onToggle={() => setIsExpanded((previous) => !previous)}
      trailing={<ToolStatusIcon status={sceneStatus} />}
      body={
        <div
          className="file-list-container file-edit-scene-list mt-1 ml-4"
          data-testid="file-edit-scene-list"
          role="group"
          aria-label={sceneLabel}
        >
          {normalizedChanges.map((change, index) => {
            const diffText = change.diffText;
            return (
              <FileChangeRow
                key={`${change.path}::${index}`}
                filePath={change.path}
                additions={change.diffStats.additions}
                deletions={change.diffStats.deletions}
                status={status}
                canExpand={Boolean(diffText)}
                loadDiff={diffText ? () => unifiedDiffToPreview(diffText) : undefined}
                onOpenDiffPath={
                  !diffText ? openMissingDiffPath : onOpenDiffPath
                }
              />
            );
          })}
        </div>
      }
    />
  );
}
