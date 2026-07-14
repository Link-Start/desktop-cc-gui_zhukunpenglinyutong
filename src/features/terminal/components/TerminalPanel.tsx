import { useCallback, useState, type MouseEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { TerminalStatus } from "../../../types";
import {
  RendererContextMenu,
  clampRendererContextMenuPosition,
  estimateRendererContextMenuHeight,
  type RendererContextMenuItem,
  type RendererContextMenuState,
} from "../../../components/ui/RendererContextMenu";

type TerminalPanelProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  status: TerminalStatus;
  message: string;
  /** 读取 xterm 内部选区文本(即用户看到的拖蓝高亮),无选区时返回空串。 */
  getSelection: () => string;
  onInsertText: (text: string) => void;
};

export function TerminalPanel({
  containerRef,
  status,
  message,
  getSelection,
  onInsertText,
}: TerminalPanelProps) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<RendererContextMenuState | null>(null);

  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      // 只信任 xterm 内部选区模型。.xterm 是 user-select: none,拖蓝高亮由
      // 内部模型绘制;而 window.getSelection() 读到的是 xterm 右键时塞进
      // 隐藏 helper textarea 的内容,会残留、串行导致文本越发越长。
      // 右键 mousedown 阶段 xterm 已处理完 rightClickSelectsWord/保留拖蓝,
      // 此刻读到的就是用户眼中的选区。
      const selection = getSelection();
      if (!selection) {
        // 无选中内容时不接管右键，保留默认行为。
        return;
      }
      event.preventDefault();
      const items: RendererContextMenuItem[] = [
        {
          type: "item",
          id: "send-selection-to-composer",
          label: t("terminal.sendSelectionToComposer"),
          onSelect: () => {
            onInsertText(selection);
          },
        },
      ];
      const position = clampRendererContextMenuPosition(event.clientX, event.clientY, {
        height: estimateRendererContextMenuHeight(items),
      });
      setContextMenu({ ...position, label: t("terminal.title"), items });
    },
    [getSelection, onInsertText, t],
  );

  return (
    <div className="terminal-shell">
      <div
        ref={containerRef}
        className="terminal-surface"
        onContextMenu={handleContextMenu}
      />
      {status !== "ready" && (
        <div className="terminal-overlay">
          <div className="terminal-status">{message}</div>
        </div>
      )}
      {contextMenu ? (
        <RendererContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      ) : null}
    </div>
  );
}
