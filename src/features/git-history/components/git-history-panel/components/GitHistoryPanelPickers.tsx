import { useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Folder from "lucide-react/dist/esm/icons/folder";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function isActivationKey(event: KeyboardEvent<HTMLElement>): boolean {
  return event.key === "Enter" || event.key === " ";
}

export type ActionSurfaceProps = {
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  active?: boolean;
  onActivate?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
  /** Hover/focus tooltip label. Prefer this over native `title` for icon-only actions. */
  title?: string;
  ariaLabel?: string;
  style?: CSSProperties;
};

export function ActionSurface({
  className,
  children,
  disabled,
  active,
  onActivate,
  onContextMenu,
  title,
  ariaLabel,
  style,
}: ActionSurfaceProps) {
  const mergedClassName = [
    "git-history-action",
    className,
    active ? "is-active" : "",
    disabled ? "is-disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const surface = (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel ?? title}
      className={mergedClassName}
      style={style}
      onClick={() => {
        if (!disabled) {
          onActivate?.();
        }
      }}
      onContextMenu={(event) => {
        if (disabled) {
          return;
        }
        onContextMenu?.(event);
      }}
      onKeyDown={(event) => {
        if (disabled || !onActivate) {
          return;
        }
        if (isActivationKey(event)) {
          event.preventDefault();
          onActivate();
        }
      }}
    >
      {children}
    </div>
  );

  // Icon-only chips rely on hover meaning; native `title` is slow and easy to miss
  // in desktop webviews, so surface a real tooltip when a label is provided.
  if (!title) {
    return surface;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{surface}</TooltipTrigger>
      <TooltipPopup side="bottom" sideOffset={6}>
        {title}
      </TooltipPopup>
    </Tooltip>
  );
}

/** Local branch +N / -N chip with near-instant hover tip (avoids native title lag). */
export function GitHistoryBranchStatusBadge({
  kind,
  count,
  tooltip,
}: {
  kind: "ahead" | "behind";
  count: number;
  tooltip: string;
}) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        {/*
          Keep this a plain <i> without aria-label so the parent branch row's
          accessible name stays "+N"/"-N", not the long tip sentence.
        */}
        <i
          className={kind === "ahead" ? "is-ahead" : "is-behind"}
          data-tooltip={tooltip}
        >
          {kind === "ahead" ? `+${count}` : `-${count}`}
        </i>
      </TooltipTrigger>
      <TooltipPopup side="top" sideOffset={4}>
        {tooltip}
      </TooltipPopup>
    </Tooltip>
  );
}

export type GitHistoryPickerOption = {
  id: string;
  label: string;
  kind?: "main" | "worktree";
  parentLabel?: string | null;
  selected?: boolean;
};

type GitHistoryPickerSection = {
  id: string | null;
  name: string;
  options: GitHistoryPickerOption[];
};

export type GitHistoryProjectPickerProps = {
  sections: GitHistoryPickerSection[];
  selectedId: string | null;
  selectedLabel: string;
  ariaLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  icon?: ReactNode;
  disabled?: boolean;
  onSelect: (id: string) => void;
};

export type GitHistoryInlinePickerProps = {
  label: string;
  value: string;
  options: GitHistoryInlinePickerOption[];
  disabled?: boolean;
  searchPlaceholder: string;
  emptyText: string;
  triggerIcon?: ReactNode;
  optionIcon?: ReactNode;
  dropdownAlign?: "start" | "end";
  onSelect: (value: string) => void;
};

export type GitHistoryInlinePickerOption = {
  value: string;
  label: string;
  description?: string;
  group?: string | null;
};

export function GitHistoryProjectPicker({
  sections,
  selectedId,
  selectedLabel,
  ariaLabel,
  searchPlaceholder,
  emptyText,
  icon = <GitBranch size={13} />,
  disabled = false,
  onSelect,
}: GitHistoryProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return sections;
    }
    return sections
      .map((section) => ({
        ...section,
        options: section.options.filter((entry) => entry.label.toLowerCase().includes(keyword)),
      }))
      .filter((section) => section.options.length > 0);
  }, [query, sections]);
  const showGroupLabel = useMemo(
    () =>
      filteredSections.length > 1
      && filteredSections.some((section) => section.name.trim().length > 0),
    [filteredSections],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (disabled) {
        return;
      }
      setOpen(nextOpen);
      if (!nextOpen) {
        setQuery("");
      }
    },
    [disabled],
  );

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
      setQuery("");
    }
  }, [disabled, open]);

  const handleSelect = useCallback(
    (id: string) => {
      if (id && id !== selectedId) {
        onSelect(id);
      }
      setOpen(false);
      setQuery("");
    },
    [onSelect, selectedId],
  );

  return (
    <div
      className={`git-history-project-picker${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}
    >
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="git-history-project-display git-history-project-trigger"
            aria-label={ariaLabel}
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={disabled}
          >
            {icon}
            <span className="git-history-project-value">{selectedLabel}</span>
            <ChevronDown size={12} className="git-history-project-caret" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          // Above create-pr backdrop (z-68) and git-history dock (z-48).
          className="git-history-picker-content z-[80] w-72 p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              autoFocus
              aria-label={searchPlaceholder}
            />
            <CommandList>
              {filteredSections.map((section) => (
                <CommandGroup
                  key={section.id ?? "ungrouped"}
                  heading={
                    showGroupLabel && section.name.trim().length > 0
                      ? section.name
                      : undefined
                  }
                >
                  {section.options.map((entry) => {
                    const selected = entry.id === selectedId;
                    return (
                      <CommandItem
                        key={entry.id}
                        value={entry.id}
                        data-selected={selected ? "true" : undefined}
                        onSelect={() => handleSelect(entry.id)}
                      >
                        <Folder className="size-4 shrink-0 opacity-60" aria-hidden />
                        <span
                          className={`min-w-0 flex-1 truncate${
                            entry.kind === "worktree" ? " pl-1 text-muted-foreground" : ""
                          }`}
                        >
                          {entry.kind === "worktree" ? "↳ " : ""}
                          {entry.label}
                        </span>
                        {selected ? (
                          <Check className="size-4 shrink-0" aria-hidden />
                        ) : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
              {filteredSections.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {emptyText}
                </div>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function GitHistoryInlinePicker({
  label,
  value,
  options,
  disabled = false,
  searchPlaceholder,
  emptyText,
  triggerIcon,
  optionIcon,
  dropdownAlign = "start",
  onSelect,
}: GitHistoryInlinePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmedValue = value.trim();
  const filteredOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return options;
    }
    return options.filter((entry) =>
      [entry.value, entry.label, entry.description ?? "", entry.group ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [options, query]);
  const groupedOptions = useMemo(() => {
    const groups = new Map<string, GitHistoryInlinePickerOption[]>();
    for (const option of filteredOptions) {
      const key = option.group?.trim() ?? "";
      const bucket = groups.get(key) ?? [];
      bucket.push(option);
      groups.set(key, bucket);
    }
    return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
  }, [filteredOptions]);
  const showGroupLabel = useMemo(
    () => groupedOptions.length > 1 || groupedOptions.some((entry) => entry.group.length > 0),
    [groupedOptions],
  );
  const selectedOption = useMemo(
    () => options.find((entry) => entry.value === trimmedValue) ?? null,
    [options, trimmedValue],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (disabled) {
        return;
      }
      setOpen(nextOpen);
      if (!nextOpen) {
        setQuery("");
      }
    },
    [disabled],
  );

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
      setQuery("");
    }
  }, [disabled, open]);

  return (
    <div
      className={`git-history-create-pr-picker${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}${dropdownAlign === "end" ? " is-dropdown-end" : ""}`}
    >
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="git-history-create-pr-picker-trigger"
            aria-label={label}
            title={trimmedValue}
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={disabled}
          >
            {triggerIcon ? (
              <span className="git-history-create-pr-picker-leading-icon" aria-hidden>
                {triggerIcon}
              </span>
            ) : null}
            <span className="git-history-create-pr-picker-value">
              <span className="git-history-create-pr-picker-value-title">
                {(selectedOption?.label ?? trimmedValue) || "-"}
              </span>
              {selectedOption?.description ? (
                <span className="git-history-create-pr-picker-value-hint">
                  {selectedOption.description}
                </span>
              ) : null}
            </span>
            <ChevronDown size={12} className="git-history-create-pr-picker-caret" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={dropdownAlign === "end" ? "end" : "start"}
          side="bottom"
          sideOffset={6}
          // Above create-pr backdrop (z-68) so options are clickable inside PR dialog.
          className="git-history-picker-content z-[80] w-80 max-w-[min(90vw,480px)] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              autoFocus
              aria-label={searchPlaceholder}
            />
            <CommandList>
              {groupedOptions.map((groupEntry) => (
                <CommandGroup
                  key={groupEntry.group || "__ungrouped__"}
                  heading={
                    showGroupLabel && groupEntry.group ? groupEntry.group : undefined
                  }
                >
                  {groupEntry.items.map((option) => {
                    const selected = option.value === trimmedValue;
                    return (
                      <CommandItem
                        key={option.value}
                        value={`${option.value} ${option.label} ${option.description ?? ""}`}
                        title={option.value}
                        data-selected={selected ? "true" : undefined}
                        onSelect={() => {
                          onSelect(option.value);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        {optionIcon ? (
                          <span className="shrink-0 opacity-60" aria-hidden>
                            {optionIcon}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">
                          <span className="block truncate">{option.label}</span>
                          {option.description ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          ) : null}
                        </span>
                        {selected ? (
                          <Check className="size-4 shrink-0" aria-hidden />
                        ) : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
              {groupedOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {emptyText}
                </div>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
