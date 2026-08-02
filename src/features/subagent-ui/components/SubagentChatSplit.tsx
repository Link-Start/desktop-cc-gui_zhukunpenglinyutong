import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getClientStoreSync, writeClientStoreValue } from "../../../services/clientStorage";
import { useActiveCanvasSelector } from "../../layout/hooks/activeCanvasStore";
import {
  closeSubagentInspectorIfScopeChanged,
  useSubagentInspectorSelection,
} from "../hooks/useSubagentInspectorStore";
import { SubagentInspectorDrawer } from "./SubagentInspectorDrawer";

const SPLIT_RATIO_KEY = "subagentChatSplitRatio";
const DEFAULT_RATIO = 58;
const MIN_RATIO = 36;
const MAX_RATIO = 78;

function clampRatio(value: number) {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, value));
}

function readStoredRatio() {
  const stored = getClientStoreSync<number>("layout", SPLIT_RATIO_KEY);
  return typeof stored === "number" && Number.isFinite(stored)
    ? clampRatio(stored)
    : DEFAULT_RATIO;
}

type SubagentChatSplitProps = {
  messagesNode: ReactNode;
  composerNode: ReactNode | null;
  workspaceId?: string | null;
  workspacePath?: string | null;
};

/**
 * 左列：消息(上) + composer(下)；右列：子代理 inspector 全高。
 * 中间竖直抓手可拖拽。
 *
 * 关键：无论开关，messages 始终挂在 `.subagent-chat-split-main` 下，
 * 避免打开时换父节点导致 Messages remount → 误关 inspector 闪屏。
 */
export const SubagentChatSplit = memo(function SubagentChatSplit({
  messagesNode,
  composerNode,
  workspaceId = null,
  workspacePath = null,
}: SubagentChatSplitProps) {
  const { t } = useTranslation();
  const selection = useSubagentInspectorSelection();
  const open = Boolean(selection);
  const parentThreadId = useActiveCanvasSelector((s) => s.threadId);
  const parentWorkspaceId = useActiveCanvasSelector((s) => s.workspaceId);
  const splitRootRef = useRef<HTMLDivElement | null>(null);
  const ratioRef = useRef(readStoredRatio());
  const cleanupRef = useRef<(() => void) | null>(null);

  // 只根据「主幕布」父会话 scope 关抽屉，绝不跟右侧嵌套 Messages 的 subagent threadId 走。
  useEffect(() => {
    closeSubagentInspectorIfScopeChanged(
      workspaceId ?? parentWorkspaceId,
      parentThreadId,
    );
  }, [parentThreadId, parentWorkspaceId, workspaceId]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      document.body.classList.remove("subagent-chat-split-resizing");
    };
  }, []);

  useEffect(() => {
    const root = splitRootRef.current;
    if (!root || !open) {
      return;
    }
    root.style.setProperty("--subagent-chat-split-ratio", ratioRef.current.toFixed(2));
  }, [open]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const root = splitRootRef.current;
    if (!root) {
      return;
    }
    const main = root.querySelector<HTMLElement>(".subagent-chat-split-main");
    const side = root.querySelector<HTMLElement>(".subagent-inspector-drawer");
    if (!main || !side) {
      return;
    }
    const mainRect = main.getBoundingClientRect();
    const sideRect = side.getBoundingClientRect();
    const totalWidth = mainRect.width + sideRect.width;
    if (totalWidth <= 0) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startMainWidth = mainRect.width;
    const minMain = Math.max(280, totalWidth * (MIN_RATIO / 100));
    const maxMain = Math.min(totalWidth - 260, totalWidth * (MAX_RATIO / 100));
    if (maxMain <= minMain) {
      return;
    }

    document.body.classList.add("subagent-chat-split-resizing");

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("subagent-chat-split-resizing");
      writeClientStoreValue("layout", SPLIT_RATIO_KEY, ratioRef.current);
      cleanupRef.current = null;
    };

    const onMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextMain = Math.min(maxMain, Math.max(minMain, startMainWidth + delta));
      const nextRatio = clampRatio((nextMain / totalWidth) * 100);
      ratioRef.current = nextRatio;
      root.style.setProperty("--subagent-chat-split-ratio", nextRatio.toFixed(2));
    };

    const onUp = () => {
      cleanup();
    };

    cleanupRef.current?.();
    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, []);

  return (
    <div
      ref={splitRootRef}
      className={cn("subagent-chat-split", open ? "is-open" : "is-closed")}
      style={
        {
          ["--subagent-chat-split-ratio" as string]: ratioRef.current.toFixed(2),
        } as CSSProperties
      }
    >
      <div className="subagent-chat-split-main">
        {messagesNode}
        {composerNode}
      </div>
      {open ? (
        <>
          <div
            className="subagent-chat-split-divider"
            role="separator"
            aria-orientation="vertical"
            aria-label={t("subagentUi.resizeSplit", {
              defaultValue: "调整子代理面板宽度",
            })}
            aria-valuemin={MIN_RATIO}
            aria-valuemax={MAX_RATIO}
            aria-valuenow={ratioRef.current}
            tabIndex={0}
            onPointerDown={handlePointerDown}
          />
          <SubagentInspectorDrawer
            workspaceId={workspaceId}
            workspacePath={workspacePath}
          />
        </>
      ) : null}
    </div>
  );
});
