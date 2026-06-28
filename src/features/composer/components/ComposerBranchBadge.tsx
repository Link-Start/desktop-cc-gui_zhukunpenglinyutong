import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import type { BranchInfo } from "../../../types";

const MAX_VISIBLE_BRANCHES = 12;

export type ComposerBranchControl = {
  branchName: string;
  branches: BranchInfo[];
  onCheckout: (name: string) => Promise<void> | void;
  onCreate: (name: string) => Promise<void> | void;
  /** worktree 工作区下禁用切换，仅展示当前分支 */
  disabled?: boolean;
};

/**
 * ComposerBranchBadge - 输入框下方的 git 分支胶囊
 * 视觉仿 header 分支菜单，逻辑精简：仅分支切换 / 新建。
 * worktree 工作区（disabled）下只读展示。
 */
export function ComposerBranchBadge({
  branchName,
  branches,
  onCheckout,
  onCreate,
  disabled = false,
}: ComposerBranchControl) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim();
  const lowercaseQuery = trimmedQuery.toLowerCase();

  const filteredBranches = useMemo(
    () =>
      trimmedQuery.length > 0
        ? branches.filter((branch) =>
            branch.name.toLowerCase().includes(lowercaseQuery),
          )
        : branches.slice(0, MAX_VISIBLE_BRANCHES),
    [branches, lowercaseQuery, trimmedQuery],
  );

  const exactMatch = useMemo(
    () =>
      trimmedQuery
        ? branches.find((branch) => branch.name === trimmedQuery) ?? null
        : null,
    [branches, trimmedQuery],
  );

  const canCreate = trimmedQuery.length > 0 && !exactMatch;

  const branchValidationMessage = useMemo(() => {
    if (trimmedQuery.length === 0) {
      return null;
    }
    if (trimmedQuery === "." || trimmedQuery === "..") {
      return t("workspace.branchCannotBeDot");
    }
    if (/\s/.test(trimmedQuery)) {
      return t("workspace.branchCannotContainSpaces");
    }
    if (trimmedQuery.startsWith("/") || trimmedQuery.endsWith("/")) {
      return t("workspace.branchCannotStartEndSlash");
    }
    if (trimmedQuery.endsWith(".lock")) {
      return t("workspace.branchCannotEndLock");
    }
    if (trimmedQuery.includes("..")) {
      return t("workspace.branchCannotContainDotDot");
    }
    if (trimmedQuery.includes("@{")) {
      return t("workspace.branchCannotContainAtBrace");
    }
    const invalidChars = ["~", "^", ":", "?", "*", "[", "\\"];
    if (invalidChars.some((char) => trimmedQuery.includes(char))) {
      return t("workspace.branchContainsInvalidChars");
    }
    if (trimmedQuery.endsWith(".")) {
      return t("workspace.branchCannotEndDot");
    }
    return null;
  }, [trimmedQuery, t]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setQuery("");
    setError(null);
  }, []);

  const handleCheckout = useCallback(
    async (name: string) => {
      if (name === branchName) {
        closeMenu();
        return;
      }
      try {
        await onCheckout(name);
        closeMenu();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [branchName, closeMenu, onCheckout],
  );

  const handleCreate = useCallback(async () => {
    if (branchValidationMessage) {
      setError(branchValidationMessage);
      return;
    }
    if (!canCreate) {
      return;
    }
    try {
      await onCreate(trimmedQuery);
      closeMenu();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [branchValidationMessage, canCreate, closeMenu, onCreate, trimmedQuery]);

  // 点击外部 / Esc 关闭
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [closeMenu, menuOpen]);

  return (
    <div className="composer-branch-badge" ref={rootRef}>
      <button
        type="button"
        className="composer-branch-badge-trigger"
        onClick={() => {
          if (disabled) {
            return;
          }
          setMenuOpen((prev) => !prev);
        }}
        aria-haspopup={disabled ? undefined : "menu"}
        aria-expanded={disabled ? undefined : menuOpen}
        disabled={disabled}
        title={branchName}
      >
        <GitBranch size={13} aria-hidden className="composer-branch-badge-icon" />
        <span className="composer-branch-badge-name">{branchName}</span>
        {!disabled ? (
          <ChevronDown size={12} aria-hidden className="composer-branch-badge-caret" />
        ) : null}
      </button>

      {menuOpen && !disabled ? (
        <div className="composer-branch-badge-menu popover-surface" role="menu">
          <div className="composer-branch-badge-search">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setError(null);
              }}
              onKeyDown={async (event) => {
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                if (canCreate) {
                  await handleCreate();
                  return;
                }
                if (exactMatch) {
                  await handleCheckout(exactMatch.name);
                }
              }}
              placeholder={t("workspace.searchOrCreateBranch")}
              className="composer-branch-badge-input"
              autoFocus
              aria-label={t("workspace.searchBranches")}
            />
            <button
              type="button"
              className="composer-branch-badge-create"
              disabled={!canCreate || Boolean(branchValidationMessage)}
              onClick={handleCreate}
            >
              {t("common.create")}
            </button>
          </div>
          {branchValidationMessage ? (
            <div className="composer-branch-badge-error">{branchValidationMessage}</div>
          ) : canCreate ? (
            <div className="composer-branch-badge-hint">
              {t("workspace.createBranchNamed", { name: trimmedQuery })}
            </div>
          ) : null}
          <div className="composer-branch-badge-list" role="none">
            {filteredBranches.map((branch) => (
              <button
                key={branch.name}
                type="button"
                className={`composer-branch-badge-item${
                  branch.name === branchName ? " is-active" : ""
                }`}
                onClick={() => handleCheckout(branch.name)}
                role="menuitem"
              >
                {branch.name}
              </button>
            ))}
            {filteredBranches.length === 0 ? (
              <div className="composer-branch-badge-empty">
                {t("workspace.noBranchesFound")}
              </div>
            ) : null}
          </div>
          {error ? <div className="composer-branch-badge-error">{error}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export default ComposerBranchBadge;
