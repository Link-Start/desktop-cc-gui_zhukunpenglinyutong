import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addClaudeProvider,
  addCodexProvider,
  listCcSwitchProviders,
  listCcSwitchProvidersFromPath,
  updateClaudeProvider,
  updateCodexProvider,
} from "../../../services/tauri";
import type { CcSwitchProvider } from "../../../services/tauri";
import type { ProviderCategory } from "../types";

export type CcSwitchImportTarget = "claude" | "codex";

export type CcSwitchImportStatus = "new" | "update";

export interface CcSwitchImportItem extends CcSwitchProvider {
  /** 与当前列表按 id 命中为 update, 否则为 new */
  status: CcSwitchImportStatus;
}

export interface CcSwitchImportFailure {
  name: string;
  message: string;
}

export interface CcSwitchImportSummary {
  addedCount: number;
  updatedCount: number;
  failures: CcSwitchImportFailure[];
}

const PROVIDER_CATEGORIES: readonly ProviderCategory[] = [
  "official",
  "cn_official",
  "aggregator",
  "third_party",
  "custom",
];

/** 从 codex config.toml 文本中提取第一个 base_url */
export function extractCodexTomlBaseUrl(configToml: string | undefined): string | null {
  if (!configToml) return null;
  const match = configToml.match(/base_url\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

/** 保留 cc-switch 原始 id: 再次导入同一条目时按 id 走更新而不是新增 */
export function buildClaudeProviderFromCcSwitch(item: CcSwitchProvider) {
  const category = PROVIDER_CATEGORIES.includes(item.category as ProviderCategory)
    ? (item.category as ProviderCategory)
    : undefined;
  return {
    id: item.id,
    name: item.name,
    websiteUrl: item.websiteUrl ?? undefined,
    category,
    source: "cc-switch",
    settingsConfig: item.settingsConfig,
  };
}

export function buildCodexProviderFromCcSwitch(item: CcSwitchProvider) {
  const config = item.settingsConfig.config;
  const auth = item.settingsConfig.auth;
  return {
    id: item.id,
    name: item.name,
    source: "cc-switch",
    configToml: typeof config === "string" ? config : "",
    authJson: auth && typeof auth === "object" ? JSON.stringify(auth) : "{}",
  };
}

interface UseCcSwitchImportOptions {
  target: CcSwitchImportTarget;
  /** 现有供应商 id 集合, 用于区分 新增/更新 */
  existingProviderIds: readonly string[];
  /** 对话框打开时才加载数据源 */
  isOpen: boolean;
  /** 指定 cc-switch.db / config.json 文件路径; 缺省自动检测 ~/.cc-switch */
  sourcePath?: string | null;
}

export function useCcSwitchImport({
  target,
  existingProviderIds,
  isOpen,
  sourcePath = null,
}: UseCcSwitchImportOptions) {
  const appType = target === "codex" ? "codex" : "claude";
  const [rawItems, setRawItems] = useState<CcSwitchProvider[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  // load 只依赖 appType + sourcePath, 避免 effect 因引用变化无限重跑
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = sourcePath
        ? await listCcSwitchProvidersFromPath(sourcePath, appType)
        : await listCcSwitchProviders(appType);
      setAvailable(result.available);
      setRawItems(result.providers);
      // 与参考一致: 默认全选
      setSelectedIds(new Set(result.providers.map((provider) => provider.id)));
    } catch {
      setAvailable(false);
      setRawItems([]);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [appType, sourcePath]);

  useEffect(() => {
    if (isOpen) {
      void load();
    }
  }, [isOpen, load]);

  const items = useMemo<CcSwitchImportItem[]>(() => {
    const existingIds = new Set(existingProviderIds);
    return rawItems.map((provider) => ({
      ...provider,
      status: existingIds.has(provider.id) ? "update" : "new",
    }));
  }, [rawItems, existingProviderIds]);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((previous) =>
      previous.size >= items.length ? new Set() : new Set(items.map((item) => item.id)),
    );
  }, [items]);

  const importSelected = useCallback(async (): Promise<CcSwitchImportSummary> => {
    const selected = items.filter((item) => selectedIds.has(item.id));
    setImporting(true);
    const failures: CcSwitchImportFailure[] = [];
    let addedCount = 0;
    let updatedCount = 0;
    try {
      for (const item of selected) {
        try {
          if (target === "claude") {
            const built = buildClaudeProviderFromCcSwitch(item);
            if (item.status === "update") {
              await updateClaudeProvider(item.id, built);
              updatedCount += 1;
            } else {
              await addClaudeProvider(built);
              addedCount += 1;
            }
          } else {
            const built = buildCodexProviderFromCcSwitch(item);
            if (item.status === "update") {
              await updateCodexProvider(item.id, built);
              updatedCount += 1;
            } else {
              await addCodexProvider(built);
              addedCount += 1;
            }
          }
        } catch (cause) {
          failures.push({
            name: item.name,
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
      }
    } finally {
      setImporting(false);
    }

    setSelectedIds(new Set());
    return { addedCount, updatedCount, failures };
  }, [items, selectedIds, target]);

  return {
    items,
    available,
    loading,
    importing,
    selectedIds,
    toggleItem,
    toggleAll,
    importSelected,
    reload: load,
  };
}
