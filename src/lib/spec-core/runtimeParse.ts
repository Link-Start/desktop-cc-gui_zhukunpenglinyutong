import type { SpecProjectInfoInput, SpecTaskChecklistItem, SpecTaskPriority } from "./types";
import { toNonEmpty } from "./runtimeShared";

export function parseProjectInfoHistory(content: string) {
  const marker = "## Update History";
  const markerIndex = content.indexOf(marker);
  if (markerIndex < 0) {
    return [] as string[];
  }
  return content
    .slice(markerIndex + marker.length)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));
}

export function parseSection(content: string, title: string) {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`##\\s+${escapedTitle}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i");
  const matched = content.match(pattern);
  if (!matched?.[1]) {
    return "";
  }
  return matched[1].trim();
}

export function normalizeSectionValue(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized === "N/A") {
    return "";
  }
  return normalized;
}

export function buildProjectInfoMarkdown(input: SpecProjectInfoInput, history: string[]) {
  const now = new Date().toISOString();
  const keyCommandsLines = toNonEmpty(input.keyCommands)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`);
  const renderedCommands = keyCommandsLines.length > 0 ? keyCommandsLines.join("\n") : "- N/A";
  const renderedHistory = history.length > 0 ? history.join("\n") : `- ${now} Project context initialized`;

  return [
    "# Project Context",
    "",
    `- Type: ${input.projectType === "legacy" ? "Legacy Project" : "New Project"}`,
    `- Updated At: ${now}`,
    "",
    "## Domain",
    toNonEmpty(input.domain),
    "",
    "## Architecture",
    toNonEmpty(input.architecture),
    "",
    "## Constraints",
    toNonEmpty(input.constraints),
    "",
    "## Key Commands",
    renderedCommands,
    "",
    "## Owners",
    toNonEmpty(input.owners),
    "",
    "## Update History",
    renderedHistory,
    "",
  ].join("\n");
}

export function parseDateHintFromChangeId(changeId: string) {
  const candidates = changeId.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  let latest = 0;
  for (const candidate of candidates) {
    const parsed = Date.parse(candidate);
    if (Number.isFinite(parsed) && parsed > latest) {
      latest = parsed;
    }
  }
  return latest;
}

export function detectTaskPriority(text: string): SpecTaskPriority {
  const matched = text.match(/\[(P[0-2])\]/i);
  if (!matched?.[1]) {
    return null;
  }
  return matched[1].toLowerCase() as SpecTaskPriority;
}

export function parseTaskChecklist(tasksContent: string): SpecTaskChecklistItem[] {
  const lines = tasksContent.split(/\r?\n/);
  const checklist: SpecTaskChecklistItem[] = [];
  let index = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const match = line.match(/^(\s*)[-*+]\s*\[([xX ])\]\s*(.*)$/);
    if (!match) {
      continue;
    }
    const indent = (match[1] ?? "").replace(/\t/g, "  ").length;
    const checked = (match[2] ?? " ").toLowerCase() === "x";
    const text = (match[3] ?? "").trim();

    checklist.push({
      index,
      lineNumber: lineIndex + 1,
      indent,
      checked,
      text,
      priority: detectTaskPriority(text),
    });
    index += 1;
  }

  return checklist;
}

export function summarizeTaskProgress(checklist: SpecTaskChecklistItem[]) {
  const requiredTasks = checklist.filter((item) => item.priority !== "p2");
  const checked = checklist.filter((item) => item.checked).length;
  const requiredChecked = requiredTasks.filter((item) => item.checked).length;

  return {
    total: checklist.length,
    checked,
    requiredTotal: requiredTasks.length,
    requiredChecked,
  };
}

export function parseTaskProgress(tasksContent: string) {
  const checklist = parseTaskChecklist(tasksContent);
  return {
    checklist,
    progress: summarizeTaskProgress(checklist),
  };
}

export type SpecDeltaRequirementOperation = "ADDED" | "MODIFIED" | "REMOVED" | "RENAMED";

export const REQUIRE_EXISTING_TARGET_OPERATIONS = new Set<SpecDeltaRequirementOperation>([
  "MODIFIED",
  "REMOVED",
  "RENAMED",
]);

export const DELTA_OPERATION_SEQUENCE: SpecDeltaRequirementOperation[] = [
  "ADDED",
  "MODIFIED",
  "REMOVED",
  "RENAMED",
];

export function parseDeltaRequirementOperations(content: string): Set<SpecDeltaRequirementOperation> {
  const operations = new Set<SpecDeltaRequirementOperation>();
  const matcher = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\b/gim;
  let matched = matcher.exec(content);
  while (matched) {
    const operation = matched[1]?.toUpperCase() as SpecDeltaRequirementOperation | undefined;
    if (operation) {
      operations.add(operation);
    }
    matched = matcher.exec(content);
  }
  return operations;
}

export function normalizeRequirementTitle(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function parseRequirementTitles(content: string) {
  const titles = new Set<string>();
  const matcher = /^###\s+Requirement:\s*(.+?)\s*$/gim;
  let matched = matcher.exec(content);
  while (matched) {
    const normalized = normalizeRequirementTitle(matched[1] ?? "");
    if (normalized) {
      titles.add(normalized);
    }
    matched = matcher.exec(content);
  }
  return titles;
}

export function parseDeltaRequirementTitlesByOperation(content: string) {
  const grouped = new Map<SpecDeltaRequirementOperation, string[]>();
  let activeOperation: SpecDeltaRequirementOperation | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    const sectionMatched = line.match(/^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i);
    if (sectionMatched?.[1]) {
      const normalized = sectionMatched[1].toUpperCase() as SpecDeltaRequirementOperation;
      activeOperation = DELTA_OPERATION_SEQUENCE.includes(normalized) ? normalized : null;
      continue;
    }

    if (!activeOperation) {
      continue;
    }

    const requirementMatched = line.match(/^###\s+Requirement:\s*(.+?)\s*$/i);
    if (!requirementMatched?.[1]) {
      continue;
    }
    const title = normalizeRequirementTitle(requirementMatched[1]);
    if (!title) {
      continue;
    }

    const current = grouped.get(activeOperation) ?? [];
    current.push(title);
    grouped.set(activeOperation, current);
  }

  return grouped;
}

export function toTargetSpecPath(base: string, deltaSpecPath: string) {
  const prefix = `${base}/specs/`;
  if (!deltaSpecPath.startsWith(prefix)) {
    return null;
  }
  const suffix = deltaSpecPath.slice(prefix.length).trim();
  if (!suffix) {
    return null;
  }
  return `openspec/specs/${suffix}`;
}

export function derivePreflightHints(blockers: string[]) {
  const hints = new Set<string>();
  for (const blocker of blockers) {
    if (/delta\s+[A-Z/]+\s+requires existing/i.test(blocker)) {
      hints.add("Create the missing target spec under openspec/specs or switch delta operation to ADDED.");
      continue;
    }
    if (/delta\s+[A-Z]+\s+requirement missing in/i.test(blocker)) {
      hints.add("Align MODIFIED/REMOVED/RENAMED requirement title with target spec header exactly.");
      hints.add("If target requirement does not exist, change operation to ADDED.");
    }
  }
  return [...hints];
}

export function deriveAffectedSpecs(blockers: string[]) {
  const specs = new Set<string>();
  for (const blocker of blockers) {
    const matched = blocker.match(/(openspec[\\/]+specs[\\/]+.+?\.md)\b/i);
    if (matched?.[1]) {
      specs.add(matched[1].replace(/\\/g, "/"));
    }
  }
  return [...specs].sort((a, b) => a.localeCompare(b));
}
