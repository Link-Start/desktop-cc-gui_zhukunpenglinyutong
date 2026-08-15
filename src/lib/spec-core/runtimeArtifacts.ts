import {
  writeExternalSpecFile,
  writeWorkspaceFile,
  readExternalSpecFile,
  readWorkspaceFile,
} from "../../services/tauri";
import type {
  SpecArtifactEntry,
  SpecArtifactSource,
  SpecBootstrapProjectType,
  SpecChangeSummary,
  SpecProjectInfoInput,
} from "./types";
import {
  DEFAULT_SPEC_ROOT_RELATIVE,
  normalizeCustomSpecRoot,
  toNonEmpty,
} from "./runtimeShared";
import { readOptionalWorkspaceFile } from "./runtimeIo";
import {
  buildProjectInfoMarkdown,
  normalizeSectionValue,
  parseProjectInfoHistory,
  parseSection,
  parseTaskProgress,
} from "./runtimeParse";

export async function loadSpecArtifacts(input: {
  workspaceId: string;
  change: SpecChangeSummary;
  customSpecRoot?: string | null;
}): Promise<Record<SpecArtifactEntry["type"], SpecArtifactEntry>> {
  const [proposal, design, tasks, verification, specSources] = await Promise.all([
    readOptionalWorkspaceFile(
      input.workspaceId,
      input.change.artifacts.proposalPath,
      input.customSpecRoot,
    ),
    readOptionalWorkspaceFile(
      input.workspaceId,
      input.change.artifacts.designPath,
      input.customSpecRoot,
    ),
    readOptionalWorkspaceFile(
      input.workspaceId,
      input.change.artifacts.tasksPath,
      input.customSpecRoot,
    ),
    readOptionalWorkspaceFile(
      input.workspaceId,
      input.change.artifacts.verificationPath,
      input.customSpecRoot,
    ),
    Promise.all(
      input.change.artifacts.specPaths.map(async (path): Promise<SpecArtifactSource> => {
        const response = await readOptionalWorkspaceFile(input.workspaceId, path, input.customSpecRoot);
        return {
          path,
          content: response.content,
          truncated: response.truncated,
        };
      }),
    ),
  ]);

  const specsTruncated = specSources.some((entry) => entry.truncated);
  const firstSpec = specSources[0] ?? null;
  const { checklist: taskChecklist, progress: taskProgress } = parseTaskProgress(tasks.content);

  return {
    proposal: {
      type: "proposal",
      path: input.change.artifacts.proposalPath,
      exists: proposal.exists,
      content: proposal.content,
      truncated: proposal.truncated,
    },
    design: {
      type: "design",
      path: input.change.artifacts.designPath,
      exists: design.exists,
      content: design.content,
      truncated: design.truncated,
    },
    tasks: {
      type: "tasks",
      path: input.change.artifacts.tasksPath,
      exists: tasks.exists,
      content: tasks.content,
      truncated: tasks.truncated,
      taskChecklist,
      taskProgress,
    },
    verification: {
      type: "verification",
      path: input.change.artifacts.verificationPath,
      exists: verification.exists,
      content: verification.content,
      truncated: verification.truncated,
    },
    specs: {
      type: "specs",
      path: firstSpec?.path ?? null,
      exists: specSources.length > 0,
      content: firstSpec?.content ?? "",
      truncated: specsTruncated,
      sources: specSources,
    },
  };
}

export async function updateSpecTaskChecklist(input: {
  workspaceId: string;
  change: SpecChangeSummary;
  taskIndex: number;
  checked: boolean;
  customSpecRoot?: string | null;
}) {
  const tasksPath = input.change.artifacts.tasksPath;
  if (!tasksPath) {
    throw new Error("tasks.md is required");
  }
  const normalizedSpecRoot = normalizeCustomSpecRoot(input.customSpecRoot);
  const response = await readOptionalWorkspaceFile(input.workspaceId, tasksPath, normalizedSpecRoot);
  if (!response.exists) {
    throw new Error("Unable to read tasks.md");
  }

  const newline = response.content.includes("\r\n") ? "\r\n" : "\n";
  const lines = response.content.split(/\r?\n/);
  let checklistIndex = 0;
  let found = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const match = line.match(/^(\s*[-*+]\s*\[)([xX ])(\].*)$/);
    if (!match) {
      continue;
    }
    if (checklistIndex === input.taskIndex) {
      const currentChecked = (match[2] ?? " ").toLowerCase() === "x";
      if (currentChecked !== input.checked) {
        lines[lineIndex] = `${match[1]}${input.checked ? "x" : " "}${match[3]}`;
      }
      found = true;
      break;
    }
    checklistIndex += 1;
  }

  if (!found) {
    throw new Error("Task checkbox not found");
  }

  const nextContent = lines.join(newline);
  if (nextContent !== response.content) {
    if (normalizedSpecRoot) {
      await writeExternalSpecFile(input.workspaceId, normalizedSpecRoot, tasksPath, nextContent);
    } else {
      await writeWorkspaceFile(input.workspaceId, tasksPath, nextContent);
    }
  }

  const { checklist, progress } = parseTaskProgress(nextContent);
  return {
    path: tasksPath,
    content: nextContent,
    taskChecklist: checklist,
    taskProgress: progress,
  };
}

export async function saveSpecProjectInfo(input: {
  workspaceId: string;
  projectInfo: SpecProjectInfoInput;
  customSpecRoot?: string | null;
}) {
  const path = `${DEFAULT_SPEC_ROOT_RELATIVE}/project.md`;
  const normalizedSpecRoot = normalizeCustomSpecRoot(input.customSpecRoot);
  const previous = await readOptionalWorkspaceFile(input.workspaceId, path, normalizedSpecRoot);
  const previousHistory = previous.exists ? parseProjectInfoHistory(previous.content) : [];
  const summary = toNonEmpty(input.projectInfo.summary ?? "Project context updated");
  const historyEntry = `- ${new Date().toISOString()} ${summary}`;
  const nextHistory = [historyEntry, ...previousHistory].slice(0, 30);
  const markdown = buildProjectInfoMarkdown(input.projectInfo, nextHistory);
  if (normalizedSpecRoot) {
    await writeExternalSpecFile(input.workspaceId, normalizedSpecRoot, path, markdown);
    return { path: `${normalizedSpecRoot}/project.md`, historyEntry };
  }
  await writeWorkspaceFile(input.workspaceId, path, markdown);
  return { path, historyEntry };
}

export async function loadSpecProjectInfo(input: {
  workspaceId: string;
  customSpecRoot?: string | null;
}): Promise<SpecProjectInfoInput | null> {
  const path = `${DEFAULT_SPEC_ROOT_RELATIVE}/project.md`;
  try {
    const normalizedSpecRoot = normalizeCustomSpecRoot(input.customSpecRoot);
    const content = normalizedSpecRoot
      ? (await readExternalSpecFile(input.workspaceId, normalizedSpecRoot, path)).content ?? ""
      : (await readWorkspaceFile(input.workspaceId, path)).content ?? "";
    if (!content.trim()) {
      return null;
    }

    const typeMatch = content.match(/- Type:\s*(.+)$/m);
    const projectType: SpecBootstrapProjectType =
      typeMatch?.[1]?.toLowerCase().includes("new") ? "new" : "legacy";

    const rawCommands = parseSection(content, "Key Commands")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^-+\s*/, ""))
      .filter((line) => line !== "N/A");

    return {
      projectType,
      domain: normalizeSectionValue(parseSection(content, "Domain")),
      architecture: normalizeSectionValue(parseSection(content, "Architecture")),
      constraints: normalizeSectionValue(parseSection(content, "Constraints")),
      keyCommands: rawCommands.join("\n"),
      owners: normalizeSectionValue(parseSection(content, "Owners")),
      summary: "",
    };
  } catch {
    return null;
  }
}
