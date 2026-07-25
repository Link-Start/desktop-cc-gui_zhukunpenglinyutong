import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
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
  findNext: (query: string) => boolean;
  findPrevious: (query: string) => boolean;
  onInsertText: (text: string) => void;
};

export function TerminalPanel({
  containerRef,
  status,
  message,
  getSelection,
  findNext,
  findPrevious,
  onInsertText,
}: TerminalPanelProps) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<RendererContextMenuState | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearchMatch, setHasSearchMatch] = useState<boolean | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, [searchOpen]);

  const runSearch = useCallback(
    (direction: "next" | "previous") => {
      setHasSearchMatch(
        direction === "next"
          ? findNext(searchQuery)
          : findPrevious(searchQuery),
      );
    },
    [findNext, findPrevious, searchQuery],
  );

  const handleShellKeyDownCapture = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        event.stopPropagation();
        setSearchOpen(true);
        return;
      }
      if (event.key === "Escape" && searchOpen) {
        event.preventDefault();
        setSearchOpen(false);
        setHasSearchMatch(null);
      }
    },
    [searchOpen],
  );

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
    <div
      className="terminal-shell"
      onKeyDownCapture={handleShellKeyDownCapture}
    >
      {searchOpen ? (
        <div className="terminal-search" role="search">
          <input
            ref={searchInputRef}
            value={searchQuery}
            aria-label={t("terminal.searchInput")}
            placeholder={t("terminal.searchPlaceholder")}
            onChange={(event) => {
              const query = event.target.value;
              setSearchQuery(query);
              setHasSearchMatch(query.trim() ? findNext(query) : null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runSearch(event.shiftKey ? "previous" : "next");
              }
            }}
          />
          <button
            type="button"
            aria-label={t("terminal.searchPrevious")}
            onClick={() => runSearch("previous")}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={t("terminal.searchNext")}
            onClick={() => runSearch("next")}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label={t("terminal.searchClose")}
            onClick={() => {
              setSearchOpen(false);
              setHasSearchMatch(null);
            }}
          >
            ×
          </button>
          {hasSearchMatch === false ? (
            <span className="terminal-search-empty">
              {t("terminal.searchNoResults")}
            </span>
          ) : null}
        </div>
      ) : null}
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
