/**
 * Shared DataSource（Wave 3 / A3）。
 *
 * 职责：把 Rust `SharedProjector` 产出的 `SharedProjectionItem[]` 映射为
 * `ConversationItem[]`，供 Messages/Canvas 消费。
 *
 * 纪律：
 * - 与 Native 路径完全隔离；本模块不 import threadItems / Native 数据流。
 * - Phase 2 后默认开启；只允许 explicit-negative flag 回滚到 Legacy-only 读取。
 * - `systemNotice` / `metadata` 不是 `ConversationItem` kind，映射时丢弃
 *   （它们是 Shadow 观测面，不属于 Canvas 渲染面）。
 */

import type { ConversationItem } from "../../../../types/conversation";
import type { EngineType } from "../../../../types/engine";
import { BUILTIN_ENGINE_TYPES } from "../../../engine/engineRegistry";
import type { SharedProjectionItem } from "./types";
import { LOCAL_PROVIDER_LABEL } from "../../../../utils/turnBadge";

export const SHARED_PROJECTION_STORAGE_KEY = "mossx.sharedProjection";

function isEnabledFlag(value: unknown) {
  return typeof value === "string" && /^(1|true|yes|on)$/i.test(value.trim());
}

function isDisabledFlag(value: unknown) {
  return typeof value === "string" && /^(0|false|no|off)$/i.test(value.trim());
}

function parseBooleanFlag(value: unknown): boolean | null {
  if (isEnabledFlag(value)) {
    return true;
  }
  if (isDisabledFlag(value)) {
    return false;
  }
  return null;
}

function readStorageFlag(key: string): boolean | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return parseBooleanFlag(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

/**
 * 写入测试 override。返回值表示 storage 是否实际变化，供调用方决定是否 reload。
 * `true` 开启；`false` 显式回滚 Legacy-only；`null` 回到 build/default 判定。
 */
export function setSharedProjectionTestOverrideEnabled(
  enabled: boolean | null,
) {
  try {
    if (typeof window === "undefined") {
      return false;
    }
    const currentValue = window.localStorage.getItem(
      SHARED_PROJECTION_STORAGE_KEY,
    );
    if (enabled !== null) {
      const nextValue = enabled ? "1" : "0";
      if (currentValue === nextValue) {
        return false;
      }
      window.localStorage.setItem(SHARED_PROJECTION_STORAGE_KEY, nextValue);
      return true;
    }
    if (currentValue === null) {
      return false;
    }
    window.localStorage.removeItem(SHARED_PROJECTION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Shared Projection DataSource：local override > build > legacy override > default-on。 */
export function isSharedProjectionDataSourceEnabled() {
  const localOverride = readStorageFlag(SHARED_PROJECTION_STORAGE_KEY);
  if (localOverride !== null) {
    return localOverride;
  }
  const buildOverride = parseBooleanFlag(
    import.meta.env.VITE_MOSSX_SHARED_PROJECTION,
  );
  if (buildOverride !== null) {
    return buildOverride;
  }
  return readStorageFlag("ccgui.sharedProjection") ?? true;
}

function readString(content: Record<string, unknown>, key: string) {
  const value = content[key];
  return typeof value === "string" ? value : "";
}

function readToolChanges(
  value: unknown,
): { path: string; kind?: string; diff?: string }[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  const changes = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const path = typeof record.path === "string" ? record.path.trim() : "";
      if (!path) {
        return null;
      }
      return {
        path,
        ...(typeof record.kind === "string" ? { kind: record.kind } : {}),
        ...(typeof record.diff === "string" ? { diff: record.diff } : {}),
      };
    })
    .filter((entry): entry is { path: string; kind?: string; diff?: string } => entry !== null);
  return changes.length > 0 ? changes : undefined;
}

function readEngineSource(content: Record<string, unknown>): EngineType | undefined {
  const value = content.engineSource;
  return typeof value === "string" &&
    BUILTIN_ENGINE_TYPES.includes(value as EngineType)
    ? (value as EngineType)
    : undefined;
}

function readExecutionTargetSnapshot(
  content: Record<string, unknown>,
  fidelity: SharedProjectionItem["fidelity"],
): Extract<ConversationItem, { kind: "message" }>["executionTargetSnapshot"] {
  const value = content.executionTargetSnapshot;
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const snapshot = value as Record<string, unknown>;
  const engine = snapshot.engine;
  if (
    typeof engine !== "string" ||
    !BUILTIN_ENGINE_TYPES.includes(engine as EngineType)
  ) {
    return undefined;
  }
  const reasoning =
    snapshot.reasoning && typeof snapshot.reasoning === "object"
      ? (snapshot.reasoning as Record<string, unknown>)
      : null;
  const providerProfileId =
    typeof snapshot.providerProfileId === "string"
      ? snapshot.providerProfileId
      : null;
  const isCanonicalLocalTarget =
    fidelity === "canonical" &&
    providerProfileId === null &&
    snapshot.providerProfileSource === "local";
  const providerProfileSource =
    snapshot.providerProfileSource === "local" ||
    snapshot.providerProfileSource === "managed"
      ? snapshot.providerProfileSource
      : isCanonicalLocalTarget
        ? "local"
        : null;
  return {
    engine: engine as EngineType,
    providerProfileId,
    modelCatalogEntryId:
      typeof snapshot.modelCatalogEntryId === "string"
        ? snapshot.modelCatalogEntryId
        : null,
    model: typeof snapshot.model === "string" ? snapshot.model : null,
    reasoning:
      reasoning && typeof reasoning.effort === "string"
        ? { effort: reasoning.effort }
        : null,
    providerProfileNameSnapshot:
      typeof snapshot.providerProfileNameSnapshot === "string"
        ? snapshot.providerProfileNameSnapshot
        : isCanonicalLocalTarget
          ? LOCAL_PROVIDER_LABEL
          : null,
    providerProfileSource,
    runtimeCapabilityFingerprint:
      typeof snapshot.runtimeCapabilityFingerprint === "string"
        ? snapshot.runtimeCapabilityFingerprint
        : null,
    providerAvailable:
      typeof snapshot.providerAvailable === "boolean"
        ? snapshot.providerAvailable
        : true,
  };
}

function toConversationItem(item: SharedProjectionItem): ConversationItem | null {
  const { id, kind, content } = item;
  const engineSource = readEngineSource(content);

  switch (kind) {
    case "message": {
      const role = content.role === "user" ? "user" : "assistant";
      const executionTargetSnapshot = readExecutionTargetSnapshot(
        content,
        item.fidelity,
      );
      return {
        id,
        kind: "message",
        role,
        text: readString(content, "text"),
        turnId: typeof content.turnId === "string" ? content.turnId : null,
        engineSource,
        ...(executionTargetSnapshot ? { executionTargetSnapshot } : {}),
        isFinal: content.isFinal === true,
        ...(typeof content.finalCompletedAt === "number"
          ? { finalCompletedAt: content.finalCompletedAt }
          : {}),
        ...(typeof content.finalDurationMs === "number"
          ? { finalDurationMs: content.finalDurationMs }
          : {}),
        ...(typeof content.finalInputTokens === "number"
          ? { finalInputTokens: content.finalInputTokens }
          : {}),
        ...(typeof content.finalOutputTokens === "number"
          ? { finalOutputTokens: content.finalOutputTokens }
          : {}),
      };
    }
    case "reasoning":
      return {
        id,
        kind: "reasoning",
        summary: readString(content, "summary"),
        content: readString(content, "content"),
        engineSource,
      };
    case "tool": {
      const changes = readToolChanges(content.changes);
      return {
        id,
        kind: "tool",
        toolType: readString(content, "toolType"),
        engineSource,
        ...(typeof content.turnId === "string" ? { turnId: content.turnId } : {}),
        title: readString(content, "title"),
        detail: readString(content, "detail"),
        ...(typeof content.status === "string" ? { status: content.status } : {}),
        ...(typeof content.output === "string" ? { output: content.output } : {}),
        ...(typeof content.durationMs === "number" ? { durationMs: content.durationMs } : {}),
        ...(changes ? { changes } : {}),
      };
    }
    case "generatedImage": {
      const rawImages = Array.isArray(content.images) ? content.images : [];
      const images = rawImages
        .filter(
          (image): image is { src: string; localPath?: string | null } =>
            typeof image === "object" &&
            image !== null &&
            typeof (image as { src?: unknown }).src === "string",
        )
        .map((image) => ({ src: image.src, localPath: image.localPath ?? null }));
      const status =
        content.status === "processing" || content.status === "degraded"
          ? content.status
          : "completed";
      return { id, kind: "generatedImage", engineSource, status, images };
    }
    case "diff":
      return {
        id,
        kind: "diff",
        title: readString(content, "title"),
        diff: readString(content, "diff"),
        ...(typeof content.status === "string" ? { status: content.status } : {}),
        engineSource,
      };
    case "review":
      return {
        id,
        kind: "review",
        state: content.state === "started" ? "started" : "completed",
        text: readString(content, "text"),
        engineSource,
      };
    case "explore": {
      const rawEntries = Array.isArray(content.entries) ? content.entries : [];
      const entries = rawEntries
        .filter(
          (entry): entry is { kind: "read" | "search" | "list" | "run"; label: string; detail?: string } =>
            typeof entry === "object" &&
            entry !== null &&
            ["read", "search", "list", "run"].includes(
              String((entry as { kind?: unknown }).kind),
            ) &&
            typeof (entry as { label?: unknown }).label === "string",
        )
        .map((entry) => ({
          kind: entry.kind,
          label: entry.label,
          ...(typeof entry.detail === "string" ? { detail: entry.detail } : {}),
        }));
      return {
        id,
        kind: "explore",
        status: content.status === "exploring" ? "exploring" : "explored",
        engineSource,
        entries,
      };
    }
    case "systemNotice":
    case "metadata":
      // Shadow 观测面，不属于 Canvas 渲染面。
      return null;
  }
}

/**
 * 把 Shared Projection items 映射为 ConversationItems。
 * 纯函数：不做 IO，不修改输入；输入顺序即输出顺序。
 */
export function toSharedConversationItems(
  items: readonly SharedProjectionItem[],
): ConversationItem[] {
  const mapped: ConversationItem[] = [];
  for (const item of items) {
    const conversationItem = toConversationItem(item);
    if (conversationItem !== null) {
      mapped.push(conversationItem);
    }
  }
  return mapped;
}

/**
 * DataSource 选择 seam：explicit-negative rollback 或输入为空时返回 `null`；
 * Shared loader 据此保留 Legacy-only 读取。
 */
export function resolveSharedConversationItems(
  items: readonly SharedProjectionItem[] | null | undefined,
): ConversationItem[] | null {
  if (!isSharedProjectionDataSourceEnabled() || !items) {
    return null;
  }
  return toSharedConversationItems(items);
}
