import type { ProjectMemoryItem } from "../../../services/tauri";
import {
  normalizeQueryTerms,
  RELEVANCE_THRESHOLD,
  scoreMemoryRelevance,
} from "../utils/memoryContextInjection";
import {
  resolveProjectMemoryCompactSummary,
  resolveProjectMemoryCompactTitle,
} from "../utils/projectMemoryDisplay";
import {
  MEMORY_SCOUT_FALLBACK_SCAN_PAGE_SIZE,
  type MemoryScoutListFn,
} from "../utils/memoryScout";
import {
  ALWAYS_TOP_K,
  PICK_CANDIDATE_LIMIT,
  type MemoryPickCandidate,
} from "./memoryPickTypes";
import { selectTopKIds } from "./memoryPickPolicy";

/**
 * 与 Memory Scout 对齐的单页扫描，避免多页 list 在 1s 内超时误报。
 * 不修改 memoryScout.ts 本体，只复用其 list 约定与 pageSize。
 */
const LIST_PAGE_SIZE = MEMORY_SCOUT_FALLBACK_SCAN_PAGE_SIZE; // 200
/** 单次 list 超时（ms）；原 1000 对大库易假超时 */
const PICK_LIST_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("memory-pick-timeout"));
    }, ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

function toCandidate(
  memory: ProjectMemoryItem,
  score: number,
): MemoryPickCandidate {
  return {
    id: memory.id,
    title: resolveProjectMemoryCompactTitle(memory),
    summary: resolveProjectMemoryCompactSummary(memory),
    score,
    kind: memory.kind ?? memory.recordKind ?? undefined,
    importance: memory.importance ?? undefined,
    tags: memory.tags ?? undefined,
    engine: memory.engine ?? null,
    threadId: memory.threadId ?? null,
    updatedAt: memory.updatedAt,
    detail: memory.detail ?? memory.cleanText ?? memory.rawText ?? null,
    rawItem: memory,
  };
}

/**
 * 检索候选：对齐 Scout 的「list 一页 + 相关分过滤」。
 * - 「你好」无相关词 → 空候选（不是超时）
 * - 不扫 5 页 1000 条（易触发假超时）
 */
export async function retrieveMemoryPickCandidates(params: {
  workspaceId: string;
  query: string;
  listFn: MemoryScoutListFn;
  limit?: number;
  timeoutMs?: number;
}): Promise<{
  candidates: MemoryPickCandidate[];
  error: "timeout" | "retrieve_failed" | null;
}> {
  const limit = params.limit ?? PICK_CANDIDATE_LIMIT;
  const timeoutMs = params.timeoutMs ?? PICK_LIST_TIMEOUT_MS;
  const queryTerms = normalizeQueryTerms(params.query);

  try {
    const result = await withTimeout(
      params.listFn({
        workspaceId: params.workspaceId,
        query: null,
        importance: null,
        page: 0,
        pageSize: LIST_PAGE_SIZE,
      }),
      timeoutMs,
    );

    const pool = result.items ?? [];
    if (pool.length === 0) {
      return { candidates: [], error: null };
    }

    // 无有效检索词：与 Scout 类似，不强行塞无关记忆
    if (queryTerms.length === 0) {
      return { candidates: [], error: null };
    }

    const scored = pool
      .map((memory) => ({
        memory,
        score: scoreMemoryRelevance(memory, queryTerms, {
          queryText: params.query,
        }),
      }))
      .filter((entry) => entry.score >= RELEVANCE_THRESHOLD)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.memory.updatedAt - a.memory.updatedAt;
      })
      .slice(0, limit);

    return {
      candidates: scored.map((entry) =>
        toCandidate(entry.memory, entry.score),
      ),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("memory-pick-timeout")) {
      return { candidates: [], error: "timeout" };
    }
    return { candidates: [], error: "retrieve_failed" };
  }
}

export function pickAlwaysTopKCandidateIds(
  candidates: MemoryPickCandidate[],
  topK: number = ALWAYS_TOP_K,
): string[] {
  return selectTopKIds(
    candidates.map((c) => ({
      id: c.id,
      score: c.score,
      updatedAt: c.updatedAt,
    })),
    topK,
  );
}
