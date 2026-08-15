import { runSpecCommand } from "../../services/tauri";
import type {
  SpecArtifactEntry,
  SpecBootstrapProjectType,
  SpecChangeSummary,
  SpecEnvironmentHealth,
  SpecGateState,
  SpecHubAction,
  SpecHubActionKey,
  SpecProjectInfoInput,
  SpecProvider,
  SpecSupportLevel,
  SpecTimelineEvent,
  SpecValidationIssue,
  SpecVerifyState,
  SpecWorkspaceSnapshot,
} from "./types";
import { normalizeCustomSpecRoot, shellQuote } from "./runtimeShared";
import { saveSpecProjectInfo } from "./runtimeArtifacts";

export function buildBootstrapCommand(projectType: SpecBootstrapProjectType) {
  const base = "openspec init --tools none";
  return projectType === "legacy" ? `${base} --force` : base;
}

export function buildBootstrapCommandArgs(projectType: SpecBootstrapProjectType) {
  const args = ["openspec", "init", "--tools", "none"];
  if (projectType === "legacy") {
    args.push("--force");
  }
  return args;
}

export async function initializeOpenSpecWorkspace(input: {
  workspaceId: string;
  projectInfo: SpecProjectInfoInput;
  customSpecRoot?: string | null;
}): Promise<SpecTimelineEvent> {
  const command = buildBootstrapCommand(input.projectInfo.projectType);
  const normalizedSpecRoot = normalizeCustomSpecRoot(input.customSpecRoot);
  const commandArgs = buildBootstrapCommandArgs(input.projectInfo.projectType);
  const result = await runSpecCommand(
    input.workspaceId,
    commandArgs,
    {
      customSpecRoot: normalizedSpecRoot,
      timeoutMs: 180_000,
    },
  );

  const outputParts = [result.stdout, result.stderr].filter(Boolean);
  if (!result.success) {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
      kind: "action",
      action: "bootstrap",
      command,
      success: false,
      output: outputParts.join("\n").trim(),
      validationIssues: [],
      gitRefs: [],
    };
  }

  try {
    const saved = await saveSpecProjectInfo({
      workspaceId: input.workspaceId,
      projectInfo: {
        ...input.projectInfo,
        summary: input.projectInfo.summary?.trim() || "Bootstrap initialized",
      },
      customSpecRoot: normalizedSpecRoot,
    });
    outputParts.push(`Project context saved: ${saved.path}`);
  } catch (error) {
    outputParts.push(
      `Project context save failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
      kind: "action",
      action: "bootstrap",
      command,
      success: false,
      output: outputParts.join("\n").trim(),
      validationIssues: [],
      gitRefs: [],
    };
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    kind: "action",
    action: "bootstrap",
    command,
    success: true,
    output: outputParts.join("\n").trim(),
    validationIssues: [],
    gitRefs: [],
  };
}

export function buildActionCommand(changeId: string, action: SpecHubActionKey, provider: SpecProvider) {
  const quotedId = shellQuote(changeId);
  if (provider === "speckit") {
    switch (action) {
      case "continue":
        return "specify propose --help";
      case "apply":
        return "specify tasks --help";
      case "verify":
        return "specify check --help";
      case "archive":
        return "specify archive --help";
      case "bootstrap":
        return "specify --help";
      default:
        return "specify --help";
    }
  }

  switch (action) {
    case "continue":
      return `openspec instructions specs --change ${quotedId}`;
    case "apply":
      return `openspec instructions tasks --change ${quotedId}`;
    case "verify":
      return `openspec validate ${quotedId} --strict`;
    case "archive":
      return `openspec archive ${quotedId} --yes`;
    case "bootstrap":
      return "openspec init --tools none";
    default:
      return "";
  }
}

export function buildActionCommandArgs(changeId: string, action: SpecHubActionKey, provider: SpecProvider) {
  if (provider === "speckit") {
    switch (action) {
      case "continue":
        return ["specify", "propose", "--help"];
      case "apply":
        return ["specify", "tasks", "--help"];
      case "verify":
        return ["specify", "check", "--help"];
      case "archive":
        return ["specify", "archive", "--help"];
      case "bootstrap":
        return ["specify", "--help"];
      default:
        return ["specify", "--help"];
    }
  }

  switch (action) {
    case "continue":
      return ["openspec", "instructions", "specs", "--change", changeId];
    case "apply":
      return ["openspec", "instructions", "tasks", "--change", changeId];
    case "verify":
      return ["openspec", "validate", changeId, "--strict"];
    case "archive":
      return ["openspec", "archive", changeId, "--yes"];
    case "bootstrap":
      return ["openspec", "init", "--tools", "none"];
    default:
      return [];
  }
}

export function buildSpecActions(input: {
  change: SpecChangeSummary;
  supportLevel: SpecSupportLevel;
  provider: SpecProvider;
  environment: SpecEnvironmentHealth;
  verifyState?: SpecVerifyState;
  taskProgress?: SpecArtifactEntry["taskProgress"];
}): SpecHubAction[] {
  const isArchived = input.change.status === "archived";
  const supported = input.supportLevel === "full" && input.provider === "openspec";
  const sharedBlockers: string[] = [];
  const verifyState = input.verifyState ?? { ran: false, success: false };

  if (input.environment.status === "blocked") {
    sharedBlockers.push(...input.environment.blockers);
  }
  if (!supported) {
    sharedBlockers.push("This provider is running in minimal compatibility mode.");
  }
  if (isArchived) {
    sharedBlockers.push("Change is already archived");
  }

  const CONTINUE_IGNORE_BLOCKERS = new Set([
    "Missing design.md",
    "Missing tasks.md",
    "Missing specs delta",
    "Unable to read tasks.md",
  ]);
  const APPLY_IGNORE_BLOCKERS = new Set([
    "Missing design.md",
    "Missing tasks.md",
    "Unable to read tasks.md",
  ]);
  const continueChangeBlockers = input.change.blockers.filter(
    (blocker) => !CONTINUE_IGNORE_BLOCKERS.has(blocker),
  );
  const applyChangeBlockers = input.change.blockers.filter(
    (blocker) => !APPLY_IGNORE_BLOCKERS.has(blocker),
  );
  const applyGateBlockers: string[] = [];
  if (input.change.artifacts.specPaths.length === 0) {
    applyGateBlockers.push("Run continue first to generate specs delta");
  }

  const incompleteForVerify = !(
    input.change.artifacts.proposalPath &&
    input.change.artifacts.designPath &&
    input.change.artifacts.tasksPath &&
    input.change.artifacts.specPaths.length > 0
  );
  const hasRequiredTasks = (input.taskProgress?.requiredTotal ?? 0) > 0;
  const requiredTasksDone =
    !hasRequiredTasks ||
    (input.taskProgress?.requiredChecked ?? 0) >= (input.taskProgress?.requiredTotal ?? 0);
  const archiveGateBlockers: string[] = [];
  if (!isArchived) {
    if (!verifyState.ran || !verifyState.success) {
      archiveGateBlockers.push("Strict verify must pass before archive");
    }
    if (!requiredTasksDone) {
      archiveGateBlockers.push("Required tasks are incomplete");
    }
  }

  const actionMeta: Array<{ key: SpecHubActionKey; label: string; blockers: string[] }> = [
    {
      key: "continue",
      label: "Continue",
      blockers: continueChangeBlockers,
    },
    {
      key: "apply",
      label: "Apply",
      blockers: [...applyChangeBlockers, ...applyGateBlockers],
    },
    {
      key: "verify",
      label: "Verify",
      blockers: [
        ...input.change.blockers,
        ...(incompleteForVerify ? ["Core artifacts are incomplete"] : []),
      ],
    },
    {
      key: "archive",
      label: "Archive",
      blockers: [...input.change.blockers, ...archiveGateBlockers],
    },
  ];

  return actionMeta.map((entry) => {
    const blockers = [...new Set([...sharedBlockers, ...entry.blockers])];
    return {
      key: entry.key,
      label: entry.label,
      commandPreview: buildActionCommand(input.change.id, entry.key, input.provider),
      available: blockers.length === 0 && supported,
      blockers,
      kind: supported ? "native" : "passthrough",
    };
  });
}

export function parseValidationIssues(output: string): SpecValidationIssue[] {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const issues: SpecValidationIssue[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (!/(error|failed|invalid|missing|required|not found)/i.test(line)) {
      continue;
    }

    const pathMatch = line.match(/([\w./-]+\.md(?::\d+)?)/i);
    const path = pathMatch?.[1] ?? null;
    const target = path ?? "validation";
    const reason = line;
    const hint = path
      ? "Open the target file and fix the requirement mismatch before re-running verify."
      : "Read command output and complete missing artifacts, then run verify again.";

    const key = `${target}|${reason}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    issues.push({
      target,
      reason,
      hint,
      path,
    });
  }

  return issues.slice(0, 24);
}

export function extractGitRefs(output: string) {
  const refs = output.match(/\b[0-9a-f]{7,40}\b/gi) ?? [];
  return [...new Set(refs.map((entry) => entry.toLowerCase()))].slice(0, 8);
}

export function hasSemanticActionFailure(action: SpecHubActionKey, output: string) {
  const normalized = output.toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.includes("aborted. no files were changed")) {
    return true;
  }
  if (action === "archive" && normalized.includes("failed for header")) {
    return true;
  }
  return false;
}

export async function runSpecAction(input: {
  workspaceId: string;
  changeId: string;
  action: SpecHubActionKey;
  provider: SpecProvider;
  customSpecRoot?: string | null;
}): Promise<SpecTimelineEvent> {
  const command = buildActionCommand(input.changeId, input.action, input.provider);
  const commandArgs = buildActionCommandArgs(input.changeId, input.action, input.provider);
  const normalizedSpecRoot =
    input.provider === "openspec" ? normalizeCustomSpecRoot(input.customSpecRoot) : null;
  const result = await runSpecCommand(
    input.workspaceId,
    commandArgs,
    {
      customSpecRoot: normalizedSpecRoot,
      timeoutMs: 180_000,
    },
  );

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  const validationIssues = input.action === "verify" ? parseValidationIssues(output) : [];
  const success = result.success && !hasSemanticActionFailure(input.action, output);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    kind: input.action === "verify" ? "validate" : "action",
    action: input.action,
    command,
    success,
    output,
    validationIssues,
    gitRefs: extractGitRefs(output),
  };
}

export function buildSpecGateState(input: {
  snapshot: SpecWorkspaceSnapshot;
  selectedChange: SpecChangeSummary | null;
  lastVerifyEvent: SpecTimelineEvent | null;
  verifyState?: SpecVerifyState;
  artifacts?: Record<SpecArtifactEntry["type"], SpecArtifactEntry> | null;
}): SpecGateState {
  const checks: SpecGateState["checks"] = [];

  checks.push({
    key: "provider",
    label: "Provider",
    status: input.snapshot.provider === "unknown" ? "fail" : "pass",
    message:
      input.snapshot.provider === "unknown"
        ? "No supported provider detected"
        : `${input.snapshot.provider} (${input.snapshot.supportLevel})`,
  });

  checks.push({
    key: "health",
    label: "Environment",
    status:
      input.snapshot.environment.status === "healthy"
        ? "pass"
        : input.snapshot.environment.status === "degraded"
          ? "warn"
          : "fail",
    message:
      input.snapshot.environment.status === "healthy"
        ? "Doctor checks passed"
        : input.snapshot.environment.blockers[0] ?? "Environment needs attention",
  });

  if (!input.selectedChange) {
    checks.push({
      key: "artifacts",
      label: "Artifacts",
      status: "warn",
      message: "Select a change first",
    });
  } else {
    const complete =
      Boolean(input.selectedChange.artifacts.proposalPath) &&
      Boolean(input.selectedChange.artifacts.designPath) &&
      Boolean(input.selectedChange.artifacts.tasksPath) &&
      input.selectedChange.artifacts.specPaths.length > 0;
    const hasChangeBlockers = input.selectedChange.blockers.length > 0;
    const truncatedArtifacts: string[] = [];
    if (input.artifacts?.tasks.truncated) {
      truncatedArtifacts.push("tasks.md");
    }
    if (input.artifacts?.specs.truncated) {
      truncatedArtifacts.push("specs");
    }
    const hasTruncatedRisk = truncatedArtifacts.length > 0;
    checks.push({
      key: "artifacts",
      label: "Artifacts",
      status: hasChangeBlockers
        ? "fail"
        : !complete
          ? "fail"
          : hasTruncatedRisk
            ? "warn"
            : "pass",
      message: hasChangeBlockers
        ? input.selectedChange.blockers[0] || "Core artifacts incomplete"
        : !complete
          ? "Core artifacts incomplete"
          : hasTruncatedRisk
            ? `Artifact evidence is truncated (${truncatedArtifacts.join(", ")}). Re-read before archive.`
            : "Core artifacts ready",
    });
  }

  const verifyEvidence =
    input.verifyState ??
    (input.lastVerifyEvent
      ? {
          ran: true,
          success: input.lastVerifyEvent.success,
        }
      : {
          ran: false,
          success: false,
        });

  if (!verifyEvidence.ran) {
    checks.push({
      key: "validation",
      label: "Validation",
      status: input.selectedChange?.status === "archived" ? "pass" : "warn",
      message:
        input.selectedChange?.status === "archived"
          ? "Change is already archived"
          : "No strict verify evidence recorded",
    });
  } else {
    checks.push({
      key: "validation",
      label: "Validation",
      status: verifyEvidence.success ? "pass" : "fail",
      message: verifyEvidence.success
        ? "Latest strict verify passed"
        : input.lastVerifyEvent?.validationIssues[0]?.reason || "Latest strict verify failed",
    });
  }

  const hasFail = checks.some((entry) => entry.status === "fail");
  const hasWarn = checks.some((entry) => entry.status === "warn");

  return {
    status: hasFail ? "fail" : hasWarn ? "warn" : "pass",
    checks,
  };
}
