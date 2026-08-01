import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { useSpecHub } from "../hooks/useSpecHub";
import { detectEngines, engineSendMessageSync, pickImageFiles } from "../../../services/tauri";

function renderMarkdownInline(text: string) {
  const parts = text.split(/(`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={`code-${index}`}>{part.slice(1, -1)}</code>
    ) : (
      <span key={`text-${index}`}>{part}</span>
    ),
  );
}

function renderMarkdownMock(content: string) {
  const lines = content.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let listItems: ReactNode[] = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    nodes.push(<ul key={`list-${nodes.length}`}>{listItems}</ul>);
    listItems = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const HeadingTag = `h${headingMatch[1].length}` as
        | "h1"
        | "h2"
        | "h3"
        | "h4"
        | "h5"
        | "h6";
      nodes.push(<HeadingTag key={`heading-${index}`}>{renderMarkdownInline(headingMatch[2])}</HeadingTag>);
      return;
    }
    const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      listItems.push(<li key={`li-${index}`}>{renderMarkdownInline(listMatch[1])}</li>);
      return;
    }
    flushList();
    nodes.push(<p key={`p-${index}`}>{renderMarkdownInline(trimmed)}</p>);
  });
  flushList();

  return <div className="spec-hub-markdown">{nodes}</div>;
}

vi.mock("../../../markdown/components/Markdown", () => ({
  Markdown: ({
    content,
    value,
  }: {
    content?: string;
    value?: string;
  }) => renderMarkdownMock(content ?? value ?? ""),
}));

vi.mock("../../engine/components/EngineIcon", () => ({
  EngineIcon: ({ engine }: { engine: string }) => <span data-testid="engine-icon">{engine}</span>,
}));

vi.mock("../../../components/ui/tabs", async () => {
  const React = await import("react");

  type TabsContextValue = {
    value: string;
    onValueChange: (value: string) => void;
  };

  const TabsContext = React.createContext<TabsContextValue | null>(null);

  const Tabs = ({
    value,
    onValueChange,
    children,
    className,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
    className?: string;
  }) => (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );

  const TabsList = ({ children }: { children: ReactNode }) => <div role="tablist">{children}</div>;

  const TabsTrigger = ({
    value,
    children,
    ...rest
  }: {
    value: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => {
    const context = React.useContext(TabsContext);
    if (!context) {
      throw new Error("TabsTrigger must be used within Tabs");
    }
    return (
      <button
        type="button"
        role="tab"
        aria-selected={context.value === value}
        onClick={() => context.onValueChange(value)}
        {...rest}
      >
        {children}
      </button>
    );
  };

  const TabsContent = ({
    value,
    children,
    ...rest
  }: {
    value: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => {
    const context = React.useContext(TabsContext);
    if (!context) {
      throw new Error("TabsContent must be used within Tabs");
    }
    if (context.value !== value) {
      return null;
    }
    return (
      <div role="tabpanel" {...rest}>
        {children}
      </div>
    );
  };

  return {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
  };
});

vi.mock("react-i18next", () => {
  const t = (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      "specHub.actions": "Actions",
      "specHub.project": "Project",
      "specHub.sharedExecutor.label": "Execution engine",
      "specHub.proposal.createAction": "New Proposal",
      "specHub.proposal.appendAction": "Append Proposal",
      "specHub.proposal.dialogTitleCreate": "Create New Proposal",
      "specHub.proposal.dialogTitleAppend": "Append Existing Proposal",
      "specHub.proposal.addImageAction": "Attach image",
      "specHub.environment.notInstalled": "Not installed",
      "specHub.proposal.cancelAction": "Cancel",
      "specHub.proposal.submitCreateAction": "Submit Create",
      "specHub.proposal.submitAppendAction": "Submit Append",
      "specHub.proposal.emptyInputError": "Enter proposal content or attach at least one image.",
      "specHub.proposal.imageUnsupported": "Unsupported image format. Use png/jpg/jpeg/gif/webp/bmp/tiff.",
      "specHub.proposal.imageCountExceeded": `You can attach up to ${params?.count ?? 6} images.`,
      "specHub.proposal.imageTooLarge": `Image is too large (${params?.size ?? ""}). Max 8 MB per pasted image.`,
      "specHub.proposal.attachmentHint": `Supports upload/paste/drag images (up to ${params?.count ?? 6} attachments).`,
      "specHub.verifyAutoComplete.label": "Auto-complete",
      "specHub.verifyAutoComplete.title": "Verify Auto-Completion Feedback",
      "specHub.verifyAutoComplete.hint":
        "When enabled, missing verification artifact will be generated by AI before strict verify.",
      "specHub.verifyAutoComplete.running": "Generating verification artifact...",
      "specHub.verifyAutoComplete.failed": `Auto-completion failed: ${params?.reason ?? ""}`,
      "specHub.verifyAutoComplete.collapsePanel": "Collapse verify auto-completion feedback",
      "specHub.verifyAutoComplete.expandPanel": "Expand verify auto-completion feedback",
      "specHub.verifyAutoComplete.closePanel": "Close verify auto-completion feedback",
      "specHub.verifyAutoComplete.fieldStatus": "Status",
      "specHub.verifyAutoComplete.fieldPhase": "Phase",
      "specHub.verifyAutoComplete.fieldEngine": "Engine",
      "specHub.verifyAutoComplete.startedAt": `Started at: ${params?.time ?? ""}`,
      "specHub.verifyAutoComplete.finishedAt": `Finished at: ${params?.time ?? ""}`,
      "specHub.verifyAutoComplete.streamTitle": "Live output",
      "specHub.verifyAutoComplete.outputTitle": "Final output",
      "specHub.verifyAutoComplete.logsTitle": "Execution logs",
      "specHub.verifyAutoComplete.validateSkipped":
        "Auto-completion failed and strict validate was skipped for this run.",
      "specHub.verifyAutoComplete.summaryCompletionFinished":
        "Verification artifact completed. Running strict verify.",
      "specHub.verifyAutoComplete.summarySuccess": "Auto-completion and verify flow finished.",
      "specHub.verifyAutoComplete.status.idle": "Idle",
      "specHub.verifyAutoComplete.status.running": "Running",
      "specHub.verifyAutoComplete.status.success": "Success",
      "specHub.verifyAutoComplete.status.failed": "Failed",
      "specHub.verifyAutoComplete.phase.idle": "Idle",
      "specHub.verifyAutoComplete.phase.completion-dispatch": "Completion dispatch",
      "specHub.verifyAutoComplete.phase.completion-execution": "Completion execution",
      "specHub.verifyAutoComplete.phase.completion-finalize": "Completion finalize",
      "specHub.verifyAutoComplete.phase.verify-dispatch": "Verify dispatch",
      "specHub.verifyAutoComplete.phase.verify-finalize": "Verify finalize",
      "specHub.verifyAutoComplete.logDispatch": `Verification completion dispatched with ${params?.engine ?? ""}.`,
      "specHub.verifyAutoComplete.logCompletionStarted": "Verification completion started.",
      "specHub.verifyAutoComplete.logRefreshStarted": "Completion finished. Refreshing Spec Hub state.",
      "specHub.verifyAutoComplete.logVerifyDispatch": "Running strict validate.",
      "specHub.verifyAutoComplete.logVerifyFinished": "Strict validate finished.",
      "specHub.continueAiEnhancement.label": "AI Enhancement",
      "specHub.continueAiEnhancement.title": "Continue AI Enhancement Feedback",
      "specHub.continueAiEnhancement.hint": "Continue AI hint",
      "specHub.continueAiEnhancement.running": "Generating continue AI brief...",
      "specHub.continueAiEnhancement.failed": `Continue AI enhancement failed: ${params?.reason ?? ""}`,
      "specHub.continueAiEnhancement.latestSummary": `Latest summary: ${params?.summary ?? ""}`,
      "specHub.continueAiEnhancement.collapsePanel": "Collapse continue AI enhancement feedback",
      "specHub.continueAiEnhancement.expandPanel": "Expand continue AI enhancement feedback",
      "specHub.continueAiEnhancement.closePanel": "Close continue AI enhancement feedback",
      "specHub.continueAiEnhancement.fieldStatus": "Status",
      "specHub.continueAiEnhancement.fieldPhase": "Phase",
      "specHub.continueAiEnhancement.fieldEngine": "Engine",
      "specHub.continueAiEnhancement.startedAt": `Started at: ${params?.time ?? ""}`,
      "specHub.continueAiEnhancement.finishedAt": `Finished at: ${params?.time ?? ""}`,
      "specHub.continueAiEnhancement.streamTitle": "Live output",
      "specHub.continueAiEnhancement.outputTitle": "Final output",
      "specHub.continueAiEnhancement.logsTitle": "Execution logs",
      "specHub.continueAiEnhancement.logDispatch": `Continue AI enhancement dispatched with ${params?.engine ?? ""}.`,
      "specHub.continueAiEnhancement.logFinished": "Continue AI enhancement finished.",
      "specHub.continueAiEnhancement.logAutoApplyDispatch":
        `Continue AI enhancement finished. Auto-running Apply with ${params?.engine ?? ""}.`,
      "specHub.continueAiEnhancement.logAutoApplyFinished": "Auto-run apply finished.",
      "specHub.continueAiEnhancement.logAutoApplySkipped":
        "Auto-run apply did not complete. Run Apply manually.",
      "specHub.continueAiEnhancement.autoApplyFailed":
        "Auto-run apply failed. Check Apply execution feedback.",
      "specHub.continueAiEnhancement.status.idle": "Idle",
      "specHub.continueAiEnhancement.status.running": "Running",
      "specHub.continueAiEnhancement.status.success": "Success",
      "specHub.continueAiEnhancement.status.failed": "Failed",
      "specHub.continueAiEnhancement.phase.idle": "Idle",
      "specHub.continueAiEnhancement.phase.analysis-dispatch": "Analysis dispatch",
      "specHub.continueAiEnhancement.phase.analysis-execution": "Analysis execution",
      "specHub.continueAiEnhancement.phase.analysis-finalize": "Analysis finalize",
      "specHub.continueAiEnhancement.phase.apply-dispatch": "Apply dispatch",
      "specHub.continueAiEnhancement.phase.apply-execution": "Apply execution",
      "specHub.continueAiEnhancement.phase.apply-finalize": "Apply finalize",
      "specHub.applyContinueBrief.label": "Use Continue brief",
      "specHub.applyContinueBrief.summary": `Brief: ${params?.summary ?? ""}`,
      "specHub.applyContinueBrief.stale": "Continue brief may be stale.",
      "specHub.applyContinueBrief.missing": "No Continue brief yet.",
      "specHub.nextStep.runContinueFirst": "Run continue first.",
      "specHub.nextStep.runContinueThenApply": "Run continue then apply.",
      "specHub.gateTitle": "Gate",
      "specHub.timeline": "Timeline",
      "specHub.doctorTitle": "Doctor",
      "specHub.modeManaged": "Managed",
      "specHub.modeByo": "BYO",
      "specHub.runtime.noStrictVerify": "NO_VERIFY_EVIDENCE",
      "specHub.runtime.truncatedArtifactEvidence": `TRUNCATED ${params?.artifacts ?? ""}`,
      "specHub.runtime.runContinueFirstForSpecs": "Run continue first.",
      "specHub.runtime.continueBriefAttached": "Continue brief attached.",
      "specHub.gate.warn": "Warn",
      "specHub.placeholder.notAvailable": "N/A",
      "specHub.filter.all": "All",
      "specHub.filter.active": "Active",
      "specHub.filter.backlog": "Backlog",
      "specHub.filter.blocked": "Blocked",
      "specHub.filter.archived": "Archived",
      "specHub.filterTitle": "Filter changes",
      "specHub.archivedGroups.other": "Other",
      "specHub.groupControls.expandAll": "Expand all",
      "specHub.groupControls.collapseAll": "Collapse all",
      "specHub.changes": "Changes",
      "specHub.status.draft": "Draft",
      "specHub.status.ready": "Ready",
      "specHub.status.implementing": "Implementing",
      "specHub.status.verified": "Verified",
      "specHub.status.archived": "Archived",
      "specHub.status.blocked": "Blocked",
      "specHub.noChanges": "No changes",
      "specHub.noChangesHint": "No visible changes in this view.",
      "specHub.noBacklogChanges": "No backlog changes",
      "specHub.noBacklogChangesHint": "Move deferred proposals here from the change list.",
      "specHub.changeBacklogBadge": "Backlog",
      "specHub.changeBacklogHint": "This change is currently in backlog.",
      "specHub.changeRowAriaLabelBacklog": `${params?.id ?? ""} ${params?.status ?? ""} ${params?.action ?? ""}`,
      "specHub.changeAction.menuLabel": "Change actions",
      "specHub.changeAction.moveToBacklog": "Move to backlog",
      "specHub.changeAction.removeFromBacklog": "Remove from backlog",
      "specHub.openInWindow": "Open in Window",
      "specHub.changePane.collapse": "Collapse changes pane",
      "specHub.changePane.expand": "Expand changes pane",
      "specHub.changePane.resize": "Resize changes pane",
      "specHub.readerOutline.title": "Reader Outline",
      "specHub.readerOutline.empty": "No structure",
      "specHub.readerOutline.linkedSpecs": "Linked Specs",
      "specHub.readerOutline.expand": "Expand reader outline",
      "specHub.readerOutline.collapse": "Collapse reader outline",
      "specHub.detached.unavailableTitle": "Unavailable",
      "specHub.detached.unavailableBody": "Body",
      "specHub.expandControlCenter": "Expand control center",
      "specHub.collapseControlCenter": "Collapse control center",
      "specHub.applyExecution.title": "Apply Execution Feedback",
      "specHub.applyExecution.executorLabel": "Apply executor",
      "specHub.applyExecution.executorHint": "Apply executor hint",
      "specHub.applyExecution.collapsePanel": "Collapse feedback panel",
      "specHub.applyExecution.expandPanel": "Expand feedback panel",
      "specHub.applyExecution.closePanel": "Close feedback panel",
      "specHub.applyExecution.fieldStatus": "Status",
      "specHub.applyExecution.fieldPhase": "Phase",
      "specHub.applyExecution.fieldExecutor": "Executor",
      "specHub.applyExecution.status.idle": "Idle",
      "specHub.applyExecution.status.running": "Running",
      "specHub.applyExecution.status.success": "Success",
      "specHub.applyExecution.status.failed": "Failed",
      "specHub.applyExecution.phase.idle": "Idle",
      "specHub.applyExecution.phase.preflight": "Preflight",
      "specHub.applyExecution.phase.instructions": "Instructions",
      "specHub.applyExecution.phase.execution": "Execution",
      "specHub.applyExecution.phase.task-writeback": "Task write-back",
      "specHub.applyExecution.phase.finalize": "Finalize",
      "specHub.applyExecution.startedAt": `Started at: ${params?.time ?? ""}`,
      "specHub.applyExecution.finishedAt": `Finished at: ${params?.time ?? ""}`,
      "specHub.applyExecution.noChanges": "Execution finished without code changes.",
      "specHub.applyExecution.changedFiles": `Changed files: ${params?.count ?? 0}`,
      "specHub.applyExecution.tests": `Tests: ${params?.count ?? 0}`,
      "specHub.applyExecution.checks": `Checks: ${params?.count ?? 0}`,
      "specHub.applyExecution.completedTasks": `Auto-completed tasks: ${params?.count ?? 0}`,
      "specHub.applyExecution.changedFilesTitle": "Changed files",
      "specHub.applyExecution.changedFilesEmpty": "(none)",
      "specHub.applyExecution.testsTitle": "Tests",
      "specHub.applyExecution.checksTitle": "Checks",
      "specHub.applyExecution.streamTitle": "Live output",
      "specHub.applyExecution.logsTitle": "Execution logs",
      "specHub.feedbackElapsed": `Elapsed ${params?.duration ?? ""}`,
      "specHub.autoCombo.linkLabel": "Combo",
      "specHub.autoCombo.title": "Combo Recovery Feedback",
      "specHub.autoCombo.collapsePanel": "Collapse combo recovery feedback",
      "specHub.autoCombo.expandPanel": "Expand combo recovery feedback",
      "specHub.autoCombo.closePanel": "Close combo recovery feedback",
      "specHub.autoCombo.fieldStatus": "Status",
      "specHub.autoCombo.fieldPhase": "Phase",
      "specHub.autoCombo.fieldEngine": "Engine",
      "specHub.autoCombo.startedAt": `Started at: ${params?.time ?? ""}`,
      "specHub.autoCombo.finishedAt": `Finished at: ${params?.time ?? ""}`,
      "specHub.autoCombo.logsTitle": "Execution logs",
      "specHub.autoCombo.remediateHint":
        "Missing specs delta MUST be created before any task polish.",
      "specHub.autoCombo.riskMissingSpecs":
        "Specs delta is missing and must be recovered first.",
      "specHub.autoCombo.verifyPlanEnsureSpecs":
        "Confirm specs/**/*.md exists under this change.",
      "specHub.autoCombo.sequenceFixSpecsFirst":
        "Recover specs delta first, then polish tasks.",
      "specHub.autoCombo.summaryReady":
        "Core artifact audit passed. Specs delta already exists.",
      "specHub.autoCombo.summaryRecovered":
        "Missing specs delta was recovered automatically.",
      "specHub.autoCombo.summaryStillMissing":
        "Specs delta is still missing after auto-recovery. Run Continue + Apply again.",
      "specHub.autoCombo.summaryFailed": "Combo recovery failed.",
      "specHub.autoCombo.errorStillMissing": "Specs delta is still missing.",
      "specHub.autoCombo.errorWithReason":
        `Combo recovery failed: ${params?.reason ?? ""}`,
      "specHub.autoCombo.logDispatch": "Combo recovery audit started.",
      "specHub.autoCombo.logAuditPassed": "Audit passed: specs delta exists.",
      "specHub.autoCombo.logAuditMissingSpecs":
        "Audit found missing specs delta. Starting auto-recovery.",
      "specHub.autoCombo.logRemediateDispatch":
        `Dispatching auto-recovery apply with ${params?.engine ?? ""}.`,
      "specHub.autoCombo.logRemediateFinished": "Auto-recovery apply finished.",
      "specHub.autoCombo.logRemediateFailed":
        "Auto-recovery apply did not succeed. Verifying artifacts anyway.",
      "specHub.autoCombo.status.idle": "Idle",
      "specHub.autoCombo.status.running": "Running",
      "specHub.autoCombo.status.success": "Success",
      "specHub.autoCombo.status.failed": "Failed",
      "specHub.autoCombo.phase.idle": "Idle",
      "specHub.autoCombo.phase.audit": "Artifact audit",
      "specHub.autoCombo.phase.remediate": "Auto recovery",
      "specHub.autoCombo.phase.verify": "Recovery verify",
      "specHub.autoCombo.phase.finalize": "Finalize",
    };
    if (typeof translations[key] === "string") {
      return translations[key];
    }
    if (typeof params?.defaultValue === "string") {
      return params.defaultValue;
    }
    return key;
  };

  const i18n = { language: "en", changeLanguage: vi.fn() };
  const translationValue = { t, i18n };

  return {
    initReactI18next: { type: "3rdParty", init: () => {} },
    useTranslation: () => translationValue,
  };
});

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("../../../services/events", () => ({
  subscribeAppServerEvents: vi.fn(() => () => {}),
}));

export const openOrFocusDetachedSpecHubMock = vi.fn(async () => "created");

vi.mock("../detachedSpecHub", async (importOriginal) => {
  const original = await importOriginal<typeof import("../detachedSpecHub")>();
  return {
    ...original,
    openOrFocusDetachedSpecHub: (...args: any[]) => (openOrFocusDetachedSpecHubMock as any)(...args),
    writeDetachedSpecHubSessionSnapshot: vi.fn(),
  };
});

vi.mock("../../../services/tauri", () => ({
  detectEngines: vi.fn(async () => [
    { engineType: "codex", installed: true },
    { engineType: "claude", installed: true },
    { engineType: "opencode", installed: true },
  ]),
  engineSendMessage: vi.fn(async () => ({ result: { turn: { id: "turn-1" } } })),
  engineSendMessageSync: vi.fn(async () => ({ engine: "codex", text: "" })),
  getWorkspaceFiles: vi.fn(async () => ({ files: [], directories: [], gitignored_files: [], gitignored_directories: [] })),
  getActiveEngine: vi.fn(async () => "codex"),
  pickImageFiles: vi.fn(async () => []),
  sendUserMessage: vi.fn(async () => ({ result: { turn: { id: "turn-2" } } })),
  startThread: vi.fn(async () => ({})),
}));

export const mockUseSpecHub = vi.mocked(useSpecHub);
export const mockDetectEngines = vi.mocked(detectEngines);
export const mockEngineSendMessageSync = vi.mocked(engineSendMessageSync);
export const mockPickImageFiles = vi.mocked(pickImageFiles);
export const originalConsoleError = console.error;

export function isReactActWarning(args: unknown[]): boolean {
  return args.some((value) => typeof value === "string" && value.includes("not wrapped in act"));
}

export function getChangeGroupToggle(label: RegExp | string) {
  const matches = screen
    .getAllByRole("button")
    .filter((button) => button.classList.contains("spec-hub-change-group-toggle"))
    .filter((button) => {
      const text = button.textContent ?? "";
      return typeof label === "string" ? text.includes(label) : label.test(text);
    });
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one group toggle for label ${String(label)}, got ${matches.length}.`);
  }
  return matches[0] as HTMLButtonElement;
}

export function createUseSpecHubState(gateMessage: string, overrides?: Record<string, unknown>) {
  const baseState: ReturnType<typeof useSpecHub> = {
    snapshot: {
      provider: "openspec",
      supportLevel: "full",
      specRoot: { source: "default", path: "openspec" },
      environment: {
        mode: "managed",
        status: "healthy",
        checks: [],
        blockers: [],
        hints: [],
      },
      changes: [
        {
          id: "change-1",
          status: "ready",
          updatedAt: 1,
          artifacts: {
            proposalPath: "openspec/changes/change-1/proposal.md",
            designPath: "openspec/changes/change-1/design.md",
            tasksPath: "openspec/changes/change-1/tasks.md",
            verificationPath: null,
            specPaths: ["openspec/changes/change-1/specs/spec-hub-workbench-ui/spec.md"],
          },
          blockers: [],
          archiveBlockers: [],
        },
      ],
      blockers: [],
    },
    selectedChange: {
      id: "change-1",
      status: "ready",
      updatedAt: 1,
      artifacts: {
        proposalPath: "openspec/changes/change-1/proposal.md",
        designPath: "openspec/changes/change-1/design.md",
        tasksPath: "openspec/changes/change-1/tasks.md",
        verificationPath: null,
        specPaths: ["openspec/changes/change-1/specs/spec-hub-workbench-ui/spec.md"],
      },
      blockers: [],
      archiveBlockers: [],
    },
    artifacts: {
      proposal: {
        type: "proposal",
        path: "openspec/changes/change-1/proposal.md",
        exists: true,
        content: "# Proposal\n\n## Capabilities\n\n- `spec-hub-workbench-ui`\n\n## Details\n\nContent",
      },
      design: { type: "design", path: "openspec/changes/change-1/design.md", exists: true, content: "# d" },
      specs: {
        type: "specs",
        path: "openspec/changes/change-1/specs/spec-hub-workbench-ui/spec.md",
        exists: true,
        content: "### Requirement: Current\n\n#### Scenario: Existing",
        truncated: false,
        sources: [
          {
            path: "openspec/changes/change-1/specs/spec-hub-workbench-ui/spec.md",
            content: "### Requirement: Current\n\n#### Scenario: Existing",
            truncated: false,
          },
        ],
      },
      tasks: {
        type: "tasks",
        path: "openspec/changes/change-1/tasks.md",
        exists: true,
        content: "## Tasks",
        truncated: false,
        taskChecklist: [],
        taskProgress: { total: 1, checked: 1, requiredTotal: 1, requiredChecked: 1 },
      },
      verification: { type: "verification", path: null, exists: false, content: "" },
    },
    actions: [],
    timeline: [],
    gate: {
      status: "warn",
      checks: [
        {
          key: "validation",
          label: "Validation",
          status: "warn",
          message: gateMessage,
        },
      ],
    },
    validationIssues: [],
    environmentMode: "managed",
    isLoading: false,
    isRunningAction: null,
    actionError: null,
    applyExecution: {
      status: "idle",
      phase: "idle",
      executor: null,
      startedAt: null,
      finishedAt: null,
      instructionsOutput: "",
      executionOutput: "",
      summary: "",
      changedFiles: [],
      tests: [],
      checks: [],
      completedTaskIndices: [],
      noChanges: false,
      error: null,
      logs: [],
    },
    isBootstrapping: false,
    bootstrapError: null,
    isSavingProjectInfo: false,
    projectInfoError: null,
    isUpdatingTaskIndex: null,
    taskUpdateError: null,
    customSpecRoot: null,
    isControlCenterCollapsed: false,
    setControlCenterCollapsed: vi.fn(),
    backlogChangeIds: [],
    moveChangeToBacklog: vi.fn(),
    removeChangeFromBacklog: vi.fn(),
    refresh: vi.fn(),
    selectChange: vi.fn(),
    executeAction: vi.fn(),
    executeBootstrap: vi.fn(),
    persistProjectInfo: vi.fn(),
    updateTaskChecklistItem: vi.fn(),
    loadProjectInfo: vi.fn(),
    setCustomSpecRoot: vi.fn(),
    switchMode: vi.fn(),
  };
  return {
    ...baseState,
    ...overrides,
  } as ReturnType<typeof useSpecHub>;
}
