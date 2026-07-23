import { describe, expect, it } from "vitest";
import { getClientStoreSync, writeClientStoreValue } from "../../../services/clientStorage";
import {
  RADAR_RECENT_TTL_MS,
  RADAR_STORE_NAME,
  SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
  SESSION_RADAR_READ_STATE_KEY,
  SESSION_RADAR_RECENT_STORAGE_KEY,
} from "./sessionRadarPersistence";
import { deleteSessionRadarHistoryEntries } from "./sessionRadarHistoryManagement";

describe("deleteSessionRadarHistoryEntries", () => {
  it("removes selected entries and records dismissed cutoff", () => {
    const now = Date.now();
    writeClientStoreValue(
      RADAR_STORE_NAME,
      SESSION_RADAR_RECENT_STORAGE_KEY,
      [
        {
          id: "ws-a:t-1",
          workspaceId: "ws-a",
          threadId: "t-1",
          completedAt: now - 1000,
          startedAt: now - 1100,
          durationMs: 100,
        },
        {
          id: "ws-a:t-2",
          workspaceId: "ws-a",
          threadId: "t-2",
          completedAt: now - 2000,
          startedAt: now - 2100,
          durationMs: 100,
        },
      ],
      { immediate: true },
    );
    writeClientStoreValue(
      RADAR_STORE_NAME,
      SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
      {},
      { immediate: true },
    );
    writeClientStoreValue(
      RADAR_STORE_NAME,
      SESSION_RADAR_READ_STATE_KEY,
      {
        "ws-a:t-1": now - 1000,
        "ws-a:t-2": now - 2000,
      },
      { immediate: true },
    );

    const result = deleteSessionRadarHistoryEntries([{ id: "ws-a:t-1", completedAt: now - 1000 }]);
    expect(result.failed).toEqual([]);
    expect(result.succeededEntryIds).toEqual(["ws-a:t-1"]);

    const nextRecent = getClientStoreSync<Array<{ id: string }>>(
      RADAR_STORE_NAME,
      SESSION_RADAR_RECENT_STORAGE_KEY,
    );
    expect(nextRecent?.map((entry) => entry.id)).toEqual(["ws-a:t-2"]);

    const dismissedById = getClientStoreSync<Record<string, number>>(
      RADAR_STORE_NAME,
      SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
    );
    expect(dismissedById).toMatchObject({
      "ws-a:t-1": now - 1000,
    });

    const readStateById = getClientStoreSync<Record<string, number>>(
      RADAR_STORE_NAME,
      SESSION_RADAR_READ_STATE_KEY,
    );
    expect(readStateById).toEqual({
      "ws-a:t-2": now - 2000,
    });
  });

  it("lazily prunes oversized legacy entries and their dismissed records on delete", () => {
    const now = Date.now();
    writeClientStoreValue(
      RADAR_STORE_NAME,
      SESSION_RADAR_RECENT_STORAGE_KEY,
      Array.from({ length: 55 }, (_, index) => ({
        id: `ws-a:t-${index}`,
        workspaceId: "ws-a",
        threadId: `t-${index}`,
        completedAt: now - index * 1000,
        startedAt: null,
        durationMs: null,
      })),
      { immediate: true },
    );
    writeClientStoreValue(
      RADAR_STORE_NAME,
      SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
      { "ws-a:t-54": now - 54_000 },
      { immediate: true },
    );
    writeClientStoreValue(RADAR_STORE_NAME, SESSION_RADAR_READ_STATE_KEY, {}, { immediate: true });

    const result = deleteSessionRadarHistoryEntries([{ id: "ws-a:t-0", completedAt: now }]);
    expect(result.failed).toEqual([]);

    const nextRecent = getClientStoreSync<Array<{ id: string }>>(
      RADAR_STORE_NAME,
      SESSION_RADAR_RECENT_STORAGE_KEY,
    );
    expect(nextRecent).toHaveLength(50);
    expect(nextRecent?.some((entry) => entry.id === "ws-a:t-54")).toBe(false);

    const dismissedById = getClientStoreSync<Record<string, number>>(
      RADAR_STORE_NAME,
      SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
    );
    // 用户删除的 cutoff 保留；被 bounds 物理修剪的条目 dismissed 记录清除。
    expect(dismissedById?.["ws-a:t-0"]).toBe(now);
    expect(dismissedById?.["ws-a:t-54"]).toBeUndefined();
  });

  it("returns NOT_FOUND when entry does not exist", () => {
    writeClientStoreValue(RADAR_STORE_NAME, SESSION_RADAR_RECENT_STORAGE_KEY, [], { immediate: true });
    const result = deleteSessionRadarHistoryEntries([{ id: "missing:id", completedAt: 0 }]);
    expect(result.succeededEntryIds).toEqual([]);
    expect(result.failed).toEqual([
      {
        id: "missing:id",
        code: "NOT_FOUND",
        message: "Radar history entry not found",
      },
    ]);
  });

  it("covers live updatedAt in the dismissed cutoff so refreshed entries cannot resurrect", () => {
    const now = Date.now();
    // persisted.updatedAt 已被 merge 用 live thread 刷新并回写，领先 completedAt。
    writeClientStoreValue(
      RADAR_STORE_NAME,
      SESSION_RADAR_RECENT_STORAGE_KEY,
      [
        {
          id: "ws-a:t-1",
          workspaceId: "ws-a",
          threadId: "t-1",
          completedAt: now - 10_000,
          updatedAt: now - 500,
          startedAt: null,
          durationMs: null,
        },
      ],
      { immediate: true },
    );
    writeClientStoreValue(
      RADAR_STORE_NAME,
      SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
      {},
      { immediate: true },
    );
    writeClientStoreValue(RADAR_STORE_NAME, SESSION_RADAR_READ_STATE_KEY, {}, { immediate: true });

    // 调用方展示的 entry.updatedAt（live thread 已推进到 now-100）必须进入 cutoff。
    const result = deleteSessionRadarHistoryEntries([
      { id: "ws-a:t-1", completedAt: now - 10_000, liveUpdatedAt: now - 100 },
    ]);
    expect(result.failed).toEqual([]);

    const dismissedById = getClientStoreSync<Record<string, number>>(
      RADAR_STORE_NAME,
      SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
    );
    // cutoff 取四方最大值：liveUpdatedAt（now-100）领先其余三者。
    expect(dismissedById?.["ws-a:t-1"]).toBe(now - 100);
  });

  it("covers persisted updatedAt in the cutoff even without a caller liveUpdatedAt", () => {
    const now = Date.now();
    writeClientStoreValue(
      RADAR_STORE_NAME,
      SESSION_RADAR_RECENT_STORAGE_KEY,
      [
        {
          id: "ws-a:t-2",
          workspaceId: "ws-a",
          threadId: "t-2",
          completedAt: now - 10_000,
          updatedAt: now - 500,
          startedAt: null,
          durationMs: null,
        },
      ],
      { immediate: true },
    );
    writeClientStoreValue(
      RADAR_STORE_NAME,
      SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
      {},
      { immediate: true },
    );
    writeClientStoreValue(RADAR_STORE_NAME, SESSION_RADAR_READ_STATE_KEY, {}, { immediate: true });

    const result = deleteSessionRadarHistoryEntries([
      { id: "ws-a:t-2", completedAt: now - 10_000 },
    ]);
    expect(result.failed).toEqual([]);

    const dismissedById = getClientStoreSync<Record<string, number>>(
      RADAR_STORE_NAME,
      SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
    );
    expect(dismissedById?.["ws-a:t-2"]).toBe(now - 500);
  });

  it("lazily drops dismissed records older than the recent TTL on delete", () => {
    const now = Date.now();
    writeClientStoreValue(
      RADAR_STORE_NAME,
      SESSION_RADAR_RECENT_STORAGE_KEY,
      [
        {
          id: "ws-a:t-1",
          workspaceId: "ws-a",
          threadId: "t-1",
          completedAt: now - 1000,
          startedAt: null,
          durationMs: null,
        },
      ],
      { immediate: true },
    );
    writeClientStoreValue(
      RADAR_STORE_NAME,
      SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
      {
        "ws-a:t-stale": now - RADAR_RECENT_TTL_MS - 1000,
        "ws-a:t-fresh": now - 2000,
      },
      { immediate: true },
    );
    writeClientStoreValue(RADAR_STORE_NAME, SESSION_RADAR_READ_STATE_KEY, {}, { immediate: true });

    const result = deleteSessionRadarHistoryEntries([{ id: "ws-a:t-1", completedAt: now - 1000 }]);
    expect(result.failed).toEqual([]);

    const dismissedById = getClientStoreSync<Record<string, number>>(
      RADAR_STORE_NAME,
      SESSION_RADAR_DISMISSED_COMPLETED_AT_BY_ID_KEY,
    );
    // 超出 recent TTL 的陈旧 cutoff 在读取点被惰性清除；未过期的记录保留。
    expect(dismissedById?.["ws-a:t-stale"]).toBeUndefined();
    expect(dismissedById?.["ws-a:t-fresh"]).toBe(now - 2000);
    expect(dismissedById?.["ws-a:t-1"]).toBe(now - 1000);
  });
});
