import type { ConversationItem } from "../../../../types";
import { computeDiff } from "../../../../utils/diff";
import {
  asRecord,
  extractToolName,
  getFileName,
  getFirstStringField,
  isBashTool,
  isEditTool,
  isReadTool,
  isSearchTool,
  isWebTool,
  parseToolArgs,
  resolveToolStatus,
  truncateText,
} from "../../../../utils/toolSemantics";

export type GenericToolStatus = "completed" | "processing" | "failed" | "pending";
export type GenericToolMarkerStatus = "completed" | "processing" | "failed";
export type GenericToolVariant = "generic" | "exit-plan" | "file-change" | "image-view";
export type ExitPlanExecutionMode = "default" | "full-access";

export type ExitPlanCardContent = {
  planMarkdown: string;
  planFilePath: string;
  rawText: string;
};

export type GenericToolDiffStats = {
  additions: number;
  deletions: number;
};

export type GenericToolDisplayChange = {
  path: string;
  normalizedKind: "added" | "modified" | "deleted" | "renamed";
  kindCode: "A" | "M" | "D" | "R";
  diffStats: GenericToolDiffStats;
  diffText?: string;
};

export type GenericToolPresentation = {
  toolName: string;
  status: GenericToolStatus;
  markerStatus: GenericToolMarkerStatus;
  summary: string;
  parsedArgs: Record<string, unknown> | null;
  isCollapsible: boolean;
  variant: GenericToolVariant;
  hasChanges: boolean;
  exitPlanContent: ExitPlanCardContent | null;
  shouldShowExitPlanRawOutput: boolean;
  displayChanges: GenericToolDisplayChange[];
  imageCandidate: string;
  imageFallbackLocalPath: string;
  filePath: string | null;
  fileName: string;
  isDirectory: boolean;
  isFile: boolean;
  otherParams: Array<[string, unknown]>;
  hydrationWeight: {
    outputChars: number;
    isHeavyOutput: boolean;
  };
};

const HEAVY_TOOL_OUTPUT_MIN_CHARS = 8_000;
const EXIT_PLAN_RAW_OUTPUT_NOISE = new Set([
  "{}", "[]", "Exit plan mode?", "Implement this plan.",
]);
const FILE_CHANGE_PATH_KEYS = [
  "file_path",
  "filePath",
  "filepath",
  "path",
  "target_file",
  "targetFile",
  "filename",
  "file",
];
const FILE_CHANGE_DIFF_KEYS = ["diff", "patch", "unified_diff", "unifiedDiff"];
const IMAGE_FILE_EXTENSION_REGEX =
  /\.(png|jpe?g|gif|webp|bmp|tiff?|svg|ico|avif)(?:[?#].*)?$/i;
const COLLAPSIBLE_TOOLS = new Set([
  "grep", "glob", "write", "save-file", "askuserquestion", "update_plan",
  "shell_command", "exitplanmode", "webfetch", "websearch", "skill", "useskill",
  "runskill", "run_skill", "execute_skill", "task", "todowrite",
]);
const SPECIAL_FILES = new Set([
  "makefile", "dockerfile", "jenkinsfile", "vagrantfile", "gemfile", "rakefile",
  "procfile", "guardfile", "license", "licence", "readme", "changelog",
  "gradlew", "cname", "authors", "contributors",
]);
const OMITTED_DETAIL_FIELDS = new Set([
  "file_path",
  "path",
  "target_file",
  "filename",
  "notebook_path",
  "pattern",
  "query",
  "search_term",
  "command",
  "cmd",
  "url",
  "description",
  "workdir",
]);

function isMcpTool(title: unknown): boolean {
  const name = typeof title === "string" ? title.toLowerCase() : "";
  return name.includes("mcp__") || name.includes("mcp_");
}

function normalizeToolIdentifier(toolName: string): string {
  return toolName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isCollapsibleTool(toolName: string, title: string): boolean {
  const lower = toolName.toLowerCase();
  const normalized = normalizeToolIdentifier(toolName);
  return COLLAPSIBLE_TOOLS.has(lower) || COLLAPSIBLE_TOOLS.has(normalized) || isMcpTool(title);
}

function isDirectoryPath(filePath: string, fileName: string): boolean {
  const cleanFileName = fileName.replace(/:\d+(-\d+)?$/, "");
  return (
    filePath.endsWith("/") ||
    filePath === "." ||
    filePath === ".." ||
    (!cleanFileName.includes(".") && !SPECIAL_FILES.has(cleanFileName.toLowerCase()))
  );
}

function matchesNormalizedToolIdentifier(toolName: string, expected: string): boolean {
  const normalizedToolName = normalizeToolIdentifier(toolName);
  const normalizedExpected = normalizeToolIdentifier(expected);
  return (
    normalizedToolName === normalizedExpected ||
    normalizedToolName.endsWith(normalizedExpected)
  );
}

function isExitPlanToolVariant(toolName: string, title: string): boolean {
  const normalizedTitle = normalizeToolIdentifier(title);
  return (
    matchesNormalizedToolIdentifier(toolName, "exitplanmode") ||
    matchesNormalizedToolIdentifier(title, "exitplanmode") ||
    normalizedTitle.includes("exitplanmode")
  );
}

function looksLikeExitPlanPayload(
  item: Extract<ConversationItem, { kind: "tool" }>,
  value?: string,
): boolean {
  if (item.toolType !== "toolCall" || !/claude/i.test(item.title) || !value?.trim()) {
    return false;
  }
  const normalized = value.trim();
  const hasPlanSection = /(?:^|\n)PLAN\s*(?=\n|$)/i.test(normalized);
  const hasAllowedPromptsSection = /(?:^|\n)ALLOWEDPROMPTS\s*(?=\n|$)/i.test(normalized);
  if (hasPlanSection && hasAllowedPromptsSection) {
    return true;
  }
  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return false;
    }
    const record = parsed as Record<string, unknown>;
    return (
      typeof record.plan === "string" &&
      record.plan.trim().length > 0 &&
      ((typeof record.planFilePath === "string" && record.planFilePath.trim().length > 0) ||
        (Array.isArray(record.allowedPrompts) && record.allowedPrompts.length > 0) ||
        (Array.isArray(record.ALLOWEDPROMPTS) && record.ALLOWEDPROMPTS.length > 0))
    );
  } catch {
    return false;
  }
}

function extractLabeledBlock(rawText: string, label: string, nextLabels: string[] = []): string {
  const normalized = rawText.replace(/\r\n/g, "\n");
  if (!normalized.trim()) {
    return "";
  }
  const startRegex = new RegExp(`(^|\\n)${label}\\s*(?=\\n|$)`, "i");
  const startMatch = startRegex.exec(normalized);
  if (!startMatch) {
    return "";
  }
  const contentStart = startMatch.index + startMatch[0].length;
  let contentEnd = normalized.length;
  for (const nextLabel of nextLabels) {
    const nextRegex = new RegExp(`\\n${nextLabel}\\s*(?=\\n|$)`, "i");
    const nextMatch = nextRegex.exec(normalized.slice(contentStart));
    if (nextMatch) {
      contentEnd = Math.min(contentEnd, contentStart + nextMatch.index);
    }
  }
  return normalized.slice(contentStart, contentEnd).replace(/^\n+|\n+$/g, "");
}

function extractExitPlanCardContent(
  item: Extract<ConversationItem, { kind: "tool" }>,
): ExitPlanCardContent | null {
  const rawSources = [item.detail, item.output ?? ""]
    .map((value) => value.trim())
    .filter(Boolean);
  const rawText = rawSources.join("\n\n").trim();
  if (!rawText) {
    return null;
  }

  let planMarkdown = "";
  let planFilePath = "";
  let normalizedRawText = rawText;
  for (const source of rawSources) {
    try {
      const parsed = JSON.parse(source) as unknown;
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        if (typeof record.plan === "string" && record.plan.trim()) {
          planMarkdown = record.plan.trim();
        }
        if (typeof record.planFilePath === "string" && record.planFilePath.trim()) {
          planFilePath = record.planFilePath.trim();
        }
        normalizedRawText = JSON.stringify(parsed, null, 2);
        break;
      }
    } catch {
      // Continue checking remaining sources.
    }
  }
  if (!planMarkdown && !planFilePath) {
    planMarkdown = extractLabeledBlock(rawText, "PLAN", ["PLANFILEPATH"]);
    planFilePath = extractLabeledBlock(rawText, "PLANFILEPATH");
  }
  return { planMarkdown, planFilePath, rawText: normalizedRawText };
}

function shouldRenderExitPlanRawOutput(content: ExitPlanCardContent): boolean {
  if (content.planMarkdown || content.planFilePath) {
    return false;
  }
  const normalizedRawText = content.rawText.trim();
  return Boolean(normalizedRawText) && !EXIT_PLAN_RAW_OUTPUT_NOISE.has(normalizedRawText);
}

function normalizeChangeKind(
  kind?: string,
): GenericToolDisplayChange["normalizedKind"] {
  const value = (kind ?? "").toLowerCase();
  if (value === "a" || value.includes("add") || value.includes("create") || value.includes("new")) {
    return "added";
  }
  if (value === "d" || value.includes("del") || value.includes("remove")) {
    return "deleted";
  }
  if (value === "r" || value.includes("rename") || value.includes("move")) {
    return "renamed";
  }
  return "modified";
}

function changeKindCode(
  kind: GenericToolDisplayChange["normalizedKind"],
): GenericToolDisplayChange["kindCode"] {
  if (kind === "added") return "A";
  if (kind === "deleted") return "D";
  if (kind === "renamed") return "R";
  return "M";
}

function collectDiffStats(diff?: string): GenericToolDiffStats {
  if (!diff) {
    return { additions: 0, deletions: 0 };
  }
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }
  return { additions, deletions };
}

function isStructuredDiffText(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  if (
    normalized.startsWith("diff --git ") ||
    normalized.startsWith("@@ ") ||
    normalized.startsWith("*** Begin Patch")
  ) {
    return true;
  }
  const lines = normalized.split("\n");
  return lines.some((line) => line.startsWith("--- ")) &&
    lines.some((line) => line.startsWith("+++ "));
}

function getFirstStringFieldCaseInsensitive(
  source: Record<string, unknown> | null,
  keys: string[],
): string {
  if (!source) {
    return "";
  }
  const lowered = new Map<string, unknown>();
  Object.entries(source).forEach(([key, value]) => lowered.set(key.toLowerCase(), value));
  for (const key of keys) {
    const value = lowered.get(key.toLowerCase());
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function countContentLines(value: string): number {
  return value ? value.split("\n").length : 0;
}

function computeLineDelta(oldString: string, newString: string): GenericToolDiffStats {
  const oldCount = countContentLines(oldString);
  const newCount = countContentLines(newString);
  if (oldCount === 0 && newCount === 0) return { additions: 0, deletions: 0 };
  if (oldCount === 0) return { additions: newCount, deletions: 0 };
  if (newCount === 0) return { additions: 0, deletions: oldCount };
  if (oldString !== newString && oldCount === newCount) {
    return { additions: 1, deletions: 1 };
  }
  const diff = newCount - oldCount;
  return diff >= 0
    ? { additions: diff || 1, deletions: 0 }
    : { additions: 0, deletions: -diff };
}

function collectDiffStatsFromArgs(args: Record<string, unknown>): GenericToolDiffStats {
  const oldString = getFirstStringFieldCaseInsensitive(args, ["old_string", "oldString"]);
  const newString = getFirstStringFieldCaseInsensitive(args, ["new_string", "newString"]);
  if (oldString || newString) {
    return computeLineDelta(oldString, newString);
  }
  const content = getFirstStringFieldCaseInsensitive(args, ["content", "new_content", "newContent"]);
  if (content) {
    return { additions: content.split("\n").length, deletions: 0 };
  }
  return collectDiffStats(getFirstStringFieldCaseInsensitive(args, FILE_CHANGE_DIFF_KEYS));
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").trim();
}

function pathHintMatches(pathHint: string, targetPath: string): boolean {
  const normalizedHint = normalizePath(pathHint);
  const normalizedTarget = normalizePath(targetPath);
  if (!normalizedHint || !normalizedTarget) {
    return true;
  }
  return normalizedHint === normalizedTarget ||
    normalizedHint.endsWith(`/${normalizedTarget}`) ||
    normalizedTarget.endsWith(`/${normalizedHint}`);
}

function buildSyntheticUnifiedDiffFromArgs(args: Record<string, unknown>): string | undefined {
  const oldString = getFirstStringFieldCaseInsensitive(args, ["old_string", "oldString"]);
  const newString = getFirstStringFieldCaseInsensitive(args, ["new_string", "newString"]);
  const content = getFirstStringFieldCaseInsensitive(args, ["content", "new_content", "newContent"]);
  const newContent = newString || content;
  if ((!oldString && !newContent) || oldString === newContent) {
    return undefined;
  }
  const diff = computeDiff(oldString, newContent);
  if (diff.lines.length === 0) {
    return undefined;
  }
  const header = `@@ -1,${oldString ? oldString.split("\n").length : 0} +1,${newContent ? newContent.split("\n").length : 0} @@`;
  const body = diff.lines.map((line) => {
    if (line.type === "added") return `+${line.content}`;
    if (line.type === "deleted") return `-${line.content}`;
    return ` ${line.content}`;
  }).join("\n");
  return body ? `${header}\n${body}` : header;
}

function resolveChangeDiffText(
  change: { path: string; diff?: string },
  allChanges: Array<{ path: string; kind?: string; diff?: string }>,
  candidateArgs: Record<string, unknown>[],
  outputDiffText: string,
): string | undefined {
  const direct = (change.diff ?? "").trim();
  if (direct) {
    return direct;
  }
  if (allChanges.length === 1) {
    for (const args of candidateArgs) {
      const pathHint = getFirstStringFieldCaseInsensitive(args, FILE_CHANGE_PATH_KEYS);
      if (pathHint && !pathHintMatches(pathHint, change.path)) {
        continue;
      }
      const argsDiff = getFirstStringFieldCaseInsensitive(args, FILE_CHANGE_DIFF_KEYS);
      if (argsDiff) {
        return argsDiff;
      }
      const synthetic = buildSyntheticUnifiedDiffFromArgs(args);
      if (synthetic) {
        return synthetic;
      }
    }
    return outputDiffText.trim() || undefined;
  }
  return undefined;
}

function resolveChangeDiffStats(
  change: { path: string; diff?: string },
  allChanges: Array<{ path: string; kind?: string; diff?: string }>,
  candidateArgs: Record<string, unknown>[],
  outputStats: GenericToolDiffStats,
  resolvedDiffText?: string,
): GenericToolDiffStats {
  if (resolvedDiffText) {
    return collectDiffStats(resolvedDiffText);
  }
  const direct = collectDiffStats(change.diff);
  if (direct.additions > 0 || direct.deletions > 0) {
    return direct;
  }
  if (allChanges.length === 1) {
    for (const args of candidateArgs) {
      const pathHint = getFirstStringFieldCaseInsensitive(args, FILE_CHANGE_PATH_KEYS);
      if (pathHint && !pathHintMatches(pathHint, change.path)) {
        continue;
      }
      const fromArgs = collectDiffStatsFromArgs(args);
      if (fromArgs.additions > 0 || fromArgs.deletions > 0) {
        return fromArgs;
      }
    }
    if (outputStats.additions > 0 || outputStats.deletions > 0) {
      return outputStats;
    }
  }
  return direct;
}

function toDisplayChanges(
  changes: Array<{ path: string; kind?: string; diff?: string }>,
  candidateArgs: Record<string, unknown>[],
  outputStats: GenericToolDiffStats,
  outputDiffText: string,
): GenericToolDisplayChange[] {
  return changes.map((change) => {
    const normalizedKind = normalizeChangeKind(change.kind);
    const diffText = resolveChangeDiffText(change, changes, candidateArgs, outputDiffText);
    return {
      path: change.path,
      normalizedKind,
      kindCode: changeKindCode(normalizedKind),
      diffStats: resolveChangeDiffStats(
        change,
        changes,
        candidateArgs,
        outputStats,
        diffText,
      ),
      diffText,
    };
  });
}

function decodeToolPath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toImageViewLocalPath(value: string): string {
  const decoded = decodeToolPath(value.trim());
  if (!decoded) {
    return "";
  }
  if (
    decoded.startsWith("http://") ||
    decoded.startsWith("https://") ||
    decoded.startsWith("data:") ||
    decoded.startsWith("asset://")
  ) {
    return decoded;
  }
  if (decoded.startsWith("file://")) {
    const withoutScheme = decoded.slice("file://".length);
    const withoutHost = withoutScheme.startsWith("localhost/")
      ? withoutScheme.slice("localhost/".length)
      : withoutScheme;
    if (/^\/[A-Za-z]:[\\/]/.test(withoutHost)) return withoutHost.slice(1);
    if (/^[A-Za-z]:[\\/]/.test(withoutHost)) return withoutHost;
    if (withoutHost.startsWith("/")) return withoutHost;
    return `/${withoutHost}`;
  }
  if (
    decoded.startsWith("/") ||
    decoded.startsWith("./") ||
    decoded.startsWith("../") ||
    decoded.startsWith("~/") ||
    /^[A-Za-z]:[\\/]/.test(decoded) ||
    /^\\\\[^\\]/.test(decoded)
  ) {
    return decoded;
  }
  return "";
}

function collectImageSourceCandidatesFromUnknown(value: unknown, collector: string[]): void {
  if (typeof value === "string") {
    if (value.trim()) collector.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectImageSourceCandidatesFromUnknown(entry, collector));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["image_url", "imageUrl", "url", "src", "path", "data"]) {
    if (key in record) collectImageSourceCandidatesFromUnknown(record[key], collector);
  }
  Object.values(record).forEach((entry) =>
    collectImageSourceCandidatesFromUnknown(entry, collector),
  );
}

function extractImageSourcesFromPayloadText(payload: string): string[] {
  const candidates: string[] = [];
  const trimmed = payload.trim();
  if (!trimmed) {
    return candidates;
  }
  const compact = trimmed.replace(/\s+/g, "");
  const dataUrlMatch = trimmed.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/);
  if (dataUrlMatch?.[0]) candidates.push(dataUrlMatch[0]);
  if (/^[A-Za-z0-9+/=]{64,}$/.test(compact) && compact.length % 4 === 0) {
    candidates.push(`data:image/png;base64,${compact}`);
  }
  const patterns = [
    /https?:\/\/[^\s"'()]+?\.(?:png|jpe?g|gif|webp|bmp|tiff?|svg|ico|avif)(?:[?#][^\s"'()]*)?/gi,
    /file:\/\/[^\s"'()]+?\.(?:png|jpe?g|gif|webp|bmp|tiff?|svg|ico|avif)(?:[?#][^\s"'()]*)?/gi,
    /\/(?:Users|home|tmp|var|opt|private|mnt|Volumes)\/[^\s"'()]+?\.(?:png|jpe?g|gif|webp|bmp|tiff?|svg|ico|avif)(?:[?#][^\s"'()]*)?/g,
    /[A-Za-z]:[\\/][^\s"'()]+?\.(?:png|jpe?g|gif|webp|bmp|tiff?|svg|ico|avif)(?:[?#][^\s"'()]*)?/g,
  ];
  for (const pattern of patterns) {
    const matches = trimmed.match(pattern);
    if (matches?.length) candidates.push(...matches);
  }
  try {
    collectImageSourceCandidatesFromUnknown(JSON.parse(trimmed) as unknown, candidates);
  } catch {
    // Ignore non-JSON payloads.
  }
  return candidates;
}

function normalizeImageCandidate(value: string): string {
  const normalized = toImageViewLocalPath(value);
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith("data:image/")) {
    return normalized;
  }
  return IMAGE_FILE_EXTENSION_REGEX.test(normalized) ? normalized : "";
}

function resolveImageCandidateFromTool(
  detail: string,
  output?: string,
  title?: string,
): string {
  const seeds = [detail, output ?? "", title ?? ""].filter((entry) => entry.trim());
  for (const seed of seeds) {
    const direct = normalizeImageCandidate(seed);
    if (direct) {
      return direct;
    }
    for (const candidate of extractImageSourcesFromPayloadText(seed)) {
      const normalized = normalizeImageCandidate(candidate);
      if (normalized) {
        return normalized;
      }
    }
  }
  return "";
}

function isImageViewLikeTool(
  item: Extract<ConversationItem, { kind: "tool" }>,
  toolName: string,
): boolean {
  if (item.toolType === "imageView") {
    return true;
  }
  const normalizedToolName = toolName.trim().toLowerCase();
  const normalizedTitle = item.title.trim().toLowerCase();
  return (
    /(?:^|\b)view[-_\s]?image(?:\b|$)/.test(normalizedToolName) ||
    /(?:^|\b)view[-_\s]?image(?:\b|$)/.test(normalizedTitle) ||
    /(?:^|\b)imageview(?:\b|$)/.test(normalizedToolName) ||
    /(?:^|\b)imageview(?:\b|$)/.test(normalizedTitle)
  );
}

function extractSummary(
  item: Extract<ConversationItem, { kind: "tool" }>,
  toolName: string,
  parsedArgs: Record<string, unknown> | null,
): string {
  const lower = toolName.toLowerCase();

  if (isReadTool(lower) || isEditTool(lower)) {
    const filePath = getFirstStringField(parsedArgs, [
      "file_path",
      "path",
      "target_file",
      "filename",
    ]);
    return filePath ? getFileName(filePath) : "";
  }

  if (isSearchTool(lower)) {
    const query = getFirstStringField(parsedArgs, ["pattern", "query", "search_term", "text"]);
    return query ? truncateText(query, 50) : "";
  }

  if (isBashTool(lower)) {
    const command = getFirstStringField(parsedArgs, ["command", "cmd"]);
    return command ? truncateText(command, 60) : "";
  }

  if (isWebTool(lower)) {
    const url = getFirstStringField(parsedArgs, ["url", "query"]);
    return url ? truncateText(url, 50) : "";
  }

  if (isMcpTool(item.title)) {
    const query = getFirstStringField(parsedArgs, ["query", "pattern", "path", "file_path"]);
    return query ? truncateText(query, 50) : "";
  }

  if (parsedArgs) {
    for (const key of ["query", "pattern", "path", "file_path", "command", "text"]) {
      const value = parsedArgs[key];
      if (typeof value === "string" && value.trim()) {
        return truncateText(value.trim(), 50);
      }
    }
  }

  return "";
}

export function buildGenericToolPresentation(
  item: Extract<ConversationItem, { kind: "tool" }>,
): GenericToolPresentation {
  const toolName = extractToolName(item.title);
  const hasChanges = (item.changes ?? []).length > 0;
  const resolvedStatus = resolveToolStatus(item.status, Boolean(item.output) || hasChanges);
  const status = resolvedStatus === "processing" ? "pending" : resolvedStatus;
  const markerStatus =
    status === "failed" ? "failed" : status === "completed" ? "completed" : "processing";
  const parsedArgs = parseToolArgs(item.detail);
  const outputChars = item.output?.length ?? 0;
  const isExitPlanTool =
    isExitPlanToolVariant(toolName, item.title) ||
    looksLikeExitPlanPayload(item, item.detail) ||
    looksLikeExitPlanPayload(item, item.output);
  const exitPlanContent = isExitPlanTool ? extractExitPlanCardContent(item) : null;
  const isFileChangeTool =
    item.toolType === "fileChange" ||
    toolName.toLowerCase().includes("file change") ||
    item.title.toLowerCase().includes("file change");
  const fileChangeCandidateArgs = [
    parsedArgs,
    asRecord(parsedArgs?.input),
    asRecord(parsedArgs?.arguments),
  ].filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const outputDiffText = isStructuredDiffText(item.output ?? "") ? item.output ?? "" : "";
  const outputStats = collectDiffStats(outputDiffText || undefined);
  const displayChanges = toDisplayChanges(
    item.changes ?? [],
    fileChangeCandidateArgs,
    outputStats,
    outputDiffText,
  );
  const isImageViewTool = isImageViewLikeTool(item, toolName);
  const imageCandidate = isImageViewTool
    ? resolveImageCandidateFromTool(item.detail, item.output, item.title)
    : "";
  const imageFallbackLocalPath =
    imageCandidate &&
    !imageCandidate.startsWith("http://") &&
    !imageCandidate.startsWith("https://") &&
    !imageCandidate.startsWith("data:") &&
    !imageCandidate.startsWith("asset://")
      ? imageCandidate
      : "";
  const rawFilePath = getFirstStringField(parsedArgs, [
    "file_path",
    "path",
    "target_file",
    "filename",
    "notebook_path",
  ]);
  const filePath = rawFilePath || null;
  const fileName = filePath ? getFileName(filePath) : "";
  const isDirectory = filePath ? isDirectoryPath(filePath, fileName) : false;
  const otherParams = parsedArgs
    ? Object.entries(parsedArgs).filter(
        ([key, value]) =>
          !OMITTED_DETAIL_FIELDS.has(key) &&
          value !== undefined &&
          value !== null &&
          value !== "",
      )
    : [];

  return {
    toolName,
    status,
    markerStatus,
    summary: extractSummary(item, toolName, parsedArgs),
    parsedArgs,
    isCollapsible: isCollapsibleTool(toolName, item.title),
    variant: isExitPlanTool
      ? "exit-plan"
      : isFileChangeTool
        ? "file-change"
        : isImageViewTool
          ? "image-view"
          : "generic",
    hasChanges,
    exitPlanContent,
    shouldShowExitPlanRawOutput: exitPlanContent
      ? shouldRenderExitPlanRawOutput(exitPlanContent)
      : false,
    displayChanges,
    imageCandidate,
    imageFallbackLocalPath,
    filePath,
    fileName,
    isDirectory,
    isFile: Boolean(filePath && !isDirectory),
    otherParams,
    hydrationWeight: {
      outputChars,
      isHeavyOutput: outputChars >= HEAVY_TOOL_OUTPUT_MIN_CHARS,
    },
  };
}
