/**
 * Shared DataSource（Wave 3 / A3）。
 *
 * 职责：把 Rust `SharedProjector` 产出的 `SharedProjectionItem[]` 映射为
 * `ConversationItem[]`，供 Messages/Canvas 消费。
 *
 * 纪律：
 * - 与 Native 路径完全隔离；本模块不 import threadItems / Native 数据流。
 * - 只在 feature flag 开启时被上层选择；默认关闭（dark launch，Shared 真实流量保持 V0）。
 * - `systemNotice` / `metadata` 不是 `ConversationItem` kind，映射时丢弃
 *   （它们是 Shadow 观测面，不属于 Canvas 渲染面）。
 */

import type { ConversationItem } from "../../../../types/conversation";
import type { EngineType } from "../../../../types/engine";
import { BUILTIN_ENGINE_TYPES } from "../../../engine/engineRegistry";
import type { SharedProjectionItem } from "./types";

export const SHARED_PROJECTION_STORAGE_KEY = "mossx.sharedProjection";

function isEnabledFlag(value: unknown) {
  return typeof value === "string" && /^(1|true|yes|on)$/i.test(value.trim());
}

function readBooleanStorageFlag(key: string) {
  try {
    if (typeof window === "undefined") {
      return false;
    }
    return isEnabledFlag(window.localStorage.getItem(key));
  } catch {
    return false;
  }
}

/** 设置页测试开关只管理当前 canonical local override。 */
export function isSharedProjectionTestOverrideEnabled() {
  return readBooleanStorageFlag(SHARED_PROJECTION_STORAGE_KEY);
}

/**
 * 写入测试 override。返回值表示 storage 是否实际变化，供调用方决定是否 reload。
 * 关闭时删除 key，让 DataSource 回到 build flag / compatibility flag / 默认值判定。
 */
export function setSharedProjectionTestOverrideEnabled(enabled: boolean) {
  try {
    if (typeof window === "undefined") {
      return false;
    }
    const currentValue = window.localStorage.getItem(
      SHARED_PROJECTION_STORAGE_KEY,
    );
    if (enabled) {
      if (isEnabledFlag(currentValue)) {
        return false;
      }
      window.localStorage.setItem(SHARED_PROJECTION_STORAGE_KEY, "1");
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

/** Shared Projection DataSource 开关（默认关闭）。 */
export function isSharedProjectionDataSourceEnabled() {
  return (
    isEnabledFlag(import.meta.env.VITE_MOSSX_SHARED_PROJECTION) ||
    isSharedProjectionTestOverrideEnabled() ||
    readBooleanStorageFlag("ccgui.sharedProjection")
  );
}

function readString(content: Record<string, unknown>, key: string) {
  const value = content[key];
  return typeof value === "string" ? value : "";
}

function readEngineSource(content: Record<string, unknown>): EngineType | undefined {
  const value = content.engineSource;
  return typeof value === "string" &&
    BUILTIN_ENGINE_TYPES.includes(value as EngineType)
    ? (value as EngineType)
    : undefined;
}

function toConversationItem(item: SharedProjectionItem): ConversationItem | null {
  const { id, kind, content } = item;
  const engineSource = readEngineSource(content);

  switch (kind) {
    case "message": {
      const role = content.role === "user" ? "user" : "assistant";
      return {
        id,
        kind: "message",
        role,
        text: readString(content, "text"),
        turnId: typeof content.turnId === "string" ? content.turnId : null,
        engineSource,
        isFinal: content.isFinal === true,
        ...(typeof content.finalCompletedAt === "number"
          ? { finalCompletedAt: content.finalCompletedAt }
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
    case "tool":
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
      };
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
 * DataSource 选择 seam（D6）：flag 关闭或输入为空时返回 `null`，
 * 调用方继续走 Native 路径；返回数组时调用方才切换到 Shared 渲染。
 *
 * Wave 3 仅提供 seam；Canvas 消费端随 Wave 4 Tauri command 一并接入。
 */
export function resolveSharedConversationItems(
  items: readonly SharedProjectionItem[] | null | undefined,
): ConversationItem[] | null {
  if (!isSharedProjectionDataSourceEnabled() || !items) {
    return null;
  }
  return toSharedConversationItems(items);
}
