/**
 * 文件修改场景共享工具：path 归一、status 聚合、多文件 patch 拆分。
 * 供 EditToolGroupBlock / FileChangeToolContent 共用，避免组件互相 import。
 */
import type { ToolStatusTone } from "./toolConstants";

/** 轻量 path 归一：trim + 去 ./ 前缀，降低重复计数噪音。 */
export function normalizeEditScenePath(path: string): string {
  let normalized = path.trim().replace(/^\.\//, "");
  // Guard against accidental status prefixes from "A path" / "Asrc/..." style misuse
  // (git status letter glued onto a workspace-relative path).
  normalized = normalized.replace(/^[AMDR]\s+/, "");
  if (/^[AMDR](src\/|app\/|lib\/|packages\/|\/|[A-Za-z]:[\\/])/.test(normalized)) {
    normalized = normalized.slice(1);
  }
  return normalized;
}

/**
 * From a multi-file unified / apply_patch dump, extract the slice for one path.
 * Used when Codex fileChange rows have path but empty per-file `diff`.
 */
export function extractUnifiedDiffForPath(
  output: string | undefined,
  filePath: string,
): string {
  const raw = (output ?? "").trim();
  if (!raw) {
    return "";
  }
  const normalizedPath = normalizeEditScenePath(filePath).replace(/\\/g, "/");
  if (!normalizedPath) {
    return "";
  }
  const baseName = normalizedPath.split("/").filter(Boolean).pop() ?? normalizedPath;

  // Single-file patch body (no multi-file headers)
  if (
    !raw.includes("diff --git ") &&
    !raw.includes("*** Begin Patch") &&
    !raw.includes("*** Update File:") &&
    !raw.includes("*** Add File:")
  ) {
    if (
      raw.startsWith("@@") ||
      (raw.includes("\n+") && raw.includes("\n-")) ||
      raw.startsWith("+") ||
      raw.startsWith("-")
    ) {
      return raw;
    }
    return "";
  }

  // git unified: split on diff --git
  if (raw.includes("diff --git ")) {
    const chunks = raw.split(/(?=^diff --git )/m);
    for (const chunk of chunks) {
      const header = chunk.split("\n")[0] ?? "";
      if (
        header.includes(`b/${normalizedPath}`) ||
        header.includes(`a/${normalizedPath}`) ||
        header.endsWith(` ${normalizedPath}`) ||
        header.includes(`/${baseName}`) ||
        header.includes(` ${baseName}`)
      ) {
        return chunk.trim();
      }
    }
  }

  // apply_patch style
  if (raw.includes("*** Update File:") || raw.includes("*** Add File:")) {
    const chunks = raw.split(/(?=\*\*\* (?:Update|Add) File:)/);
    for (const chunk of chunks) {
      const first = chunk.split("\n")[0] ?? "";
      if (first.includes(normalizedPath) || first.includes(baseName)) {
        return chunk.trim();
      }
    }
  }

  return "";
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
