// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  pickAlwaysTopKCandidateIds,
  retrieveMemoryPickCandidates,
} from "./memoryPickRetrieval";
import type { MemoryPickCandidate } from "./memoryPickTypes";

function item(id: string, title: string, summary: string, updatedAt: number) {
  return {
    id,
    workspaceId: "ws",
    kind: "note",
    title,
    summary,
    detail: summary,
    cleanText: summary,
    rawText: summary,
    tags: [],
    importance: "medium",
    source: "manual",
    fingerprint: id,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("retrieveMemoryPickCandidates", () => {
  it("returns related candidates by relevance threshold", async () => {
    const listFn = vi.fn(async () => ({
      items: [
        item("a", "数据库连接池", "超时与连接上限", 10),
        item("b", "UI 主题", "暗色模式", 20),
        item("c", "数据库索引", "慢查询优化", 30),
      ],
      total: 3,
    }));

    const result = await retrieveMemoryPickCandidates({
      workspaceId: "ws",
      query: "数据库 超时",
      listFn: listFn as never,
      limit: 10,
      timeoutMs: 2000,
    });

    expect(result.error).toBeNull();
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.some((c) => c.id === "a" || c.id === "c")).toBe(
      true,
    );
    // 无关 UI 主题不应因「无正分就全塞」而出现
    expect(listFn).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, pageSize: 200 }),
    );
  });

  it("你好 with no lexical hit returns empty without timeout", async () => {
    const listFn = vi.fn(async () => ({
      items: [
        item("a", "数据库连接池", "超时与连接上限", 10),
        item("b", "CRUD 示例", "用户表接口", 20),
      ],
      total: 2,
    }));

    const result = await retrieveMemoryPickCandidates({
      workspaceId: "ws",
      query: "你好",
      listFn: listFn as never,
      timeoutMs: 2000,
    });

    expect(result.error).toBeNull();
    expect(result.candidates).toEqual([]);
  });

  it("returns timeout only when list hangs past budget", async () => {
    const listFn = vi.fn(
      () =>
        new Promise(() => {
          /* never */
        }),
    );
    const result = await retrieveMemoryPickCandidates({
      workspaceId: "ws",
      query: "anything",
      listFn: listFn as never,
      timeoutMs: 40,
    });
    expect(result.candidates).toEqual([]);
    expect(result.error).toBe("timeout");
  });

  it("returns empty without error when no memories", async () => {
    const listFn = vi.fn(async () => ({ items: [], total: 0 }));
    const result = await retrieveMemoryPickCandidates({
      workspaceId: "ws",
      query: "x",
      listFn: listFn as never,
    });
    expect(result).toEqual({ candidates: [], error: null });
  });
});

describe("pickAlwaysTopKCandidateIds", () => {
  it("picks top k by score", () => {
    const candidates: MemoryPickCandidate[] = [
      { id: "1", title: "1", summary: "", score: 0.1 },
      { id: "2", title: "2", summary: "", score: 0.9 },
      { id: "3", title: "3", summary: "", score: 0.5 },
    ];
    expect(pickAlwaysTopKCandidateIds(candidates, 2)).toEqual(["2", "3"]);
  });
});
