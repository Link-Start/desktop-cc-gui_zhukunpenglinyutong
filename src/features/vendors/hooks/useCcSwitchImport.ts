import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addClaudeProvider,
  addCodexProvider,
  addKimiProvider,
  listCcSwitchProviders,
} from "../../../services/tauri";
import type { CcSwitchProvider } from "../../../services/tauri";
import type { ProviderCategory } from "../types";

export type CcSwitchImportTarget = "claude" | "codex" | "kimi";

export interface CcSwitchImportItem extends CcSwitchProvider {
  /** 与当前列表 name + baseUrl 命中, 禁止重复导入 */
  imported: boolean;
}

export interface CcSwitchImportFailure {
  name: string;
  message: string;
}

export interface CcSwitchImportSummary {
  importedCount: number;
  failures: CcSwitchImportFailure[];
}

/** 现有供应商的去重视图, 由调用方按各自数据结构提取 */
export interface ExistingProviderKey {
  name: string;
  baseUrl: string | null;
}

const PROVIDER_CATEGORIES: readonly ProviderCategory[] = [
  "official",
  "cn_official",
  "aggregator",
  "third_party",
  "custom",
];

function generateProviderId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
}

/** name + baseUrl 归一化: trim、去尾部斜杠、大小写不敏感 */
export function normalizeDedupKey(name: string, baseUrl: string | null): string {
  const normalizedName = name.trim().toLowerCase();
  const normalizedUrl = (baseUrl ?? "").trim().replace(/\/+$/, "").toLowerCase();
  return `${normalizedName}\n${normalizedUrl}`;
}

/** 从 codex config.toml 文本中提取第一个 base_url (仅用于去重比对) */
export function extractCodexTomlBaseUrl(configToml: string | undefined): string | null {
  if (!configToml) return null;
  const match = configToml.match(/base_url\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function readEnvString(
  settingsConfig: Record<string, unknown>,
  key: string,
): string {
  const env = settingsConfig.env;
  if (!env || typeof env !== "object") return "";
  const value = (env as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function buildClaudeProviderFromCcSwitch(item: CcSwitchProvider) {
  const category = PROVIDER_CATEGORIES.includes(item.category as ProviderCategory)
    ? (item.category as ProviderCategory)
    : undefined;
  return {
    id: generateProviderId(),
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
    id: generateProviderId(),
    name: item.name,
    configToml: typeof config === "string" ? config : "",
    authJson: auth && typeof auth === "object" ? JSON.stringify(auth) : "{}",
  };
}

export function buildKimiProviderFromCcSwitch(item: CcSwitchProvider) {
  return {
    id: generateProviderId(),
    name: item.name,
    websiteUrl: item.websiteUrl ?? undefined,
    baseUrl: readEnvString(item.settingsConfig, "ANTHROPIC_BASE_URL"),
    apiKey: readEnvString(item.settingsConfig, "ANTHROPIC_AUTH_TOKEN"),
    model: readEnvString(item.settingsConfig, "ANTHROPIC_MODEL"),
  };
}

interface UseCcSwitchImportOptions {
  target: CcSwitchImportTarget;
  existingProviders: ExistingProviderKey[];
  /** 对话框打开时才加载数据源 */
  isOpen: boolean;
}

export function useCcSwitchImport({
  target,
  existingProviders,
  isOpen,
}: UseCcSwitchImportOptions) {
  const appType = target === "codex" ? "codex" : "claude";
  const [rawItems, setRawItems] = useState<CcSwitchProvider[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  /** 本次会话内已成功导入的 CC Switch 条目 id */
  const [sessionImportedIds, setSessionImportedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  // load 只依赖 appType (由 target 派生, 稳定), 避免 effect 因引用变化无限重跑
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listCcSwitchProviders(appType);
      setAvailable(result.available);
      setRawItems(result.providers);
      setSelectedIds(new Set());
    } catch {
      setAvailable(false);
      setRawItems([]);
    } finally {
      setLoading(false);
    }
  }, [appType]);

  useEffect(() => {
    if (isOpen) {
      void load();
    }
  }, [isOpen, load]);

  // 去重为派生计算: 现有列表 (外部) ∪ 本次已导入 (内部)
  const items = useMemo<CcSwitchImportItem[]>(() => {
    const existingKeys = new Set(
      existingProviders.map((provider) =>
        normalizeDedupKey(provider.name, provider.baseUrl),
      ),
    );
    return rawItems.map((provider) => ({
      ...provider,
      imported:
        sessionImportedIds.has(provider.id) ||
        existingKeys.has(normalizeDedupKey(provider.name, provider.baseUrl)),
    }));
  }, [rawItems, existingProviders, sessionImportedIds]);

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

  const selectableIds = useMemo(
    () => items.filter((item) => !item.imported).map((item) => item.id),
    [items],
  );

  const toggleAll = useCallback(() => {
    setSelectedIds((previous) =>
      previous.size >= selectableIds.length
        ? new Set()
        : new Set(selectableIds),
    );
  }, [selectableIds]);

  const importSelected = useCallback(async (): Promise<CcSwitchImportSummary> => {
    const selected = items.filter(
      (item) => selectedIds.has(item.id) && !item.imported,
    );
    setImporting(true);
    const failures: CcSwitchImportFailure[] = [];
    const succeededIds: string[] = [];
    try {
      for (const item of selected) {
        try {
          if (target === "claude") {
            await addClaudeProvider(buildClaudeProviderFromCcSwitch(item));
          } else if (target === "codex") {
            await addCodexProvider(buildCodexProviderFromCcSwitch(item));
          } else {
            await addKimiProvider(buildKimiProviderFromCcSwitch(item));
          }
          succeededIds.push(item.id);
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

    if (succeededIds.length > 0) {
      setSessionImportedIds((previous) => new Set([...previous, ...succeededIds]));
    }
    setSelectedIds(new Set());
    return { importedCount: succeededIds.length, failures };
  }, [items, selectedIds, target]);

  return {
    items,
    available,
    loading,
    importing,
    selectedIds,
    selectableCount: selectableIds.length,
    toggleItem,
    toggleAll,
    importSelected,
    reload: load,
  };
}
