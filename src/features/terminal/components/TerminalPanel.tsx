import { useCallback, useRef, useState, type MouseEvent, type RefObject } from "react";
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
  onInsertText: (text: string) => void;
};

/**
 * 读取"当前落在终端内的浏览器原生选区"文本。
 *
 * 该终端用的是 xterm DOM 渲染器（未加载 canvas/webgl 插件），终端文字是真实 DOM，
 * 用户拖蓝的就是浏览器原生选区。这里只信任原生选区——不回退 xterm 内部选区模型，
 * 因为在纯 DOM 渲染下用户从不更新它，其残留会把整屏 scrollback 误当选区吐出来。
 */
export function resolveTerminalSelection(container: HTMLElement | null): string {
  if (typeof window === "undefined" || container === null) {
    return "";
  }
  const domSelection = window.getSelection();
  if (domSelection === null || domSelection.rangeCount === 0) {
    return "";
  }
  const withinTerminal =
    (domSelection.anchorNode !== null && container.contains(domSelection.anchorNode)) ||
    (domSelection.focusNode !== null && container.contains(domSelection.focusNode));
  if (!withinTerminal) {
    return "";
  }
  return domSelection.toString().trim();
}

export function TerminalPanel({
  containerRef,
  status,
  message,
  onInsertText,
}: TerminalPanelProps) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<RendererContextMenuState | null>(null);
  // 右键(mousedown)在输入框已获焦时会先清空原生选区，导致 contextmenu 时读不到。
  // 因此在拖选结束的 mouseup 就把选区缓存下来，右键时用它兜底。
  const lastSelectionRef = useRef("");

  const captureSelection = useCallback(() => {
    const text = resolveTerminalSelection(containerRef.current);
    // 只在读到真实选区时更新，避免右键 mouseup(此时选区已空)把缓存冲掉。
    if (text) {
      lastSelectionRef.current = text;
    }
  }, [containerRef]);

  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const selection = resolveTerminalSelection(containerRef.current) || lastSelectionRef.current;
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
    [containerRef, onInsertText, t],
  );

  return (
    <div className="terminal-shell">
      <div
        ref={containerRef}
        className="terminal-surface"
        onMouseUp={captureSelection}
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
