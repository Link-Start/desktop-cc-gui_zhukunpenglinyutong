import type { ThreadSummary } from "../../../types";

function isPositiveTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** 侧栏稳定排序键：优先 createdAt，缺失时回退 updatedAt。 */
export function resolveThreadCreatedAt(
  thread: Pick<ThreadSummary, "createdAt" | "updatedAt">,
): number {
  if (isPositiveTimestamp(thread.createdAt)) {
    return thread.createdAt;
  }
  return isPositiveTimestamp(thread.updatedAt) ? thread.updatedAt : 0;
}

/** 取最早的已知时间，避免 refresh 把 createdAt 抬成最新 updatedAt。 */
export function pickStableCreatedAt(
  ...candidates: Array<number | null | undefined>
): number | undefined {
  let oldest: number | undefined;
  for (const value of candidates) {
    if (!isPositiveTimestamp(value)) {
      continue;
    }
    oldest = oldest == null ? value : Math.min(oldest, value);
  }
  return oldest;
}

/**
 * 合并侧栏行时的 createdAt 契约：
 * - 已冻住的 createdAt 只接受更早的明确 createdAt，禁止用最新 updatedAt 抬时间
 * - 还没有 createdAt 的行，用明确 createdAt 或第一眼已知时间冻住一次
 */
export function resolveMergedThreadCreatedAt(
  previous: Pick<ThreadSummary, "createdAt" | "updatedAt"> | undefined,
  next: Pick<ThreadSummary, "createdAt" | "updatedAt">,
): number | undefined {
  if (isPositiveTimestamp(previous?.createdAt)) {
    return pickStableCreatedAt(previous.createdAt, next.createdAt);
  }
  return pickStableCreatedAt(
    next.createdAt,
    previous?.updatedAt,
    next.updatedAt,
  );
}

export function compareThreadSummariesByCreatedAtDesc(
  left: ThreadSummary,
  right: ThreadSummary,
): number {
  const leftCreatedAt = resolveThreadCreatedAt(left);
  const rightCreatedAt = resolveThreadCreatedAt(right);
  if (rightCreatedAt !== leftCreatedAt) {
    return rightCreatedAt - leftCreatedAt;
  }
  return left.id.localeCompare(right.id);
}
