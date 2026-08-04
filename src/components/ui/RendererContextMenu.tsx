import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type RendererContextMenuLeafItem =
  | {
      type: "item";
      id: string;
      label: string;
      icon?: ReactNode;
      shortcut?: string;
      disabled?: boolean;
      tone?: "default" | "danger";
      onSelect: () => void | Promise<void>;
    }
  | {
      type: "label";
      id: string;
      label: string;
    }
  | {
      type: "separator";
      id: string;
    };

export type RendererContextMenuItem =
  | RendererContextMenuLeafItem
  | {
      type: "submenu";
      id: string;
      label: string;
      icon?: ReactNode;
      disabled?: boolean;
      items: RendererContextMenuLeafItem[];
    };

export type RendererContextMenuState = {
  x: number;
  y: number;
  label: string;
  content?: ReactNode;
  items: RendererContextMenuItem[];
};

type RendererContextMenuProps = {
  menu: RendererContextMenuState;
  onClose: () => void;
  className?: string;
};

type RendererContextSubmenuPosition = {
  x: number;
  y: number;
};

const MENU_MAX_HEIGHT = 420;
const MENU_VERTICAL_PADDING = 16;
// Match .renderer-context-menu-item: padding 7+7 + ~16 line ≈ 30–32px.
const MENU_ITEM_HEIGHT = 32;
const MENU_LABEL_HEIGHT = 28;
const MENU_SEPARATOR_HEIGHT = 11;
const SUBMENU_WIDTH = 260;
const SUBMENU_MAX_HEIGHT = 420;
const SUBMENU_GAP = 2;
const SUBMENU_VERTICAL_PADDING = 16;
const SUBMENU_ITEM_HEIGHT = 40;
const SUBMENU_LABEL_HEIGHT = 32;
const SUBMENU_SEPARATOR_HEIGHT = 9;
const VIEWPORT_PADDING = 12;
// Small gap between the click anchor and the menu edge so the pointer /
// selected row stays visible without floating far away ("跟手").
const ANCHOR_GAP = 4;

export function estimateRendererContextMenuHeight(
  items: readonly RendererContextMenuItem[],
) {
  const estimatedContentHeight = items.reduce((height, item) => {
    if (item.type === "separator") {
      return height + MENU_SEPARATOR_HEIGHT;
    }
    if (item.type === "label") {
      return height + MENU_LABEL_HEIGHT;
    }
    return height + MENU_ITEM_HEIGHT;
  }, MENU_VERTICAL_PADDING);
  return Math.min(MENU_MAX_HEIGHT, estimatedContentHeight);
}

function estimateRendererContextSubmenuHeight(
  items: readonly RendererContextMenuLeafItem[],
) {
  const estimatedContentHeight = items.reduce((height, item) => {
    if (item.type === "separator") {
      return height + SUBMENU_SEPARATOR_HEIGHT;
    }
    if (item.type === "label") {
      return height + SUBMENU_LABEL_HEIGHT;
    }
    return height + SUBMENU_ITEM_HEIGHT;
  }, SUBMENU_VERTICAL_PADDING);
  return Math.min(SUBMENU_MAX_HEIGHT, estimatedContentHeight);
}

export function resolveRendererContextSubmenuPosition(
  triggerRect: DOMRect,
  submenuHeight: number,
  submenuWidth = SUBMENU_WIDTH,
): RendererContextSubmenuPosition {
  if (typeof window === "undefined") {
    return {
      x: triggerRect.right + SUBMENU_GAP,
      y: triggerRect.top,
    };
  }
  const maxRightX = window.innerWidth - submenuWidth - VIEWPORT_PADDING;
  const rightX = triggerRect.right + SUBMENU_GAP;
  const leftX = triggerRect.left - submenuWidth - SUBMENU_GAP;
  const shouldOpenRight = rightX <= maxRightX || leftX < VIEWPORT_PADDING;
  const x = shouldOpenRight
    ? Math.min(Math.max(rightX, VIEWPORT_PADDING), Math.max(VIEWPORT_PADDING, maxRightX))
    : Math.max(leftX, VIEWPORT_PADDING);
  const maxY = window.innerHeight - submenuHeight - VIEWPORT_PADDING;
  const y = Math.min(
    Math.max(triggerRect.top, VIEWPORT_PADDING),
    Math.max(VIEWPORT_PADDING, maxY),
  );
  return { x, y };
}

export function RendererContextMenu({
  menu,
  onClose,
  className = "renderer-context-menu",
}: RendererContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const submenuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const [submenuPosition, setSubmenuPosition] =
    useState<RendererContextSubmenuPosition | null>(null);

  const openSubmenu = useCallback(
    (item: Extract<RendererContextMenuItem, { type: "submenu" }>) => {
      const trigger = submenuTriggerRefs.current[item.id];
      if (!trigger) {
        return;
      }
      setSubmenuPosition(
        resolveRendererContextSubmenuPosition(
          trigger.getBoundingClientRect(),
          estimateRendererContextSubmenuHeight(item.items),
        ),
      );
      setOpenSubmenuId(item.id);
    },
    [],
  );

  const closeSubmenu = useCallback(() => {
    setOpenSubmenuId(null);
    setSubmenuPosition(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      // 子菜单先收起，再关主菜单，避免「划出来回不去」只能整盘关闭
      if (openSubmenuId) {
        event.preventDefault();
        closeSubmenu();
        return;
      }
      onClose();
    };
    const handleBlur = () => onClose();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
    };
  }, [closeSubmenu, onClose, openSubmenuId]);

  useEffect(() => {
    closeSubmenu();
  }, [closeSubmenu, menu]);

  // Place from the click anchor using the real measured size (flip above /
  // left when the preferred side would overflow).
  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!element || typeof window === "undefined") {
      return;
    }
    const rect = element.getBoundingClientRect();
    const next = clampRendererContextMenuPosition(menu.x, menu.y, {
      width: rect.width || 280,
      height: rect.height || estimateRendererContextMenuHeight(menu.items),
      padding: VIEWPORT_PADDING,
    });
    element.style.left = `${next.x}px`;
    element.style.top = `${next.y}px`;
  }, [menu]);

  const openSubmenuItem = menu.items.find(
    (item): item is Extract<RendererContextMenuItem, { type: "submenu" }> =>
      item.type === "submenu" && item.id === openSubmenuId,
  );

  useLayoutEffect(() => {
    if (!openSubmenuItem || !submenuRef.current) return;
    const trigger = submenuTriggerRefs.current[openSubmenuItem.id];
    if (!trigger) return;
    const measuredWidth = submenuRef.current.getBoundingClientRect().width || SUBMENU_WIDTH;
    const nextPosition = resolveRendererContextSubmenuPosition(
      trigger.getBoundingClientRect(),
      estimateRendererContextSubmenuHeight(openSubmenuItem.items),
      measuredWidth,
    );
    setSubmenuPosition((current) =>
      current?.x === nextPosition.x && current.y === nextPosition.y
        ? current
        : nextPosition,
    );
  }, [openSubmenuItem]);

  const renderLeafItem = (
    item: RendererContextMenuLeafItem,
    options?: { closeSubmenuOnHover?: boolean },
  ) => {
    if (item.type === "separator") {
      return (
        <div
          key={item.id}
          className="renderer-context-menu-separator"
          aria-hidden
        />
      );
    }
    if (item.type === "label") {
      return (
        <div key={item.id} className="renderer-context-menu-label">
          {item.label}
        </div>
      );
    }
    return (
      <button
        key={item.id}
        type="button"
        role="menuitem"
        className={`renderer-context-menu-item${
          item.tone === "danger" ? " is-danger" : ""
        }`}
        disabled={item.disabled}
        onMouseEnter={() => {
          if (options?.closeSubmenuOnHover) {
            closeSubmenu();
          }
        }}
        onFocus={() => {
          if (options?.closeSubmenuOnHover) {
            closeSubmenu();
          }
        }}
        onClick={() => {
          if (item.disabled) {
            return;
          }
          onClose();
          void item.onSelect();
        }}
      >
        {item.icon ? (
          <span className="renderer-context-menu-item-icon" aria-hidden>
            {item.icon}
          </span>
        ) : null}
        <span className="renderer-context-menu-item-label">
          {item.label}
        </span>
        {item.shortcut ? (
          <span className="renderer-context-menu-item-shortcut" aria-hidden>
            {item.shortcut}
          </span>
        ) : null}
      </button>
    );
  };

  const renderRootItem = (item: RendererContextMenuItem) => {
    if (item.type !== "submenu") {
      return renderLeafItem(item, { closeSubmenuOnHover: true });
    }
    const isOpen = openSubmenuId === item.id;
    return (
      <button
        key={item.id}
        ref={(element) => {
          submenuTriggerRefs.current[item.id] = element;
        }}
        type="button"
        role="menuitem"
        className={`renderer-context-menu-item renderer-context-menu-submenu-trigger${
          isOpen ? " is-open" : ""
        }`}
        disabled={item.disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onMouseEnter={() => {
          if (!item.disabled) {
            openSubmenu(item);
          }
        }}
        onFocus={() => {
          if (!item.disabled) {
            openSubmenu(item);
          }
        }}
        onClick={(event) => {
          event.preventDefault();
          if (item.disabled) {
            return;
          }
          if (isOpen) {
            closeSubmenu();
            return;
          }
          openSubmenu(item);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            openSubmenu(item);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            closeSubmenu();
          }
        }}
      >
        <span className="renderer-context-menu-item-content">
          {item.icon ? (
            <span className="renderer-context-menu-item-icon" aria-hidden>
              {item.icon}
            </span>
          ) : null}
          <span className="renderer-context-menu-item-label">
            {item.label}
          </span>
        </span>
        <span className="renderer-context-menu-submenu-chevron" aria-hidden>
          ›
        </span>
      </button>
    );
  };

  const initialPosition =
    typeof window !== "undefined"
      ? clampRendererContextMenuPosition(menu.x, menu.y, {
          width: 280,
          height: estimateRendererContextMenuHeight(menu.items),
          padding: VIEWPORT_PADDING,
        })
      : { x: menu.x, y: menu.y };

  const menuNode = (
    <div
      className="renderer-context-menu-backdrop"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        ref={menuRef}
        className={className}
        role="menu"
        aria-label={menu.label}
        style={{ left: initialPosition.x, top: initialPosition.y }}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        {menu.content ? (
          <div
            className="renderer-context-menu-content"
            onMouseEnter={closeSubmenu}
            onFocusCapture={closeSubmenu}
          >
            {menu.content}
          </div>
        ) : null}
        {menu.items.map((item) => renderRootItem(item))}
      </div>
      {openSubmenuItem && submenuPosition ? (
        <div
          ref={submenuRef}
          className={`${className} renderer-context-menu-flyout`}
          role="menu"
          aria-label={openSubmenuItem.label}
          style={{ left: submenuPosition.x, top: submenuPosition.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {openSubmenuItem.items.map((item) => renderLeafItem(item))}
        </div>
      ) : null}
    </div>
  );

  if (typeof document === "undefined") {
    return menuNode;
  }

  return createPortal(menuNode, document.body);
}

/**
 * Place a context menu relative to an anchor point (usually the cursor).
 *
 * Strategy (OS / Finder / VS Code style):
 * 1. Prefer open below-right of the anchor with a small gap — feels attached.
 * 2. If it would overflow the bottom, flip above the anchor so the click
 *    target stays visible instead of being covered by a slid-up panel.
 * 3. If it would overflow the right, flip to the left of the anchor.
 * 4. Final clamp keeps the box inside the viewport for oversized menus.
 */
export function clampRendererContextMenuPosition(
  x: number,
  y: number,
  options?: {
    width?: number;
    height?: number;
    padding?: number;
    gap?: number;
  },
) {
  const width = options?.width ?? 280;
  const height = options?.height ?? 420;
  const padding = options?.padding ?? 12;
  const gap = options?.gap ?? ANCHOR_GAP;
  if (typeof window === "undefined") {
    return { x, y };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxX = Math.max(padding, viewportWidth - width - padding);
  const maxY = Math.max(padding, viewportHeight - height - padding);
  const maxRight = viewportWidth - padding;
  const maxBottom = viewportHeight - padding;

  // Horizontal: prefer right of anchor; flip left when the preferred side
  // cannot fit a full menu width.
  let nextX = x + gap;
  if (nextX + width > maxRight) {
    nextX = x - width - gap;
  }
  nextX = Math.min(Math.max(nextX, padding), maxX);

  // Vertical: prefer below anchor; flip above so the selection stays visible
  // when the user right-clicks near the bottom of the list / viewport.
  let nextY = y + gap;
  if (nextY + height > maxBottom) {
    nextY = y - height - gap;
  }
  nextY = Math.min(Math.max(nextY, padding), maxY);

  return { x: nextX, y: nextY };
}
