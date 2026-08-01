/**
 * 文件修改场景共享工具：path 归一、status 聚合。
 * 供 EditToolGroupBlock / FileChangeToolContent 共用，避免组件互相 import。
 */
import type { ToolStatusTone } from "./toolConstants";

/** 轻量 path 归一：trim + 去 ./ 前缀，降低重复计数噪音。 */
export function normalizeEditScenePath(path: string): string {
  return path.trim().replace(/^\.\//, "");
}

/** 场景级 status：failed > processing > completed。 */
export function mergeEditSceneStatus(
  statuses: readonly ToolStatusTone[],
): ToolStatusTone {
  if (statuses.some((status) => status === "failed")) {
    return "failed";
  }
  if (statuses.some((status) => status === "processing")) {
    return "processing";
  }
  return "completed";
}
