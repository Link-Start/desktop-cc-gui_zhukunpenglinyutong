import type {
  SpecChangeSummary,
  SpecEnvironmentHealth,
  SpecEnvironmentMode,
  SpecProvider,
  SpecWorkspaceSnapshot,
} from "./types";
import {
  asPathSet,
  DEFAULT_SPEC_ROOT_RELATIVE,
  hasPrefix,
  normalizeCustomSpecRoot,
} from "./runtimeShared";
import {
  parseDateHintFromChangeId,
  parseTaskProgress,
} from "./runtimeParse";
import {
  parseProbeValue,
  readExternalSpecTreeSnapshot,
  readOptionalWorkspaceFile,
  runSpecKitProbe,
  runWorkspaceBinary,
} from "./runtimeIo";
import { collectArchivePreflightBlockers } from "./runtimePreflight";

export function defaultModeForProvider(provider: SpecProvider): SpecEnvironmentMode {
  return provider === "openspec" ? "managed" : "byo";
}

export function detectProvider(files: Set<string>, directories: Set<string>) {
  const hasOpenSpec =
    [...directories].some((entry) => hasPrefix(entry, "openspec/changes")) ||
    [...files].some((entry) => hasPrefix(entry, "openspec/changes"));
  if (hasOpenSpec) {
    return { provider: "openspec" as const, supportLevel: "full" as const };
  }

  const hasSpecKit =
    [...directories].some((entry) => hasPrefix(entry, ".specify")) ||
    [...files].some(
      (entry) =>
        hasPrefix(entry, ".specify") ||
        entry === "specify.md" ||
        entry === "specify.yaml" ||
        entry === "spec-kit.md",
    );

  if (hasSpecKit) {
    return { provider: "speckit" as const, supportLevel: "minimal" as const };
  }

  return { provider: "unknown" as const, supportLevel: "none" as const };
}

export function collectOpenSpecChanges(files: Set<string>, directories: Set<string>) {
  const active = new Set<string>();
  const archived = new Set<string>();

  const collect = (value: string) => {
    if (!hasPrefix(value, "openspec/changes")) {
      return;
    }
    const rest = value.slice("openspec/changes/".length);
    const [head, second] = rest.split("/");
    if (!head) {
      return;
    }
    if (head === "archive") {
      if (second) {
        archived.add(second.trim());
      }
      return;
    }
    active.add(head.trim());
  };

  directories.forEach(collect);
  files.forEach(collect);

  return {
    active: [...active].sort((a, b) => a.localeCompare(b)),
    archived: [...archived].sort((a, b) => a.localeCompare(b)),
  };
}

export function firstExistingPath(files: Set<string>, candidates: string[]) {
  for (const candidate of candidates) {
    if (files.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function collectSpecKitChange(files: Set<string>): SpecChangeSummary | null {
  const proposalPath = firstExistingPath(files, [
    "specify.md",
    "spec-kit.md",
    ".specify/proposal.md",
    ".specify/spec.md",
  ]);
  const designPath = firstExistingPath(files, [
    ".specify/design.md",
    ".specify/architecture.md",
    ".specify/approach.md",
  ]);
  const tasksPath = firstExistingPath(files, [".specify/tasks.md", ".specify/todo.md"]);
  const verificationPath = firstExistingPath(files, [".specify/verification.md"]);
  const specPaths = [...files]
    .filter(
      (entry) =>
        (hasPrefix(entry, ".specify") || hasPrefix(entry, "specs")) &&
        entry.endsWith(".md") &&
        entry !== proposalPath &&
        entry !== designPath &&
        entry !== tasksPath &&
        entry !== verificationPath,
    )
    .sort();

  if (!proposalPath && !designPath && !tasksPath && !verificationPath && specPaths.length === 0) {
    return null;
  }

  const blockers = [
    "Spec-Kit uses minimal compatibility mode (read-only + passthrough).",
  ];

  return {
    id: "spec-kit-workspace",
    status: "blocked",
    updatedAt: Date.now(),
    artifacts: {
      proposalPath,
      designPath,
      tasksPath,
      verificationPath,
      specPaths,
    },
    blockers,
    archiveBlockers: [],
  };
}
export async function summarizeOpenSpecChange(input: {
  workspaceId: string;
  changeId: string;
  files: Set<string>;
  archived?: boolean;
  skipTaskProgressRead?: boolean;
  customSpecRoot?: string | null;
}): Promise<SpecChangeSummary> {
  const base = input.archived
    ? `openspec/changes/archive/${input.changeId}`
    : `openspec/changes/${input.changeId}`;
  const proposalPath = `${base}/proposal.md`;
  const designPath = `${base}/design.md`;
  const tasksPath = `${base}/tasks.md`;
  const verificationPath = `${base}/verification.md`;

  const specPaths = [...input.files]
    .filter((entry) => hasPrefix(entry, `${base}/specs`) && entry.endsWith(".md"))
    .sort();

  const hasProposal = input.files.has(proposalPath);
  const hasDesign = input.files.has(designPath);
  const hasTasks = input.files.has(tasksPath);
  const hasVerification = input.files.has(verificationPath);
  const hasSpecs = specPaths.length > 0;
  const archiveBlockers = input.archived
    ? []
    : await collectArchivePreflightBlockers({
        workspaceId: input.workspaceId,
        base,
        specPaths,
        files: input.files,
        customSpecRoot: input.customSpecRoot,
      });

  const blockers: string[] = [];
  if (!hasProposal) blockers.push("Missing proposal.md");
  if (!hasDesign) blockers.push("Missing design.md");
  if (!hasTasks) blockers.push("Missing tasks.md");
  if (!hasSpecs) blockers.push("Missing specs delta");

  let tasksContent = "";
  const shouldReadTaskProgress = hasTasks && !input.skipTaskProgressRead;
  if (shouldReadTaskProgress) {
    const response = await readOptionalWorkspaceFile(
      input.workspaceId,
      tasksPath,
      input.customSpecRoot,
    );
    tasksContent = response.content;
    if (!response.exists) {
      blockers.push("Unable to read tasks.md");
    }
  }

  const { progress } = parseTaskProgress(tasksContent);
  const isComplete = hasProposal && hasDesign && hasTasks && hasSpecs;

  let status: SpecChangeSummary["status"] = "draft";
  if (input.archived) {
    status = "archived";
  } else if (!isComplete) {
    status = blockers.length > 0 ? "blocked" : "draft";
  } else if (
    progress.requiredTotal > 0 &&
    progress.requiredChecked > 0 &&
    progress.requiredChecked < progress.requiredTotal
  ) {
    status = "implementing";
  } else if (
    hasVerification ||
    (progress.requiredTotal > 0 &&
      progress.requiredChecked === progress.requiredTotal &&
      progress.requiredChecked > 0) ||
    (progress.total > 0 && progress.checked === progress.total && progress.checked > 0)
  ) {
    status = "verified";
  } else {
    status = "ready";
  }

  return {
    id: input.changeId,
    status,
    updatedAt: parseDateHintFromChangeId(input.changeId),
    artifacts: {
      proposalPath: hasProposal ? proposalPath : null,
      designPath: hasDesign ? designPath : null,
      tasksPath: hasTasks ? tasksPath : null,
      verificationPath: hasVerification ? verificationPath : null,
      specPaths,
    },
    blockers,
    archiveBlockers,
  };
}
export async function diagnoseSpecEnvironment(input: {
  workspaceId: string;
  provider: SpecProvider;
  mode: SpecEnvironmentMode;
}): Promise<SpecEnvironmentHealth> {
  if (input.provider === "unknown") {
    return {
      mode: input.mode,
      status: "degraded",
      checks: [],
      blockers: ["No supported spec provider detected."],
      hints: ["Open a workspace with OpenSpec or spec-kit structure."],
    };
  }

  const [nodeProbe, openspecProbe, speckitProbe] = await Promise.all([
    runWorkspaceBinary(input.workspaceId, ["node", "-v"]),
    runWorkspaceBinary(input.workspaceId, ["openspec", "--version"]),
    runSpecKitProbe(input.workspaceId),
  ]);

  const nodeParsed = parseProbeValue(nodeProbe.stdout);
  const openspecParsed = parseProbeValue(openspecProbe.stdout);
  const speckitParsed = parseProbeValue(speckitProbe.stdout);

  const checks: SpecEnvironmentHealth["checks"] = [
    {
      key: "node",
      label: "Node.js",
      ok: nodeProbe.ok,
      value: nodeProbe.ok ? (nodeParsed.value ?? "missing") : "missing",
      detail: nodeProbe.ok ? (nodeParsed.detail ?? "node ok") : nodeProbe.stderr || "node not found",
      required: input.provider === "openspec",
    },
    {
      key: "openspec",
      label: "OpenSpec CLI",
      ok: openspecProbe.ok,
      value: openspecProbe.ok ? (openspecParsed.value ?? "missing") : "missing",
      detail: openspecProbe.ok ? (openspecParsed.detail ?? "openspec ok") : openspecProbe.stderr || "openspec not found",
      required: input.provider === "openspec",
    },
    {
      key: "speckit",
      label: "Spec-Kit CLI",
      ok: speckitProbe.ok,
      value: speckitProbe.ok ? (speckitParsed.value ?? "missing") : "missing",
      detail: speckitProbe.ok ? (speckitParsed.detail ?? "spec-kit ok") : speckitProbe.stderr || "spec-kit not found",
      required: false,
    },
  ];

  const blockers: string[] = [];
  const hints: string[] = [];

  for (const check of checks) {
    if (!check.ok && check.required) {
      blockers.push(`${check.label} is required for ${input.provider} workflow.`);
    }
  }

  if (!nodeProbe.ok && input.provider === "openspec") {
    hints.push("Install Node.js 18+ and make sure `node` is available in PATH.");
  }
  if (!openspecProbe.ok) {
    if (input.mode === "managed") {
      hints.push("Managed mode: install OpenSpec CLI, then click Refresh to re-run Doctor.");
      hints.push("Fallback: switch to BYO mode to use your existing environment settings.");
    } else {
      hints.push("BYO mode: expose `openspec` in PATH and verify `openspec --version` works.");
    }
  }
  if (input.provider === "speckit" && !speckitProbe.ok) {
    hints.push("Spec-Kit CLI is optional in minimal mode, but enabling it improves diagnostics.");
  }

  const hasRequiredFailure = checks.some((entry) => entry.required && !entry.ok);
  const hasOptionalFailure = checks.some((entry) => !entry.required && !entry.ok);
  const status: SpecEnvironmentHealth["status"] = hasRequiredFailure
    ? "blocked"
    : hasOptionalFailure
      ? "degraded"
      : "healthy";

  return {
    mode: input.mode,
    status,
    checks,
    blockers,
    hints,
  };
}

export async function buildSpecWorkspaceSnapshot(input: {
  workspaceId: string;
  files: string[];
  directories: string[];
  mode?: SpecEnvironmentMode;
  customSpecRoot?: string | null;
}): Promise<SpecWorkspaceSnapshot> {
  const customSpecRoot = normalizeCustomSpecRoot(input.customSpecRoot);
  let files = asPathSet(input.files);
  let directories = asPathSet(input.directories);
  if (customSpecRoot) {
    const external = await readExternalSpecTreeSnapshot({
      workspaceId: input.workspaceId,
      specRoot: customSpecRoot,
    });
    if (!external.ok) {
      return {
        provider: "unknown",
        supportLevel: "none",
        specRoot: {
          source: "custom",
          path: customSpecRoot,
        },
        environment: {
          mode: input.mode ?? "managed",
          status: "degraded",
          checks: [],
          blockers: [`Custom spec root is unavailable: ${external.error}`],
          hints: [
            "Please choose a valid absolute spec root path or restore default workspace path.",
          ],
        },
        changes: [],
        blockers: [`Custom spec root is unavailable: ${external.error}`],
      };
    }
    files = external.files;
    directories = external.directories;
  }

  const detected = detectProvider(files, directories);
  const mode = input.mode ?? defaultModeForProvider(detected.provider);
  const environment = await diagnoseSpecEnvironment({
    workspaceId: input.workspaceId,
    provider: detected.provider,
    mode,
  });

  if (detected.provider === "unknown") {
    return {
      provider: detected.provider,
      supportLevel: detected.supportLevel,
      specRoot: {
        source: customSpecRoot ? "custom" : "default",
        path: customSpecRoot ?? DEFAULT_SPEC_ROOT_RELATIVE,
      },
      environment,
      changes: [],
      blockers: ["No supported spec workspace detected.", ...environment.blockers],
    };
  }

  if (detected.provider === "speckit") {
    const change = collectSpecKitChange(files);
    return {
      provider: detected.provider,
      supportLevel: detected.supportLevel,
      specRoot: {
        source: customSpecRoot ? "custom" : "default",
        path: customSpecRoot ?? DEFAULT_SPEC_ROOT_RELATIVE,
      },
      environment,
      changes: change ? [change] : [],
      blockers: [
        "Spec-Kit is currently in minimal compatibility mode.",
        ...environment.blockers,
      ],
    };
  }

  const changeIds = collectOpenSpecChanges(files, directories);
  const activeChanges = await Promise.all(
    changeIds.active.map((changeId) =>
      summarizeOpenSpecChange({
        workspaceId: input.workspaceId,
        changeId,
        files,
        customSpecRoot,
      }),
    ),
  );

  const archivedChanges = await Promise.all(
    changeIds.archived.map((changeId) =>
      summarizeOpenSpecChange({
        workspaceId: input.workspaceId,
        changeId,
        files,
        archived: true,
        skipTaskProgressRead: true,
        customSpecRoot,
      }),
    ),
  );

  const changes = [...activeChanges, ...archivedChanges].sort(
    (left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id),
  );

  const blockers = [...environment.blockers];
  if (changes.length === 0) {
    blockers.push("No active changes found under openspec/changes.");
  }

  return {
    provider: detected.provider,
    supportLevel: detected.supportLevel,
    specRoot: {
      source: customSpecRoot ? "custom" : "default",
      path: customSpecRoot ?? DEFAULT_SPEC_ROOT_RELATIVE,
    },
    environment,
    changes,
    blockers,
  };
}
