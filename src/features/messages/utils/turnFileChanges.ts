/**
 * 回合级文件变更聚合 - 为「已编辑 N 个文件」回合汇总卡片提供数据。
 * 切段口径与 messagesLiveWindow.buildAssistantFinalBoundarySet 一致：
 * 以 user 消息分段，key 为段内最后一个 isFinal assistant 消息 id，
 * 卡片渲染在该消息的回合完成边界处。
 * 纯派生投影：不发请求、不 setState；单条工具项解析结果按引用 WeakMap 缓存，
 * 流式期间 items 数组高频变化时只对新引用做 JSON/diff 解析。
 */
import type { ConversationItem } from "../../../types";
import {
  asRecord,
  classifyToolCategory,
  parseToolArgs,
  pickStringField,
  resolveToolStatus,
  EDIT_CONTENT_KEYS,
  EDIT_NEW_KEYS,
  EDIT_OLD_KEYS,
  EDIT_PATH_KEYS,
  type ToolStatusTone,
} from "../components/toolBlocks/toolConstants";
import { computeDiffFromUnifiedPatch, computeDiffStats } from "./diffUtils";

type ToolItem = Extract<ConversationItem, { kind: "tool" }>;

export type TurnFileChange = {
  path: string;
  additions: number;
  deletions: number;
  status: ToolStatusTone;
};

export type TurnFileChangesSummary = {
  files: TurnFileChange[];
  totalAdditions: number;
  totalDeletions: number;
};

/**
 * 结构相等比较：供 TurnFilesChangedCard 的 memo 判定使用。
 * 派生函数每次重算都返回新 summary 对象，历史回合内容不变时靠它跳过卡片重渲染。
 */
export function areTurnFileChangesSummariesEqual(
  a: TurnFileChangesSummary,
  b: TurnFileChangesSummary,
): boolean {
  if (
    a.totalAdditions !== b.totalAdditions ||
    a.totalDeletions !== b.totalDeletions ||
    a.files.length !== b.files.length
  ) {
    return false;
  }
  return a.files.every((file, index) => {
    const other = b.files[index];
    return (
      file.path === other.path &&
      file.additions === other.additions &&
      file.deletions === other.deletions &&
      file.status === other.status
    );
  });
}

/**
 * 解析口径对齐 EditToolGroupBlock.parseEditItem：
 * fileChange 的 changes[].diff 走 unified patch 统计；
 * 否则从 detail JSON 的 old/new（Edit）或 content（Write）现算。
 * 区别：changes 里的多个文件各自成条，供按文件聚合。
 */
function parseEditToolChanges(item: ToolItem): TurnFileChange[] {
  const hasOutput = Boolean(item.output) || Boolean(item.changes?.length);
  const status = resolveToolStatus(item.status, hasOutput);

  if (item.toolType === "fileChange" && item.changes?.length) {
    return item.changes
      .filter((change) => Boolean(change.path))
      .map((change) => {
        const stats = computeDiffFromUnifiedPatch(change.diff ?? "");
        return { path: change.path, ...stats, status };
      });
  }

  const args = parseToolArgs(item.detail);
  const nestedInput = asRecord(args?.input);
  const nestedArgs = asRecord(args?.arguments);
  const path = pickStringField(args, nestedInput, nestedArgs, EDIT_PATH_KEYS);
  if (!path) {
    return [];
  }
  const oldString = pickStringField(
    args,
    nestedInput,
    nestedArgs,
    EDIT_OLD_KEYS,
  );
  const newString = pickStringField(
    args,
    nestedInput,
    nestedArgs,
    EDIT_NEW_KEYS,
  );
  if (oldString || newString) {
    return [{ path, ...computeDiffStats(oldString, newString), status }];
  }
  const content = pickStringField(
    args,
    nestedInput,
    nestedArgs,
    EDIT_CONTENT_KEYS,
  );
  if (content) {
    return [{ path, ...computeDiffStats("", content), status }];
  }
  return [{ path, additions: 0, deletions: 0, status }];
}

// reducer 不可变更新下已完成工具项引用稳定；引用变化（如状态流转）自然失效。
const editChangesCache = new WeakMap<ToolItem, TurnFileChange[]>();

function getEditToolChanges(item: ToolItem): TurnFileChange[] {
  const cached = editChangesCache.get(item);
  if (cached) {
    return cached;
  }
  const parsed = parseEditToolChanges(item);
  editChangesCache.set(item, parsed);
  return parsed;
}

function mergeStatus(a: ToolStatusTone, b: ToolStatusTone): ToolStatusTone {
  if (a === "failed" || b === "failed") {
    return "failed";
  }
  if (a === "processing" || b === "processing") {
    return "processing";
  }
  return "completed";
}

function accumulateFileChange(
  byPath: Map<string, TurnFileChange>,
  change: TurnFileChange,
) {
  const existing = byPath.get(change.path);
  byPath.set(
    change.path,
    existing
      ? {
          path: change.path,
          additions: existing.additions + change.additions,
          deletions: existing.deletions + change.deletions,
          status: mergeStatus(existing.status, change.status),
        }
      : change,
  );
}

function buildSummaryFromByPath(
  byPath: Map<string, TurnFileChange>,
): TurnFileChangesSummary {
  // 只保留有实际净变更的文件：零增删多为「失败/空操作」或失败后重试的残留调用，
  // 展示出来会误导（曾把重试成功的文件也标成失败）。第一版只列真正写入了内容的文件。
  const files = Array.from(byPath.values()).filter(
    (file) => file.additions > 0 || file.deletions > 0,
  );
  return {
    files,
    totalAdditions: files.reduce((sum, file) => sum + file.additions, 0),
    totalDeletions: files.reduce((sum, file) => sum + file.deletions, 0),
  };
}

function summarizeEditItems(items: ToolItem[]): TurnFileChangesSummary {
  const byPath = new Map<string, TurnFileChange>();
  for (const item of items) {
    for (const change of getEditToolChanges(item)) {
      accumulateFileChange(byPath, change);
    }
  }
  return buildSummaryFromByPath(byPath);
}

/**
 * 合并多个回合汇总为全会话累计（同路径累加）。
 * 供时间线末尾（输入框上方）的常驻会话卡使用；无任何文件变更时返回 null。
 */
export function mergeTurnFileChangesSummaries(
  summaries: Iterable<TurnFileChangesSummary>,
): TurnFileChangesSummary | null {
  const byPath = new Map<string, TurnFileChange>();
  for (const summary of summaries) {
    for (const change of summary.files) {
      accumulateFileChange(byPath, change);
    }
  }
  const merged = buildSummaryFromByPath(byPath);
  return merged.files.length > 0 ? merged : null;
}

/**
 * 扫描会话 items，产出「回合末 final assistant 消息 id → 该回合文件变更汇总」。
 * 无编辑动作或段内无 final assistant 的回合不产出条目。
 */
export function buildTurnFileChangesByBoundaryId(
  items: ConversationItem[],
): Map<string, TurnFileChangesSummary> {
  const result = new Map<string, TurnFileChangesSummary>();
  let segmentEditItems: ToolItem[] = [];
  let boundaryId: string | null = null;

  const settleSegment = () => {
    if (!boundaryId || segmentEditItems.length === 0) {
      return;
    }
    const summary = summarizeEditItems(segmentEditItems);
    if (summary.files.length > 0) {
      result.set(boundaryId, summary);
    }
  };

  for (const entry of items) {
    if (entry.kind === "message" && entry.role === "user") {
      settleSegment();
      segmentEditItems = [];
      boundaryId = null;
      continue;
    }
    if (
      entry.kind === "message" &&
      entry.role === "assistant" &&
      entry.isFinal === true
    ) {
      boundaryId = entry.id;
      continue;
    }
    if (entry.kind === "tool") {
      const category = classifyToolCategory(entry);
      if (category === "edit" || category === "fileChange") {
        segmentEditItems.push(entry);
      }
    }
  }
  settleSegment();
  return result;
}
