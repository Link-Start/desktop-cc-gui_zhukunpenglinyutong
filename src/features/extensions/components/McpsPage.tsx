import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@base-ui/react/select";
import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Search from "lucide-react/dist/esm/icons/search";
import XIcon from "lucide-react/dist/esm/icons/x";

import type { WorkspaceInfo } from "../../../types";
import { cn } from "@/lib/utils";
import { setGlobalMcpServerEnabled } from "../../../services/tauri";
import { Button } from "@/features/extensions/tokentracker-dashboard/ui/components/Button.jsx";
import { Input } from "@/features/extensions/tokentracker-dashboard/ui/components/Input.jsx";

import { useMcpInventory } from "../hooks/useMcpInventory";
import {
  buildEngineRows,
  filterMcpRows,
  splitRowsByKind,
  type McpConfigRow,
  type McpEngineType,
  type McpServerRow,
  type McpSourceFilter,
} from "../utils/mcpInventory";
import { McpsDetailPanel } from "./McpsDetailPanel";
import { McpsToggleSwitch } from "./McpsToggleSwitch";

const ENGINE_TABS: McpEngineType[] = ["claude", "codex"];

const BADGE_BASE_CLASS =
  "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1";
const BADGE_NEUTRAL_CLASS =
  "bg-oai-gray-100 text-oai-gray-600 ring-oai-gray-200 dark:bg-oai-gray-800 dark:text-oai-gray-300 dark:ring-oai-gray-700";
const BADGE_ENABLED_CLASS =
  "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60";

type McpServerRowViewProps = {
  row: McpServerRow;
  selected: boolean;
  pending: boolean;
  onSelect: (row: McpServerRow) => void;
  onToggleConfig: (row: McpConfigRow, enabled: boolean) => void;
};

function McpServerRowView({ row, selected, pending, onSelect, onToggleConfig }: McpServerRowViewProps) {
  const { t } = useTranslation();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(row);
    }
  };

  let badge: { label: string; className: string };
  let meta: string;
  if (row.kind === "config") {
    badge = {
      label: row.enabled
        ? t("extensions.mcps.badges.enabled")
        : t("extensions.mcps.badges.disabled"),
      className: row.enabled ? BADGE_ENABLED_CLASS : BADGE_NEUTRAL_CLASS,
    };
    const targetLabel = row.command
      ? t("extensions.mcps.detail.commandMeta", {
          command: row.command,
          args: row.argsCount,
        })
      : row.url
        ? t("extensions.mcps.detail.urlMeta", { url: row.url })
        : t("extensions.mcps.detail.transportUnknown");
    meta = `${row.transport ?? t("extensions.mcps.detail.transportUnknown")} · ${targetLabel}`;
  } else {
    badge = {
      label:
        row.authLabel ??
        row.statusLabel ??
        t("extensions.mcps.badges.statusUnknown"),
      className: BADGE_NEUTRAL_CLASS,
    };
    meta =
      row.toolNames.length > 0
        ? `${t("extensions.mcps.row.toolsCount", { count: row.toolNames.length })} · ${t(
            "extensions.mcps.detail.resourcesTemplates",
            { resources: row.resourcesCount, templates: row.templatesCount },
          )}`
        : (row.statusLabel ?? t("extensions.mcps.badges.statusUnknown"));
  }

  return (
    <div
      data-mcp-row="1"
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={t("extensions.mcps.row.openDetails", { name: row.name })}
      onClick={() => onSelect(row)}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-pointer rounded-md py-3 pr-2 transition focus:outline-none focus:ring-2 focus:ring-oai-gray-400/30",
        selected
          ? "bg-oai-gray-100 ring-1 ring-oai-gray-200 dark:bg-oai-gray-800/60 dark:ring-oai-gray-800"
          : "hover:bg-oai-gray-50 dark:hover:bg-oai-gray-900/40",
        row.kind === "config" && !row.enabled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-3">
        <h2
          className="min-w-0 flex-1 truncate text-sm font-semibold text-oai-black dark:text-white"
          title={row.name}
        >
          {row.name}
        </h2>
        {row.kind === "runtime" && row.builtIn ? (
          <span className={cn(BADGE_BASE_CLASS, BADGE_NEUTRAL_CLASS)}>
            {t("extensions.mcps.badges.builtIn")}
          </span>
        ) : null}
        <span className={cn(BADGE_BASE_CLASS, badge.className)}>{badge.label}</span>
        {row.kind === "config" ? (
          <McpsToggleSwitch row={row} pending={pending} onToggle={onToggleConfig} />
        ) : null}
        <ChevronRight
          className={cn(
            "hidden h-4 w-4 shrink-0 text-oai-gray-300 transition-colors dark:text-oai-gray-600 lg:block",
            selected && "text-oai-gray-500 dark:text-oai-gray-300",
          )}
          aria-hidden
        />
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-oai-gray-500 dark:text-oai-gray-400">
        {meta}
      </p>
    </div>
  );
}

type McpsPageProps = {
  activeWorkspace: WorkspaceInfo | null;
};

export function McpsPage({ activeWorkspace }: McpsPageProps) {
  const { t } = useTranslation();
  const workspaceId = activeWorkspace?.id ?? null;
  const {
    loading,
    error,
    globalServers,
    codexServers,
    claudeRuntimeServers,
    reload,
  } = useMcpInventory(workspaceId);

  // 进入页面固定落在第一个 tab（Claude Code），不跟随当前会话引擎——
  // 引擎 tab 是浏览维度，不是会话状态的镜像。
  const [selectedEngine, setSelectedEngine] = useState<McpEngineType>("claude");
  const [sourceFilter, setSourceFilter] = useState<McpSourceFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      buildEngineRows({
        engine: selectedEngine,
        globalServers,
        codexServers,
        claudeRuntimeServers,
      }),
    [claudeRuntimeServers, codexServers, globalServers, selectedEngine],
  );
  const filteredRows = useMemo(
    () => filterMcpRows(rows, sourceFilter, query),
    [query, rows, sourceFilter],
  );
  const { configRows, runtimeRows } = useMemo(
    () => splitRowsByKind(filteredRows),
    [filteredRows],
  );
  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) ?? null,
    [rows, selectedRowId],
  );
  const anyFilter = sourceFilter !== "all" || query.trim().length > 0;

  const handleSelectRow = (row: McpServerRow) => {
    setSelectedRowId((current) => (current === row.id ? null : row.id));
  };
  const handleEngineChange = (engine: McpEngineType) => {
    setSelectedEngine(engine);
    setSelectedRowId(null);
  };
  const handleClearFilters = () => {
    setSourceFilter("all");
    setQuery("");
  };

  // 配置文件是唯一事实源：写盘后全量 reload，不做乐观更新。
  const handleToggleConfig = useCallback(
    async (row: McpConfigRow, enabled: boolean) => {
      if (pendingRowId) {
        return;
      }
      setPendingRowId(row.id);
      setMutationError(null);
      try {
        await setGlobalMcpServerEnabled(row.name, row.source, enabled);
      } catch (toggleError) {
        setMutationError(
          t("extensions.mcps.toggle.failed", {
            name: row.name,
            message:
              toggleError instanceof Error ? toggleError.message : String(toggleError),
          }),
        );
      } finally {
        try {
          await reload();
        } finally {
          setPendingRowId(null);
        }
      }
    },
    [pendingRowId, reload, t],
  );

  const sourceOptions: Array<{ value: McpSourceFilter; label: string }> = [
    { value: "all", label: t("extensions.mcps.filter.sourceAll") },
    { value: "config", label: t("extensions.mcps.filter.sourceConfig") },
    { value: "runtime", label: t("extensions.mcps.filter.sourceRuntime") },
  ];

  const renderGroup = (title: string, groupRows: McpServerRow[]) => {
    if (groupRows.length === 0) {
      return null;
    }
    return (
      <section key={title} className="mt-6 first:mt-0">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-oai-gray-500 dark:text-oai-gray-400">
          {title}
        </h3>
        <div>
          {groupRows.map((row) => (
            <McpServerRowView
              key={row.id}
              row={row}
              selected={selectedRowId === row.id}
              pending={pendingRowId === row.id}
              onSelect={handleSelectRow}
              onToggleConfig={handleToggleConfig}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="flex flex-1 flex-col font-oai text-oai-black antialiased dark:text-oai-white">
      <main className="flex-1 pb-12 pt-8 sm:pb-16 sm:pt-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight text-oai-black dark:text-white sm:text-4xl">
              {t("extensions.mcps.title")}
            </h1>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              <RefreshCw
                className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")}
                aria-hidden
              />
              {t("extensions.mcps.refresh")}
            </Button>
          </div>

          <div className="mb-5 flex gap-6 border-b border-oai-gray-200 dark:border-oai-gray-800">
            {ENGINE_TABS.map((engine) => (
              <button
                key={engine}
                type="button"
                aria-pressed={selectedEngine === engine}
                onClick={() => handleEngineChange(engine)}
                className={cn(
                  "-mb-px border-b-2 pb-2 text-sm font-medium transition-colors",
                  selectedEngine === engine
                    ? "border-oai-black text-oai-black dark:border-white dark:text-white"
                    : "border-transparent text-oai-gray-500 hover:text-oai-black dark:text-oai-gray-400 dark:hover:text-white",
                )}
              >
                {t(`extensions.mcps.tabs.${engine}`)}
              </button>
            ))}
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : null}
          {mutationError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              {mutationError}
            </div>
          ) : null}

          <div className="mb-2 flex flex-wrap items-center gap-2 pt-1 text-xs text-oai-gray-600 dark:text-oai-gray-300">
            <Select.Root
              value={sourceFilter}
              onValueChange={(value) => {
                if (value) {
                  setSourceFilter(value);
                }
              }}
            >
              <Select.Trigger
                aria-label={t("extensions.mcps.filter.sourceLabel")}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-oai-gray-200 bg-oai-white px-2.5 text-xs font-medium text-oai-gray-700 transition hover:border-oai-gray-300 focus:outline-none focus:ring-2 focus:ring-oai-gray-400/30 data-[popup-open]:border-oai-gray-300 dark:border-oai-gray-800 dark:bg-oai-gray-900 dark:text-oai-gray-200 dark:hover:border-oai-gray-700"
              >
                <span className="text-oai-gray-500 dark:text-oai-gray-400">
                  {t("extensions.mcps.filter.sourceLabel")}:
                </span>
                <Select.Value>
                  {(value: McpSourceFilter) =>
                    sourceOptions.find((option) => option.value === value)?.label ?? value
                  }
                </Select.Value>
                <Select.Icon className="text-oai-gray-400">
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner sideOffset={4} alignItemWithTrigger={false} className="z-[60]">
                  <Select.Popup className="min-w-[var(--anchor-width)] overflow-hidden rounded-md border border-oai-gray-200 bg-white p-1 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)] outline-none dark:border-oai-gray-800 dark:bg-oai-gray-950 dark:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]">
                    {sourceOptions.map((option) => (
                      <Select.Item
                        key={option.value}
                        value={option.value}
                        className="flex cursor-default select-none items-center justify-between gap-2 rounded px-3 py-1.5 text-sm text-oai-black outline-none data-[highlighted]:bg-oai-gray-100 dark:text-white dark:data-[highlighted]:bg-oai-gray-800"
                      >
                        <Select.ItemText>{option.label}</Select.ItemText>
                        <Select.ItemIndicator>
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>

            <div className="relative w-56 max-w-full">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-oai-gray-400"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setQuery(event.target.value)
                }
                onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Escape" && query) {
                    event.preventDefault();
                    setQuery("");
                  }
                }}
                aria-label={t("extensions.mcps.search.aria")}
                placeholder={t("extensions.mcps.search.placeholder")}
                className="h-8 pl-9 pr-8 !border-oai-gray-200 dark:!border-oai-gray-800 focus:!border-oai-gray-400 focus:!ring-oai-gray-400/20 dark:focus:!border-oai-gray-500 dark:focus:!ring-oai-gray-500/20 [&::-webkit-search-cancel-button]:appearance-none"
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setQuery("")}
                aria-label={t("extensions.mcps.search.clear")}
                aria-hidden={!query}
                tabIndex={query ? 0 : -1}
                className={cn(
                  "absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-oai-gray-400 transition duration-150 ease-out before:absolute before:-inset-1.5 before:content-[''] hover:bg-oai-gray-100 hover:text-oai-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oai-gray-400/40 motion-reduce:transition-none dark:hover:bg-oai-gray-800 dark:hover:text-oai-gray-200",
                  query ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0",
                )}
              >
                <XIcon className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            <span
              role="status"
              aria-live="polite"
              className="ml-auto shrink-0 tabular-nums text-oai-gray-500 dark:text-oai-gray-400"
            >
              {t("extensions.mcps.filter.resultCount", {
                filtered: filteredRows.length,
                total: rows.length,
              })}
            </span>

            {anyFilter ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="shrink-0 inline-flex h-7 items-center gap-1 rounded-full bg-oai-gray-100 px-2.5 text-[11px] font-medium text-oai-gray-700 transition hover:bg-oai-gray-200 focus:outline-none focus:ring-2 focus:ring-oai-gray-400/30 dark:bg-oai-gray-800/70 dark:text-oai-gray-200 dark:hover:bg-oai-gray-700"
              >
                <XIcon className="h-3 w-3" aria-hidden />
                {t("extensions.mcps.filter.clear")}
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-oai-gray-400" aria-hidden />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-oai-gray-200 px-4 py-10 text-center text-sm text-oai-gray-500 dark:border-oai-gray-800 dark:text-oai-gray-400">
              <p>
                {anyFilter
                  ? t("extensions.mcps.empty.noMatch")
                  : t("extensions.mcps.empty.title")}
              </p>
              {!anyFilter ? (
                <p className="max-w-md text-xs text-oai-gray-400 dark:text-oai-gray-500">
                  {t("extensions.mcps.empty.description")}
                </p>
              ) : null}
              {anyFilter ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-oai-gray-100 px-2.5 text-[11px] font-medium text-oai-gray-700 transition hover:bg-oai-gray-200 focus:outline-none focus:ring-2 focus:ring-oai-gray-400/30 dark:bg-oai-gray-800/70 dark:text-oai-gray-200 dark:hover:bg-oai-gray-700"
                >
                  <XIcon className="h-3 w-3" aria-hidden />
                  {t("extensions.mcps.filter.clear")}
                </button>
              ) : null}
            </div>
          ) : (
            <div>
              {renderGroup(t("extensions.mcps.groups.config"), configRows)}
              {renderGroup(t("extensions.mcps.groups.runtime"), runtimeRows)}
            </div>
          )}

          <McpsDetailPanel
            row={selectedRow}
            engineLabel={t(`extensions.mcps.tabs.${selectedEngine}`)}
            pendingRowId={pendingRowId}
            onToggleConfig={handleToggleConfig}
            onClose={() => setSelectedRowId(null)}
          />
        </div>
      </main>
    </div>
  );
}
